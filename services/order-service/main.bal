import ballerina/http;
import ballerina/uuid;
import ballerina/io;
import ballerinax/kafka;
import ballerinax/mysql;
import ballerinax/mysql.driver as _;

configurable string dbHost = "localhost";
configurable int dbPort = 3307;
configurable string kafkaBootstrapServers = "localhost:9092";

final mysql:Client dbClient = check new (
    host = dbHost,
    user = "foodapp",
    password = "foodapp",
    database = "food_delivery",
    port = dbPort
);

final kafka:Producer kafkaProducer = check new (kafkaBootstrapServers);

type OrderItemRequest record {|
    int menuItemId;
    int quantity;
|};

type PaymentCompletedEvent record {|
    string eventId;
    string eventType;
    int paymentId;
    int orderId;
    decimal amount;
    string status;
    string transactionReference;
|};

type CancelOrderData record {|
    int id;
    int restaurantId;
    string status;
    int version;
|};

type CancelOrderResult record {|
    int orderId;
    string oldStatus;
    string status;
|};

type OrderCancelledEvent readonly & record {|
    string eventId;
    string eventType;
    int orderId;
    string oldStatus;
    string newStatus;
|};

type CreateOrderRequest record {|
    int customerId;
    int restaurantId;
    string deliveryAddress;
    OrderItemRequest[] items;
|};

type MenuItemData record {|
    int id;
    decimal price;
    int stockQuantity;
    boolean available;
|};

type OrderResponse record {|
    int id;
    int customerId;
    int restaurantId;
    string deliveryAddress;
    string status;
    decimal totalAmount;
    int version;
|};

type OrderCreatedEvent readonly & record {|
    string eventId;
    string eventType;
    int orderId;
    int customerId;
    int restaurantId;
    decimal totalAmount;
|};

type DbCheckResult record {|
    int result;
|};

function createOrderTransactional(CreateOrderRequest orderRequest)
        returns OrderResponse|error {

    int orderId = 0;
    decimal totalAmount = 0.0d;

    transaction {

        foreach OrderItemRequest item in orderRequest.items {

            MenuItemData|error menuResult = dbClient->queryRow(
                `SELECT
                    id,
                    price,
                    stock_quantity AS stockQuantity,
                    available
                 FROM menu_items
                 WHERE id = ${item.menuItemId}
                   AND restaurant_id = ${orderRequest.restaurantId}
                 FOR UPDATE`
            );

            if menuResult is error {
                fail error(
                    string `MENU_ITEM_NOT_FOUND: ${item.menuItemId}`
                );
            }

            if !menuResult.available {
                fail error(
                    string `MENU_ITEM_UNAVAILABLE: ${item.menuItemId}`
                );
            }

            if menuResult.stockQuantity < item.quantity {
                fail error(
                    string `INSUFFICIENT_STOCK: ${item.menuItemId}`
                );
            }

            decimal quantity = <decimal>item.quantity;
            totalAmount += menuResult.price * quantity;
        }

        var insertResult = check dbClient->execute(
            `INSERT INTO orders
                (
                    customer_id,
                    restaurant_id,
                    delivery_address,
                    status,
                    total_amount
                )
             VALUES
                (
                    ${orderRequest.customerId},
                    ${orderRequest.restaurantId},
                    ${orderRequest.deliveryAddress},
                    'CREATED',
                    ${totalAmount}
                )`
        );

        int|string? generatedId = insertResult.lastInsertId;

        if generatedId is int {
            orderId = generatedId;
        } else {
            fail error("INVALID_GENERATED_ORDER_ID");
        }

        foreach OrderItemRequest item in orderRequest.items {

            MenuItemData|error menuResult = dbClient->queryRow(
                `SELECT
                    id,
                    price,
                    stock_quantity AS stockQuantity,
                    available
                 FROM menu_items
                 WHERE id = ${item.menuItemId}
                   AND restaurant_id = ${orderRequest.restaurantId}`
            );

            if menuResult is error {
                fail error(
                    string `MENU_ITEM_NOT_FOUND: ${item.menuItemId}`
                );
            }

            var stockResult = check dbClient->execute(
                `UPDATE menu_items
                 SET stock_quantity = stock_quantity - ${item.quantity},
                     version = version + 1
                 WHERE id = ${item.menuItemId}
                   AND restaurant_id = ${orderRequest.restaurantId}
                   AND available = TRUE
                   AND stock_quantity >= ${item.quantity}`
            );

            int? affectedRows = stockResult.affectedRowCount;

            if affectedRows is int {
                if affectedRows != 1 {
                    fail error(
                        string `STOCK_CONFLICT: ${item.menuItemId}`
                    );
                }
            } else {
                fail error(
                    string `STOCK_UPDATE_FAILED: ${item.menuItemId}`
                );
            }

            _ = check dbClient->execute(
                `INSERT INTO order_items
                    (
                        order_id,
                        menu_item_id,
                        quantity,
                        unit_price
                    )
                 VALUES
                    (
                        ${orderId},
                        ${item.menuItemId},
                        ${item.quantity},
                        ${menuResult.price}
                    )`
            );
        }

        _ = check dbClient->execute(
            `INSERT INTO order_status_history
                (
                    order_id,
                    old_status,
                    new_status
                )
             VALUES
                (
                    ${orderId},
                    NULL,
                    'CREATED'
                )`
        );

        check commit;
    }

    return {
        id: orderId,
        customerId: orderRequest.customerId,
        restaurantId: orderRequest.restaurantId,
        deliveryAddress: orderRequest.deliveryAddress,
        status: "CREATED",
        totalAmount: totalAmount,
        version: 0
    };
}

function publishOrderCreatedEvent(OrderResponse createdOrder)
        returns error? {

    OrderCreatedEvent event = {
        eventId: uuid:createType4AsString(),
        eventType: "orders.created",
        orderId: createdOrder.id,
        customerId: createdOrder.customerId,
        restaurantId: createdOrder.restaurantId,
        totalAmount: createdOrder.totalAmount
    };

    string eventJson = event.toJsonString();

    check kafkaProducer->send({
        topic: "orders.created",
        key: createdOrder.id.toString().toBytes(),
        value: eventJson.toBytes()
    });
}

function cancelOrderTransactional(int orderId)
        returns CancelOrderResult|error {

    string oldStatus = "";

    transaction {

        CancelOrderData|error orderResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    restaurant_id AS restaurantId,
                    status,
                    version
                 FROM orders
                 WHERE id = ${orderId}
                 FOR UPDATE`
            );

        if orderResult is error {
            fail error("ORDER_NOT_FOUND");
        }

        if orderResult.status != "CONFIRMED" &&
                orderResult.status != "PREPARING" {

            fail error(
                string `ORDER_CANNOT_BE_CANCELLED_FROM_${orderResult.status}`
            );
        }

        oldStatus = orderResult.status;

        // Restore inventory for every item in the cancelled order.
        _ = check dbClient->execute(
            `UPDATE menu_items mi
             JOIN order_items oi
               ON oi.menu_item_id = mi.id
             SET
                 mi.stock_quantity =
                     mi.stock_quantity + oi.quantity,
                 mi.version = mi.version + 1
             WHERE oi.order_id = ${orderId}`
        );

        // Safely move the order to CANCELLED.
        var updateResult = check dbClient->execute(
            `UPDATE orders
             SET
                 status = 'CANCELLED',
                 version = version + 1
             WHERE id = ${orderId}
               AND status = ${oldStatus}
               AND version = ${orderResult.version}`
        );

        int? affectedRows = updateResult.affectedRowCount;

        if affectedRows is int {
            if affectedRows != 1 {
                fail error(
                    string `ORDER_STATE_CONFLICT: ${orderId}`
                );
            }
        } else {
            fail error(
                string `ORDER_CANCEL_UPDATE_FAILED: ${orderId}`
            );
        }

        // Keep lifecycle history.
        _ = check dbClient->execute(
            `INSERT INTO order_status_history
                (
                    order_id,
                    old_status,
                    new_status
                )
             VALUES
                (
                    ${orderId},
                    ${oldStatus},
                    'CANCELLED'
                )`
        );

        check commit;
    }

    return {
        orderId: orderId,
        oldStatus: oldStatus,
        status: "CANCELLED"
    };
}

function publishOrderCancelledEvent(
        CancelOrderResult cancelledOrder)
        returns error? {

    OrderCancelledEvent event = {
        eventId: uuid:createType4AsString(),
        eventType: "orders.cancelled",
        orderId: cancelledOrder.orderId,
        oldStatus: cancelledOrder.oldStatus,
        newStatus: cancelledOrder.status
    };

    string eventJson = event.toJsonString();

    check kafkaProducer->send({
        topic: "orders.cancelled",
        key: cancelledOrder.orderId.toString().toBytes(),
        value: eventJson.toBytes()
    });

    io:println(
        "Order ",
        cancelledOrder.orderId,
        " cancelled from ",
        cancelledOrder.oldStatus
    );
}

function processPaymentCompletedEvent(PaymentCompletedEvent paymentEvent)
        returns error? {

    // ---------------------------------------------
    // IDEMPOTENCY CHECK
    // ---------------------------------------------

    int processedCount = check dbClient->queryRow(
        `SELECT COUNT(*)
         FROM processed_events
         WHERE event_id = ${paymentEvent.eventId}
           AND service_name = 'order-service'`
    );

    if processedCount > 0 {
        io:println(
            "Duplicate payments.completed event ignored: ",
            paymentEvent.eventId
        );
        return;
    }

    // ---------------------------------------------
    // UPDATE ORDER SAFELY
    // CREATED → CONFIRMED
    // ---------------------------------------------

    transaction {

        var updateResult = check dbClient->execute(
            `UPDATE orders
             SET status = 'CONFIRMED',
                 version = version + 1
             WHERE id = ${paymentEvent.orderId}
               AND status = 'CREATED'`
        );

        int? affectedRows = updateResult.affectedRowCount;

        if affectedRows is int {
            if affectedRows != 1 {
                fail error(
                    string `ORDER_STATE_CONFLICT: ${paymentEvent.orderId}`
                );
            }
        } else {
            fail error(
                string `ORDER_UPDATE_FAILED: ${paymentEvent.orderId}`
            );
        }

        _ = check dbClient->execute(
            `INSERT INTO order_status_history
                (
                    order_id,
                    old_status,
                    new_status
                )
             VALUES
                (
                    ${paymentEvent.orderId},
                    'CREATED',
                    'CONFIRMED'
                )`
        );

        _ = check dbClient->execute(
            `INSERT INTO processed_events
                (
                    event_id,
                    service_name,
                    topic_name
                )
             VALUES
                (
                    ${paymentEvent.eventId},
                    'order-service',
                    'payments.completed'
                )`
        );

        check commit;
    }

    io:println(
        "Order ",
        paymentEvent.orderId,
        " updated to CONFIRMED"
    );
}

type DeliveryEvent record {|
    string eventId;
    string eventType;
    int deliveryId;
    int orderId;
    int driverId;
    string status;
|};

kafka:ConsumerConfiguration paymentConsumerConfiguration = {
    groupId: "order-service-payment-group",
    topics: ["payments.completed"],
    offsetReset: kafka:OFFSET_RESET_EARLIEST,
    autoCommit: false
};

listener kafka:Listener paymentCompletedListener = new (
    kafkaBootstrapServers,
    paymentConsumerConfiguration
);

kafka:ConsumerConfiguration deliveryConsumerConfiguration = {
    groupId: "order-service-delivery-group",
    topics: ["delivery.assigned", "delivery.completed"],
    offsetReset: kafka:OFFSET_RESET_LATEST,
    autoCommit: false
};

listener kafka:Listener deliveryEventListener = new (
    kafkaBootstrapServers,
    deliveryConsumerConfiguration
);

function processDeliveryEvent(DeliveryEvent deliveryEvent)
        returns error? {

    int processedCount = check dbClient->queryRow(
        `SELECT COUNT(*)
         FROM processed_events
         WHERE event_id = ${deliveryEvent.eventId}
           AND service_name = 'order-service'`
    );

    if processedCount > 0 {
        io:println(
            "Duplicate delivery event ignored: ",
            deliveryEvent.eventId
        );
        return;
    }

    string oldStatus;
    string newStatus;

    if deliveryEvent.eventType == "delivery.assigned" {

        oldStatus = "READY";
        newStatus = "OUT_FOR_DELIVERY";

    } else if deliveryEvent.eventType == "delivery.completed" {

        oldStatus = "OUT_FOR_DELIVERY";
        newStatus = "DELIVERED";

    } else {
        return error(
            string `UNSUPPORTED_DELIVERY_EVENT: ${deliveryEvent.eventType}`
        );
    }

    transaction {

        var updateResult = check dbClient->execute(
            `UPDATE orders
             SET status = ${newStatus},
                 version = version + 1
             WHERE id = ${deliveryEvent.orderId}
               AND status = ${oldStatus}`
        );

        int? affectedRows =
            updateResult.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {
                fail error(
                    string `ORDER_STATE_CONFLICT: order ${deliveryEvent.orderId} expected ${oldStatus}`
                );
            }

        } else {
            fail error(
                string `ORDER_UPDATE_FAILED: ${deliveryEvent.orderId}`
            );
        }

        _ = check dbClient->execute(
            `INSERT INTO order_status_history
                (
                    order_id,
                    old_status,
                    new_status
                )
             VALUES
                (
                    ${deliveryEvent.orderId},
                    ${oldStatus},
                    ${newStatus}
                )`
        );

        _ = check dbClient->execute(
            `INSERT INTO processed_events
                (
                    event_id,
                    service_name,
                    topic_name
                )
             VALUES
                (
                    ${deliveryEvent.eventId},
                    'order-service',
                    ${deliveryEvent.eventType}
                )`
        );

        check commit;
    }

    io:println(
        "Order ",
        deliveryEvent.orderId,
        " updated from ",
        oldStatus,
        " to ",
        newStatus
    );
}

service /orders on new http:Listener(8083) {



    resource function get health() returns json {
        return {
            "service": "order-service",
            "status": "UP"
        };
    }

    resource function get dbcheck() returns json|error {
        DbCheckResult result = check dbClient->queryRow(
            `SELECT 1 AS result`
        );

        return {
            "database": "CONNECTED",
            "result": result.result
        };
    }

    resource function post .(@http:Payload CreateOrderRequest orderRequest)
            returns OrderResponse|
                    http:BadRequest|
                    http:NotFound|
                    http:Conflict|
                    http:InternalServerError {

        if orderRequest.customerId <= 0 {
            http:BadRequest response = {
                body: {
                    message: "customerId must be greater than zero"
                }
            };
            return response;
        }

        if orderRequest.restaurantId <= 0 {
            http:BadRequest response = {
                body: {
                    message: "restaurantId must be greater than zero"
                }
            };
            return response;
        }

        if orderRequest.deliveryAddress.trim().length() == 0 {
            http:BadRequest response = {
                body: {
                    message: "deliveryAddress is required"
                }
            };
            return response;
        }

        if orderRequest.deliveryAddress.length() > 255 {
            http:BadRequest response = {
                body: {
                    message: "deliveryAddress cannot exceed 255 characters"
                }
            };
            return response;
        }

        if orderRequest.items.length() == 0 {
            http:BadRequest response = {
                body: {
                    message: "At least one order item is required"
                }
            };
            return response;
        }

        foreach OrderItemRequest item in orderRequest.items {

            if item.menuItemId <= 0 || item.quantity <= 0 {
                http:BadRequest response = {
                    body: {
                        message: "menuItemId and quantity must be greater than zero"
                    }
                };
                return response;
            }
        }

        int|error customerResult = dbClient->queryRow(
            `SELECT COUNT(*)
             FROM customers
             WHERE id = ${orderRequest.customerId}`
        );

        if customerResult is error {
            http:InternalServerError response = {
                body: {
                    message: "Failed to validate customer"
                }
            };
            return response;
        }

        if customerResult == 0 {
            http:NotFound response = {
                body: {
                    message: "Customer not found"
                }
            };
            return response;
        }

        int|error restaurantResult = dbClient->queryRow(
            `SELECT COUNT(*)
             FROM restaurants
             WHERE id = ${orderRequest.restaurantId}
               AND active = TRUE`
        );

        if restaurantResult is error {
            http:InternalServerError response = {
                body: {
                    message: "Failed to validate restaurant"
                }
            };
            return response;
        }

        if restaurantResult == 0 {
            http:NotFound response = {
                body: {
                    message: "Restaurant not found or inactive"
                }
            };
            return response;
        }

        OrderResponse|error result =
            createOrderTransactional(orderRequest);

        if result is error {
            http:Conflict response = {
                body: {
                    message: result.message()
                }
            };
            return response;
        }

        error? kafkaResult = publishOrderCreatedEvent(result);

        if kafkaResult is error {
            http:InternalServerError response = {
                body: {
                    message: "Order created but Kafka event publishing failed"
                }
            };
            return response;
        }

        return result;
    }

    resource function put [int orderId]/cancel()
        returns json|
            http:NotFound|
            http:Conflict|
            http:InternalServerError {

    CancelOrderResult|error cancelResult =
        cancelOrderTransactional(orderId);

    if cancelResult is error {

        string message = cancelResult.message();

        if message == "ORDER_NOT_FOUND" {

            http:NotFound response = {
                body: {
                    message: "Order not found"
                }
            };

            return response;
        }

        if message.startsWith(
                "ORDER_CANNOT_BE_CANCELLED_FROM_") ||
                message.startsWith(
                    "ORDER_STATE_CONFLICT") {

            http:Conflict response = {
                body: {
                    message: message
                }
            };

            return response;
        }

        http:InternalServerError response = {
            body: {
                message: message
            }
        };

        return response;
    }

    error? kafkaResult =
        publishOrderCancelledEvent(cancelResult);

    if kafkaResult is error {

        http:InternalServerError response = {
            body: {
                message:
                    "Order cancelled but Kafka event publishing failed"
            }
        };

        return response;
    }

    return {
        orderId: cancelResult.orderId,
        previousStatus: cancelResult.oldStatus,
        status: cancelResult.status,
        message: "Order cancelled successfully"
    };
}
}

service on paymentCompletedListener {

    remote function onConsumerRecord(
            kafka:Caller caller,
            kafka:BytesConsumerRecord[] records) {

        foreach kafka:BytesConsumerRecord kafkaRecord in records {

            string|error messageResult =
                string:fromBytes(kafkaRecord.value);

            if messageResult is error {
                io:println(
                    "Failed to decode payments.completed message"
                );
                continue;
            }

            json|error jsonResult =
                messageResult.fromJsonString();

            if jsonResult is error {
                io:println(
                    "Invalid payments.completed JSON: ",
                    jsonResult.message()
                );
                continue;
            }

            PaymentCompletedEvent|error eventResult =
                jsonResult.cloneWithType();

            if eventResult is error {
                io:println(
                    "Invalid payments.completed structure: ",
                    eventResult.message()
                );
                continue;
            }

            error? processResult =
                processPaymentCompletedEvent(eventResult);

            if processResult is error {
                io:println(
                    "Failed to update order after payment: ",
                    processResult.message()
                );
                continue;
            }
        }

        kafka:Error? commitResult = caller->'commit();

        if commitResult is kafka:Error {
            io:println(
                "Failed to commit payments.completed offset: ",
                commitResult.message()
            );
        }
    }
}

service on deliveryEventListener {

    remote function onConsumerRecord(
            kafka:Caller caller,
            kafka:BytesConsumerRecord[] records) {

        boolean processingSucceeded = true;

        foreach kafka:BytesConsumerRecord kafkaRecord in records {

            string|error messageResult =
                string:fromBytes(kafkaRecord.value);

            if messageResult is error {
                io:println(
                    "Failed to decode delivery event"
                );

                processingSucceeded = false;
                continue;
            }

            io:println(
                "Order Service received delivery event: ",
                messageResult
            );

            json|error jsonResult =
                messageResult.fromJsonString();

            if jsonResult is error {
                io:println(
                    "Invalid delivery event JSON: ",
                    jsonResult.message()
                );

                processingSucceeded = false;
                continue;
            }

            DeliveryEvent|error eventResult =
                jsonResult.cloneWithType();

            if eventResult is error {
                io:println(
                    "Invalid delivery event structure: ",
                    eventResult.message()
                );

                processingSucceeded = false;
                continue;
            }

            error? processResult =
                processDeliveryEvent(eventResult);

            if processResult is error {
                io:println(
                    "Failed to process delivery event: ",
                    processResult.message()
                );

                processingSucceeded = false;
                continue;
            }
        }

        if processingSucceeded {

            kafka:Error? commitResult =
                caller->'commit();

            if commitResult is kafka:Error {
                io:println(
                    "Failed to commit delivery event offset: ",
                    commitResult.message()
                );
            }

        } else {

            io:println(
                "Delivery event Kafka offset not committed because processing failed"
            );
        }
    }
}