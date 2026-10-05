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

type OrderStatusEvent record {|
    string eventId;
    string eventType;
    int orderId;
    int restaurantId;
    string oldStatus;
    string newStatus;
|};

type OrderCancelledEvent record {|
    string eventId;
    string eventType;
    int orderId;
    string oldStatus;
    string newStatus;
|};

type DeliveryAssignedEvent record {|
    string eventId;
    string eventType;
    int deliveryId;
    int orderId;
    int driverId;
    string status;
|};

type DeliveryCompletedEvent record {|
    string eventId;
    string eventType;
    int deliveryId;
    int orderId;
    int driverId;
    string status;
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

type OrderInfo record {|
    int customerId;
    int restaurantId;
|};

kafka:ConsumerConfiguration notificationConsumerConfiguration = {
    groupId: "notification-service-group",
    topics: [
        "payments.completed",
        "orders.status.updated",
        "delivery.assigned",
        "delivery.completed",
        "orders.cancelled"
    ],
    offsetReset: kafka:OFFSET_RESET_LATEST,
    autoCommit: false
};

listener kafka:Listener notificationListener = new (
    kafkaBootstrapServers,
    notificationConsumerConfiguration
);

function notificationAlreadyProcessed(string eventId)
        returns boolean|error {

    int count = check dbClient->queryRow(
        `SELECT COUNT(*)
         FROM processed_events
         WHERE event_id = ${eventId}
           AND service_name = 'notification-service'`
    );

    return count > 0;
}

function markEventProcessed(
        string eventId,
        string topicName) returns error? {

    _ = check dbClient->execute(
        `INSERT IGNORE INTO processed_events
            (
                event_id,
                service_name,
                topic_name
            )
         VALUES
            (
                ${eventId},
                'notification-service',
                ${topicName}
            )`
    );
}

function getOrderInfo(int orderId)
        returns OrderInfo|error {

    return check dbClient->queryRow(
        `SELECT
            customer_id AS customerId,
            restaurant_id AS restaurantId
         FROM orders
         WHERE id = ${orderId}`
    );
}

function createCustomerNotification(
        int orderId,
        int customerId,
        string eventType,
        string message) returns error? {

    string[] channels = [
        "SYSTEM",
        "EMAIL",
        "SMS"
    ];

    foreach string channel in channels {

        _ = check dbClient->execute(
            `INSERT INTO notifications
                (
                    order_id,
                    recipient_type,
                    customer_id,
                    channel,
                    event_type,
                    message,
                    status
                )
             VALUES
                (
                    ${orderId},
                    'CUSTOMER',
                    ${customerId},
                    ${channel},
                    ${eventType},
                    ${message},
                    'SENT'
                )`
        );
    }
}

function createRestaurantNotification(
        int orderId,
        int restaurantId,
        string eventType,
        string message) returns error? {

    string[] channels = [
        "SYSTEM",
        "EMAIL",
        "SMS"
    ];

    foreach string channel in channels {

        _ = check dbClient->execute(
            `INSERT INTO notifications
                (
                    order_id,
                    recipient_type,
                    restaurant_id,
                    channel,
                    event_type,
                    message,
                    status
                )
             VALUES
                (
                    ${orderId},
                    'RESTAURANT',
                    ${restaurantId},
                    ${channel},
                    ${eventType},
                    ${message},
                    'SENT'
                )`
        );
    }
}

function createDriverNotification(
        int orderId,
        int driverId,
        string eventType,
        string message) returns error? {

    string[] channels = [
        "SYSTEM",
        "EMAIL",
        "SMS"
    ];

    foreach string channel in channels {

        _ = check dbClient->execute(
            `INSERT INTO notifications
                (
                    order_id,
                    recipient_type,
                    driver_id,
                    channel,
                    event_type,
                    message,
                    status
                )
             VALUES
                (
                    ${orderId},
                    'DRIVER',
                    ${driverId},
                    ${channel},
                    ${eventType},
                    ${message},
                    'SENT'
                )`
        );
    }
}

function processPaymentCompleted(
        PaymentCompletedEvent event) returns error? {

    boolean processed =
        check notificationAlreadyProcessed(event.eventId);

    if processed {
        io:println(
            "Duplicate notification event ignored: ",
            event.eventId
        );
        return;
    }

    OrderInfo orderInfo =
        check getOrderInfo(event.orderId);

    transaction {

        check createCustomerNotification(
            event.orderId,
            orderInfo.customerId,
            event.eventType,
            string `Payment completed for order ${event.orderId}`
        );

        check createRestaurantNotification(
            event.orderId,
            orderInfo.restaurantId,
            event.eventType,
            string `Payment confirmed for order ${event.orderId}`
        );

        check markEventProcessed(
            event.eventId,
            "payments.completed"
        );

        check commit;
    }

    io:println(
        "Notifications created for payment on order ",
        event.orderId
    );
}

function processOrderStatus(
        OrderStatusEvent event) returns error? {

    boolean processed =
        check notificationAlreadyProcessed(event.eventId);

    if processed {
        io:println(
            "Duplicate notification event ignored: ",
            event.eventId
        );
        return;
    }

    OrderInfo orderInfo =
        check getOrderInfo(event.orderId);

    transaction {

        check createCustomerNotification(
            event.orderId,
            orderInfo.customerId,
            event.eventType,
            string `Order ${event.orderId} changed from ${event.oldStatus} to ${event.newStatus}`
        );

        check markEventProcessed(
            event.eventId,
            "orders.status.updated"
        );

        check commit;
    }

    io:println(
        "Customer notified about order status: ",
        event.orderId,
        " ",
        event.oldStatus,
        " -> ",
        event.newStatus
    );
}

function processOrderCancelled(
        OrderCancelledEvent event) returns error? {

    boolean processed =
        check notificationAlreadyProcessed(event.eventId);

    if processed {
        io:println(
            "Duplicate notification event ignored: ",
            event.eventId
        );

        return;
    }

    OrderInfo orderInfo =
        check getOrderInfo(event.orderId);

    transaction {

        check createCustomerNotification(
            event.orderId,
            orderInfo.customerId,
            event.eventType,
            string `Order ${event.orderId} has been cancelled`
        );

        check createRestaurantNotification(
            event.orderId,
            orderInfo.restaurantId,
            event.eventType,
            string `Order ${event.orderId} has been cancelled`
        );

        check markEventProcessed(
            event.eventId,
            "orders.cancelled"
        );

        check commit;
    }

    io:println(
        "Cancellation notifications created for order ",
        event.orderId
    );
}

function processDeliveryAssigned(
        DeliveryAssignedEvent event) returns error? {

    boolean processed =
        check notificationAlreadyProcessed(event.eventId);

    if processed {
        io:println(
            "Duplicate notification event ignored: ",
            event.eventId
        );
        return;
    }

    OrderInfo orderInfo =
        check getOrderInfo(event.orderId);

    transaction {

        check createCustomerNotification(
            event.orderId,
            orderInfo.customerId,
            event.eventType,
            string `A driver has been assigned to order ${event.orderId}`
        );

        check createDriverNotification(
            event.orderId,
            event.driverId,
            event.eventType,
            string `You have been assigned to order ${event.orderId}`
        );

        check markEventProcessed(
            event.eventId,
            "delivery.assigned"
        );

        check commit;
    }

    io:println(
        "Delivery assignment notifications created for order ",
        event.orderId
    );
}

function processDeliveryCompleted(
        DeliveryCompletedEvent event) returns error? {

    boolean processed =
        check notificationAlreadyProcessed(event.eventId);

    if processed {
        io:println(
            "Duplicate notification event ignored: ",
            event.eventId
        );
        return;
    }

    OrderInfo orderInfo =
        check getOrderInfo(event.orderId);

    transaction {

        check createCustomerNotification(
            event.orderId,
            orderInfo.customerId,
            event.eventType,
            string `Order ${event.orderId} has been delivered`
        );

        check createRestaurantNotification(
            event.orderId,
            orderInfo.restaurantId,
            event.eventType,
            string `Order ${event.orderId} delivery completed`
        );

        check markEventProcessed(
            event.eventId,
            "delivery.completed"
        );

        check commit;
    }

    io:println(
        "Delivery completion notifications created for order ",
        event.orderId
    );
}

service on notificationListener {

    remote function onConsumerRecord(
            kafka:Caller caller,
            kafka:BytesConsumerRecord[] records) {

        boolean processingSucceeded = true;

        foreach kafka:BytesConsumerRecord kafkaRecord in records {

            string|error messageResult =
                string:fromBytes(kafkaRecord.value);

            if messageResult is error {
                io:println("Failed to decode Kafka event");
                processingSucceeded = false;
                continue;
            }

            json|error jsonResult =
                messageResult.fromJsonString();

            if jsonResult is error {
                io:println(
                    "Invalid Kafka JSON: ",
                    jsonResult.message()
                );
                processingSucceeded = false;
                continue;
            }

json|error eventTypeResult = jsonResult.eventType;

if eventTypeResult is error {
    io:println("Kafka event missing eventType");
    processingSucceeded = false;
    continue;
}

if eventTypeResult is string {
    string eventType = eventTypeResult;

    error? processResult;

if eventType == "payments.completed" {

    PaymentCompletedEvent|error eventResult =
        jsonResult.cloneWithType();

    if eventResult is error {
        io:println(
            "Invalid payment event: ",
            eventResult.message()
        );

        processingSucceeded = false;
        continue;
    }

    processResult =
        processPaymentCompleted(eventResult);

} else if eventType == "orders.status.updated" {

    OrderStatusEvent|error eventResult =
        jsonResult.cloneWithType();

    if eventResult is error {
        io:println(
            "Invalid order status event: ",
            eventResult.message()
        );

        processingSucceeded = false;
        continue;
    }

    processResult =
        processOrderStatus(eventResult);

} else if eventType == "delivery.assigned" {

    DeliveryAssignedEvent|error eventResult =
        jsonResult.cloneWithType();

    if eventResult is error {
        io:println(
            "Invalid delivery assigned event: ",
            eventResult.message()
        );

        processingSucceeded = false;
        continue;
    }

    processResult =
        processDeliveryAssigned(eventResult);

} else if eventType == "delivery.completed" {

    DeliveryCompletedEvent|error eventResult =
        jsonResult.cloneWithType();

    if eventResult is error {
        io:println(
            "Invalid delivery completed event: ",
            eventResult.message()
        );

        processingSucceeded = false;
        continue;
    }

    processResult =
        processDeliveryCompleted(eventResult);

} else if eventType == "orders.cancelled" {

    OrderCancelledEvent|error eventResult =
        jsonResult.cloneWithType();

    if eventResult is error {
        io:println(
            "Invalid order cancelled event: ",
            eventResult.message()
        );

        processingSucceeded = false;
        continue;
    }

    processResult =
        processOrderCancelled(eventResult);

} else {

    io:println(
        "Notification Service ignoring event type: ",
        eventType
    );

    continue;
}

if processResult is error {

    io:println(
        "Notification processing failed: ",
        processResult.message()
    );

    processingSucceeded = false;
}

} else {

    io:println(
        "Kafka event eventType must be a string"
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
                "Failed to commit notification Kafka offset: ",
                commitResult.message()
            );
        }

    } 
    
    else {

        io:println(
            "Notification Kafka offset not committed because processing failed"
        );
    }
}
}
