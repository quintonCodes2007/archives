import ballerina/http;
import ballerina/io;
import ballerina/uuid;
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


// =====================================================
// TYPES
// =====================================================

type OrderStatusEvent record {|
    string eventId;
    string eventType;
    int orderId;
    int restaurantId;
    string oldStatus;
    string newStatus;
|};

type DriverData record {|
    int id;
    string fullName;
    string status;
    int version;
|};

type DeliveryState record {|
    int id;
    int orderId;
    int driverId;
    string status;
    int version;
|};

type DeliveryAssignedEvent readonly & record {|
    string eventId;
    string eventType;
    int deliveryId;
    int orderId;
    int driverId;
    string status;
|};

type DeliveryCompletedEvent readonly & record {|
    string eventId;
    string eventType;
    int deliveryId;
    int orderId;
    int driverId;
    string status;
|};


// =====================================================
// KAFKA CONFIGURATION
// =====================================================

kafka:ConsumerConfiguration consumerConfiguration = {
    groupId: "delivery-service-ready-group",
    topics: ["orders.status.updated"],
    offsetReset: kafka:OFFSET_RESET_EARLIEST,
    autoCommit: false
};

listener kafka:Listener deliveryListener = new (
    kafkaBootstrapServers,
    consumerConfiguration
);

// =====================================================
// PROCESS PAYMENT COMPLETED
// =====================================================

function processOrderStatusEvent(
        OrderStatusEvent orderEvent) returns error? {

    // Delivery Service only cares when food becomes READY.
    if orderEvent.newStatus != "READY" {
        io:println(
            "Ignoring order status event: ",
            orderEvent.oldStatus,
            " -> ",
            orderEvent.newStatus
        );
        return;
    }

    // -------------------------------------------------
    // IDEMPOTENCY
    // -------------------------------------------------

    int processedCount = check dbClient->queryRow(
        `SELECT COUNT(*)
         FROM processed_events
         WHERE event_id = ${orderEvent.eventId}
           AND service_name = 'delivery-service'`
    );

    if processedCount > 0 {
        io:println(
            "Duplicate READY event ignored: ",
            orderEvent.eventId
        );
        return;
    }

    // -------------------------------------------------
    // DOES A DELIVERY ALREADY EXIST?
    // -------------------------------------------------

    int deliveryCount = check dbClient->queryRow(
        `SELECT COUNT(*)
         FROM deliveries
         WHERE order_id = ${orderEvent.orderId}`
    );


    if deliveryCount > 0 {

        DeliveryState|error existingDelivery = dbClient->queryRow(
            `SELECT
                id,
                order_id AS orderId,
                driver_id AS driverId,
                status,
                version
             FROM deliveries
             WHERE order_id = ${orderEvent.orderId}`
        );

        if existingDelivery is error {
            return error("FAILED_TO_LOAD_EXISTING_DELIVERY");
        }

        if existingDelivery.status == "ASSIGNED" {

            DeliveryAssignedEvent existingEvent = {
                eventId: uuid:createType4AsString(),
                eventType: "delivery.assigned",
                deliveryId: existingDelivery.id,
                orderId: existingDelivery.orderId,
                driverId: existingDelivery.driverId,
                status: "ASSIGNED"
            };

            string existingEventJson =
                existingEvent.toJsonString();

            check kafkaProducer->send({
                topic: "delivery.assigned",
                key: orderEvent.orderId.toString().toBytes(),
                value: existingEventJson.toBytes()
            });

            io:println(
                "Existing delivery ",
                existingDelivery.id,
                " republished for READY order ",
                orderEvent.orderId
            );
        } else {
            io:println(
                "Delivery already exists for order ",
                orderEvent.orderId,
                " with status ",
                existingDelivery.status
            );
        }

        _ = check dbClient->execute(
            `INSERT IGNORE INTO processed_events
                (
                    event_id,
                    service_name,
                    topic_name
                )
             VALUES
                (
                    ${orderEvent.eventId},
                    'delivery-service',
                    'orders.status.updated'
                )`
        );

        return;
    }

    // -------------------------------------------------
    // CREATE A NEW DELIVERY
    // -------------------------------------------------

    int driverId = 0;
    int deliveryId = 0;

    transaction {

        DriverData|error driverResult = dbClient->queryRow(
            `SELECT
                id,
                full_name AS fullName,
                status,
                version
             FROM drivers
             WHERE status = 'AVAILABLE'
             ORDER BY id
             LIMIT 1
             FOR UPDATE`
        );

        if driverResult is error {
            fail error("NO_AVAILABLE_DRIVER");
        }

        driverId = driverResult.id;

        var driverUpdateResult = check dbClient->execute(
            `UPDATE drivers
             SET status = 'ASSIGNED',
                 version = version + 1
             WHERE id = ${driverId}
               AND status = 'AVAILABLE'
               AND version = ${driverResult.version}`
        );

        int? affectedDriverRows =
            driverUpdateResult.affectedRowCount;

        if affectedDriverRows is int {

            if affectedDriverRows != 1 {
                fail error(
                    string `DRIVER_ASSIGNMENT_CONFLICT: ${driverId}`
                );
            }

        } else {
            fail error(
                string `DRIVER_UPDATE_FAILED: ${driverId}`
            );
        }

        var deliveryInsertResult = check dbClient->execute(
            `INSERT INTO deliveries
                (
                    order_id,
                    driver_id,
                    status
                )
             VALUES
                (
                    ${orderEvent.orderId},
                    ${driverId},
                    'ASSIGNED'
                )`
        );

        int|string? generatedId =
            deliveryInsertResult.lastInsertId;

        if generatedId is int {
            deliveryId = generatedId;
        } else {
            fail error("INVALID_GENERATED_DELIVERY_ID");
        }

        _ = check dbClient->execute(
            `INSERT INTO processed_events
                (
                    event_id,
                    service_name,
                    topic_name
                )
             VALUES
                (
                    ${orderEvent.eventId},
                    'delivery-service',
                    'orders.status.updated'
                )`
        );

        check commit;
    }

    // -------------------------------------------------
    // PUBLISH delivery.assigned
    // -------------------------------------------------

    DeliveryAssignedEvent deliveryEvent = {
        eventId: uuid:createType4AsString(),
        eventType: "delivery.assigned",
        deliveryId: deliveryId,
        orderId: orderEvent.orderId,
        driverId: driverId,
        status: "ASSIGNED"
    };

    string eventJson =
        deliveryEvent.toJsonString();

    check kafkaProducer->send({
        topic: "delivery.assigned",
        key: orderEvent.orderId.toString().toBytes(),
        value: eventJson.toBytes()
    });

    io:println(
        "READY order ",
        orderEvent.orderId,
        " assigned to driver ",
        driverId,
        " | deliveryId=",
        deliveryId
    );
}


// =====================================================
// COMPLETE DELIVERY TRANSACTION
// =====================================================

function completeDeliveryTransactional(
        DeliveryState deliveryResult) returns error? {

    transaction {

        var deliveryUpdate = check dbClient->execute(
            `UPDATE deliveries
             SET status = 'DELIVERED',
                 delivered_at = CURRENT_TIMESTAMP,
                 version = version + 1
             WHERE id = ${deliveryResult.id}
               AND status = 'OUT_FOR_DELIVERY'
               AND version = ${deliveryResult.version}`
        );

        int? affectedRows =
            deliveryUpdate.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {
                fail error("DELIVERY_UPDATE_CONFLICT");
            }

        } else {

            fail error("DELIVERY_UPDATE_FAILED");
        }


        var driverUpdate = check dbClient->execute(
            `UPDATE drivers
             SET status = 'AVAILABLE',
                 version = version + 1
             WHERE id = ${deliveryResult.driverId}
               AND status = 'ASSIGNED'`
        );

        int? affectedDriverRows =
            driverUpdate.affectedRowCount;

        if affectedDriverRows is int {

            if affectedDriverRows != 1 {
                fail error("DRIVER_UPDATE_CONFLICT");
            }

        } else {

            fail error("DRIVER_UPDATE_FAILED");
        }


        check commit;
    }
}


// =====================================================
// KAFKA CONSUMER SERVICE
// =====================================================

service on deliveryListener {

    remote function onConsumerRecord(
            kafka:Caller caller,
            kafka:BytesConsumerRecord[] records) {

        boolean processingSucceeded = true;

        foreach kafka:BytesConsumerRecord kafkaRecord in records {

            string|error messageResult =
                string:fromBytes(kafkaRecord.value);

            if messageResult is error {
                io:println(
                    "Failed to decode orders.status.updated event"
                );

                processingSucceeded = false;
                continue;
            }

            io:println(
                "Delivery Service received order status: ",
                messageResult
            );

            json|error jsonResult =
                messageResult.fromJsonString();

            if jsonResult is error {
                io:println(
                    "Invalid orders.status.updated JSON: ",
                    jsonResult.message()
                );

                processingSucceeded = false;
                continue;
            }

            OrderStatusEvent|error eventResult =
                jsonResult.cloneWithType();

            if eventResult is error {
                io:println(
                    "Invalid order status event structure: ",
                    eventResult.message()
                );

                processingSucceeded = false;
                continue;
            }

            error? processResult =
                processOrderStatusEvent(eventResult);

            if processResult is error {
                io:println(
                    "Delivery assignment failed: ",
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
                    "Failed to commit Kafka offset: ",
                    commitResult.message()
                );
            }

        } else {

            io:println(
                "Kafka offset not committed because processing failed"
            );
        }
    }
}


// =====================================================
// DELIVERY HTTP SERVICE
// =====================================================

service /deliveries on new http:Listener(8085) {

    // -------------------------------------------------
    // HEALTH
    // -------------------------------------------------

    resource function get health() returns json {

        return {
            "service": "delivery-service",
            "status": "UP"
        };
    }


    // -------------------------------------------------
    // ASSIGNED -> PICKED_UP
    // -------------------------------------------------

    resource function put [int deliveryId]/pickup()
            returns json|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        DeliveryState|error deliveryResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    order_id AS orderId,
                    driver_id AS driverId,
                    status,
                    version
                 FROM deliveries
                 WHERE id = ${deliveryId}`
            );

        if deliveryResult is error {

            http:NotFound response = {
                body: {
                    message: "Delivery not found"
                }
            };

            return response;
        }


        if deliveryResult.status != "ASSIGNED" {

            http:Conflict response = {
                body: {
                    message:
                        "Delivery must be ASSIGNED before pickup"
                }
            };

            return response;
        }


        var updateResult = dbClient->execute(
            `UPDATE deliveries
             SET status = 'PICKED_UP',
                 picked_up_at = CURRENT_TIMESTAMP,
                 version = version + 1
             WHERE id = ${deliveryId}
               AND status = 'ASSIGNED'
               AND version = ${deliveryResult.version}`
        );

        if updateResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to update delivery"
                }
            };

            return response;
        }


        int? affectedRows =
            updateResult.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {

                http:Conflict response = {
                    body: {
                        message:
                            "Concurrent delivery update detected"
                    }
                };

                return response;
            }

        } else {

            http:InternalServerError response = {
                body: {
                    message: "Unable to verify delivery update"
                }
            };

            return response;
        }


        return {
            deliveryId: deliveryId,
            status: "PICKED_UP"
        };
    }


    // -------------------------------------------------
    // PICKED_UP -> OUT_FOR_DELIVERY
    // -------------------------------------------------

    resource function put [int deliveryId]/out\-for\-delivery()
            returns json|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        DeliveryState|error deliveryResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    order_id AS orderId,
                    driver_id AS driverId,
                    status,
                    version
                 FROM deliveries
                 WHERE id = ${deliveryId}`
            );

        if deliveryResult is error {

            http:NotFound response = {
                body: {
                    message: "Delivery not found"
                }
            };

            return response;
        }


        if deliveryResult.status != "PICKED_UP" {

            http:Conflict response = {
                body: {
                    message:
                        "Delivery must be PICKED_UP first"
                }
            };

            return response;
        }


        var updateResult = dbClient->execute(
            `UPDATE deliveries
             SET status = 'OUT_FOR_DELIVERY',
                 version = version + 1
             WHERE id = ${deliveryId}
               AND status = 'PICKED_UP'
               AND version = ${deliveryResult.version}`
        );

        if updateResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to update delivery"
                }
            };

            return response;
        }


        int? affectedRows =
            updateResult.affectedRowCount;

        if affectedRows is int {

            if affectedRows != 1 {

                http:Conflict response = {
                    body: {
                        message:
                            "Concurrent delivery update detected"
                    }
                };

                return response;
            }

        } else {

            http:InternalServerError response = {
                body: {
                    message: "Unable to verify delivery update"
                }
            };

            return response;
        }


        return {
            deliveryId: deliveryId,
            status: "OUT_FOR_DELIVERY"
        };
    }


    // -------------------------------------------------
    // OUT_FOR_DELIVERY -> DELIVERED
    // -------------------------------------------------

    resource function put [int deliveryId]/complete()
            returns json|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        DeliveryState|error deliveryResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    order_id AS orderId,
                    driver_id AS driverId,
                    status,
                    version
                 FROM deliveries
                 WHERE id = ${deliveryId}`
            );

        if deliveryResult is error {

            http:NotFound response = {
                body: {
                    message: "Delivery not found"
                }
            };

            return response;
        }


        if deliveryResult.status != "OUT_FOR_DELIVERY" {

            http:Conflict response = {
                body: {
                    message:
                        "Delivery must be OUT_FOR_DELIVERY before completion"
                }
            };

            return response;
        }


        error? completionResult =
            completeDeliveryTransactional(deliveryResult);

        if completionResult is error {

            http:Conflict response = {
                body: {
                    message: completionResult.message()
                }
            };

            return response;
        }


        DeliveryCompletedEvent completedEvent = {
            eventId: uuid:createType4AsString(),
            eventType: "delivery.completed",
            deliveryId: deliveryId,
            orderId: deliveryResult.orderId,
            driverId: deliveryResult.driverId,
            status: "DELIVERED"
        };


        string eventJson =
            completedEvent.toJsonString();


        error? kafkaResult = kafkaProducer->send({
            topic: "delivery.completed",
            key: deliveryResult.orderId.toString().toBytes(),
            value: eventJson.toBytes()
        });


        if kafkaResult is error {

            http:InternalServerError response = {
                body: {
                    message:
                        "Delivery completed but Kafka publishing failed"
                }
            };

            return response;
        }


        io:println(
            "Delivery ",
            deliveryId,
            " completed for order ",
            deliveryResult.orderId
        );


        return {
            deliveryId: deliveryId,
            orderId: deliveryResult.orderId,
            status: "DELIVERED",
            driverStatus: "AVAILABLE"
        };
    }
}