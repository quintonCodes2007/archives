import ballerina/http;
import ballerina/io;
import ballerina/uuid;
import ballerinax/kafka;
import ballerina/sql;
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


// =====================================================
// TYPES
// =====================================================

type MenuItem record {|
    int id;
    int restaurantId;
    string name;
    string? description;
    decimal price;
    int stockQuantity;
    boolean available;
    int version;
|};

type OpeningHoursRequest record {|
    string openTime;
    string closeTime;
    boolean closed = false;
|};

type RestaurantHoursRow record {|
    int dayOfWeek;
    string? openTime;
    string? closeTime;
    boolean closed;
|};

type InventoryUpdateRequest record {|
    int stockQuantity;
    boolean available;
|};

type OrderState record {|
    int id;
    int restaurantId;
    string status;
    int version;
|};

type OrderStatusEvent readonly & record {|
    string eventId;
    string eventType;
    int orderId;
    int restaurantId;
    string oldStatus;
    string newStatus;
|};


// =====================================================
// PUBLISH ORDER STATUS EVENT
// =====================================================

function publishOrderStatusEvent(
        int orderId,
        int restaurantId,
        string oldStatus,
        string newStatus) returns error? {

    OrderStatusEvent event = {
        eventId: uuid:createType4AsString(),
        eventType: "orders.status.updated",
        orderId: orderId,
        restaurantId: restaurantId,
        oldStatus: oldStatus,
        newStatus: newStatus
    };

    string eventJson = event.toJsonString();

    check kafkaProducer->send({
        topic: "orders.status.updated",
        key: orderId.toString().toBytes(),
        value: eventJson.toBytes()
    });

    io:println(
        "Published order status event: order ",
        orderId,
        " ",
        oldStatus,
        " -> ",
        newStatus
    );
}


// =====================================================
// ORDER STATUS TRANSACTION
// =====================================================

function updateOrderStatusTransactional(
        int orderId,
        int restaurantId,
        string expectedStatus,
        string newStatus) returns error? {

    transaction {

        var updateResult = check dbClient->execute(
            `UPDATE orders
             SET status = ${newStatus},
                 version = version + 1
             WHERE id = ${orderId}
               AND restaurant_id = ${restaurantId}
               AND status = ${expectedStatus}`
        );

        int? affectedRows = updateResult.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {
                fail error(
                    string `ORDER_STATE_CONFLICT: expected ${expectedStatus}`
                );
            }

        } else {
            fail error("ORDER_UPDATE_FAILED");
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
                    ${expectedStatus},
                    ${newStatus}
                )`
        );

        check commit;
    }
}


// =====================================================
// RESTAURANT HTTP SERVICE
// =====================================================

service /restaurants on new http:Listener(8082) {

    resource function get [int restaurantId]/hours()
        returns json|
            http:NotFound|
            http:InternalServerError {

    int|error restaurantCount = dbClient->queryRow(
        `SELECT COUNT(*)
         FROM restaurants
         WHERE id = ${restaurantId}`
    );

    if restaurantCount is error {
        http:InternalServerError response = {
            body: {
                message: "Failed to validate restaurant"
            }
        };

        return response;
    }

    if restaurantCount == 0 {
        http:NotFound response = {
            body: {
                message: "Restaurant not found"
            }
        };

        return response;
    }

    stream<RestaurantHoursRow, sql:Error?> hoursStream =
        dbClient->query(
            `SELECT
                day_of_week AS dayOfWeek,
                TIME_FORMAT(open_time, '%H:%i') AS openTime,
                TIME_FORMAT(close_time, '%H:%i') AS closeTime,
                closed
             FROM restaurant_hours
             WHERE restaurant_id = ${restaurantId}
             ORDER BY day_of_week`,
            RestaurantHoursRow
        );

    RestaurantHoursRow[] hours = [];

    error? streamResult = hoursStream.forEach(
        function(RestaurantHoursRow row) {
            hours.push(row);
        }
    );

    if streamResult is error {
        http:InternalServerError response = {
            body: {
                message: "Failed to retrieve restaurant opening hours"
            }
        };

        return response;
    }

    return {
        restaurantId: restaurantId,
        hours: hours
    };
}
    resource function put [int restaurantId]/hours/[int dayOfWeek](
        @http:Payload OpeningHoursRequest hoursRequest)
        returns json|
            http:BadRequest|
            http:NotFound|
            http:InternalServerError {

    if dayOfWeek < 0 || dayOfWeek > 6 {
        http:BadRequest response = {
            body: {
                message: "dayOfWeek must be between 0 and 6"
            }
        };

        return response;
    }

    if !hoursRequest.closed {
        if hoursRequest.openTime.trim().length() == 0 ||
                hoursRequest.closeTime.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message:
                        "openTime and closeTime are required when the restaurant is open"
                }
            };

            return response;
        }
    }

    int|error restaurantCount = dbClient->queryRow(
        `SELECT COUNT(*)
         FROM restaurants
         WHERE id = ${restaurantId}`
    );

    if restaurantCount is error {
        http:InternalServerError response = {
            body: {
                message: "Failed to validate restaurant"
            }
        };

        return response;
    }

    if restaurantCount == 0 {
        http:NotFound response = {
            body: {
                message: "Restaurant not found"
            }
        };

        return response;
    }

    string? openTime = hoursRequest.closed
        ? ()
        : hoursRequest.openTime;

    string? closeTime = hoursRequest.closed
        ? ()
        : hoursRequest.closeTime;

    var updateResult = dbClient->execute(
        `INSERT INTO restaurant_hours
            (
                restaurant_id,
                day_of_week,
                open_time,
                close_time,
                closed
            )
         VALUES
            (
                ${restaurantId},
                ${dayOfWeek},
                ${openTime},
                ${closeTime},
                ${hoursRequest.closed}
            )
         ON DUPLICATE KEY UPDATE
            open_time = ${openTime},
            close_time = ${closeTime},
            closed = ${hoursRequest.closed}`
    );

    if updateResult is error {
        http:InternalServerError response = {
            body: {
                message: "Failed to update restaurant opening hours"
            }
        };

        return response;
    }

    return {
        restaurantId: restaurantId,
        dayOfWeek: dayOfWeek,
        openTime: openTime,
        closeTime: closeTime,
        closed: hoursRequest.closed,
        message: "Restaurant opening hours updated"
    };
}

    // -------------------------------------------------
    // HEALTH
    // -------------------------------------------------

    resource function get health() returns json {

        return {
            "service": "restaurant-service",
            "status": "UP"
        };
    }


    // -------------------------------------------------
    // GET RESTAURANT MENU
    // GET /restaurants/{restaurantId}/menu
    // -------------------------------------------------

    resource function get [int restaurantId]/menu()
            returns MenuItem[]|http:NotFound|http:InternalServerError {

        int|error restaurantCount = dbClient->queryRow(
            `SELECT COUNT(*)
             FROM restaurants
             WHERE id = ${restaurantId}
               AND active = TRUE`
        );

        if restaurantCount is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to validate restaurant"
                }
            };

            return response;
        }

        if restaurantCount == 0 {

            http:NotFound response = {
                body: {
                    message: "Restaurant not found"
                }
            };

            return response;
        }

        stream<MenuItem, error?> menuStream =
            dbClient->query(
                `SELECT
                    id,
                    restaurant_id AS restaurantId,
                    name,
                    description,
                    price,
                    stock_quantity AS stockQuantity,
                    available,
                    version
                 FROM menu_items
                 WHERE restaurant_id = ${restaurantId}
                 ORDER BY id`
            );

        MenuItem[] menuItems = [];

        checkpanic from MenuItem menuItem in menuStream
            do {
                menuItems.push(menuItem);
            };

        return menuItems;
    }


    // -------------------------------------------------
    // UPDATE INVENTORY
    // PUT /restaurants/{restaurantId}/menu/{menuItemId}/inventory
    // -------------------------------------------------

    resource function put [int restaurantId]/menu/[int menuItemId]/inventory(
            @http:Payload InventoryUpdateRequest inventoryRequest)
            returns json|
                http:BadRequest|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        if inventoryRequest.stockQuantity < 0 {

            http:BadRequest response = {
                body: {
                    message: "stockQuantity cannot be negative"
                }
            };

            return response;
        }

        var updateResult = dbClient->execute(
            `UPDATE menu_items
             SET stock_quantity = ${inventoryRequest.stockQuantity},
                 available = ${inventoryRequest.available},
                 version = version + 1
             WHERE id = ${menuItemId}
               AND restaurant_id = ${restaurantId}`
        );

        if updateResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to update inventory"
                }
            };

            return response;
        }

        int? affectedRows = updateResult.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {

                http:NotFound response = {
                    body: {
                        message: "Menu item not found"
                    }
                };

                return response;
            }

        } else {

            http:InternalServerError response = {
                body: {
                    message: "Unable to verify inventory update"
                }
            };

            return response;
        }

        return {
            menuItemId: menuItemId,
            restaurantId: restaurantId,
            stockQuantity: inventoryRequest.stockQuantity,
            available: inventoryRequest.available
        };
    }


    // -------------------------------------------------
    // CONFIRMED -> PREPARING
    //
    // PUT /restaurants/{restaurantId}/orders/{orderId}/prepare
    // -------------------------------------------------

    resource function put [int restaurantId]/orders/[int orderId]/prepare()
            returns json|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        OrderState|error orderResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    restaurant_id AS restaurantId,
                    status,
                    version
                 FROM orders
                 WHERE id = ${orderId}
                   AND restaurant_id = ${restaurantId}`
            );

        if orderResult is error {

            http:NotFound response = {
                body: {
                    message: "Order not found for this restaurant"
                }
            };

            return response;
        }

        if orderResult.status != "CONFIRMED" {

            http:Conflict response = {
                body: {
                    message: "Order must be CONFIRMED before preparation"
                }
            };

            return response;
        }

        error? updateResult =
            updateOrderStatusTransactional(
                orderId,
                restaurantId,
                "CONFIRMED",
                "PREPARING"
            );

        if updateResult is error {

            http:Conflict response = {
                body: {
                    message: updateResult.message()
                }
            };

            return response;
        }

        error? kafkaResult =
            publishOrderStatusEvent(
                orderId,
                restaurantId,
                "CONFIRMED",
                "PREPARING"
            );

        if kafkaResult is error {

            http:InternalServerError response = {
                body: {
                    message:
                        "Order updated but Kafka event publishing failed"
                }
            };

            return response;
        }

        return {
            orderId: orderId,
            restaurantId: restaurantId,
            status: "PREPARING"
        };
    }


    // -------------------------------------------------
    // PREPARING -> READY
    //
    // PUT /restaurants/{restaurantId}/orders/{orderId}/ready
    // -------------------------------------------------

    resource function put [int restaurantId]/orders/[int orderId]/ready()
            returns json|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        OrderState|error orderResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    restaurant_id AS restaurantId,
                    status,
                    version
                 FROM orders
                 WHERE id = ${orderId}
                   AND restaurant_id = ${restaurantId}`
            );

        if orderResult is error {

            http:NotFound response = {
                body: {
                    message: "Order not found for this restaurant"
                }
            };

            return response;
        }

        if orderResult.status != "PREPARING" {

            http:Conflict response = {
                body: {
                    message: "Order must be PREPARING before it can be READY"
                }
            };

            return response;
        }

        error? updateResult =
            updateOrderStatusTransactional(
                orderId,
                restaurantId,
                "PREPARING",
                "READY"
            );

        if updateResult is error {

            http:Conflict response = {
                body: {
                    message: updateResult.message()
                }
            };

            return response;
        }

        error? kafkaResult =
            publishOrderStatusEvent(
                orderId,
                restaurantId,
                "PREPARING",
                "READY"
            );

        if kafkaResult is error {

            http:InternalServerError response = {
                body: {
                    message:
                        "Order updated but Kafka event publishing failed"
                }
            };

            return response;
        }

        return {
            orderId: orderId,
            restaurantId: restaurantId,
            status: "READY"
        };
    }
}