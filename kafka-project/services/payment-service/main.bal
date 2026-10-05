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

type OrderCreatedEvent record {|
    string eventId;
    string eventType;
    int orderId;
    int customerId?;
    int restaurantId?;
    decimal totalAmount;
|};

type PaymentCompletedEvent readonly & record {|
    string eventId;
    string eventType;
    int paymentId;
    int orderId;
    decimal amount;
    string status;
    string transactionReference;
|};

kafka:ConsumerConfiguration consumerConfiguration = {
    groupId: "payment-service-group",
    topics: ["orders.created"],
    offsetReset: kafka:OFFSET_RESET_EARLIEST,
    autoCommit: false
};

listener kafka:Listener paymentListener = new (
    kafkaBootstrapServers,
    consumerConfiguration
);

function processOrderCreatedEvent(OrderCreatedEvent orderEvent)
        returns error? {

    // -------------------------------------------------
    // IDEMPOTENCY CHECK
    // -------------------------------------------------

    int|error processedCountResult = dbClient->queryRow(
        `SELECT COUNT(*)
         FROM processed_events
         WHERE event_id = ${orderEvent.eventId}
           AND service_name = 'payment-service'`
    );

    if processedCountResult is error {
        return error(
            string `Failed to check processed event: ${processedCountResult.message()}`
        );
    }

    if processedCountResult > 0 {
        io:println(
            "Duplicate event ignored: ",
            orderEvent.eventId
        );
        return;
    }

    // -------------------------------------------------
    // CHECK WHETHER PAYMENT ALREADY EXISTS FOR ORDER
    // -------------------------------------------------

    int|error paymentCountResult = dbClient->queryRow(
        `SELECT COUNT(*)
         FROM payments
         WHERE order_id = ${orderEvent.orderId}`
    );

    if paymentCountResult is error {
        return error(
            string `Failed to check existing payment: ${paymentCountResult.message()}`
        );
    }

    if paymentCountResult > 0 {

        io:println(
            "Payment already exists for order ",
            orderEvent.orderId
        );

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
                    'payment-service',
                    'orders.created'
                )`
        );

        return;
    }

    // -------------------------------------------------
    // SIMULATE PAYMENT
    // -------------------------------------------------

    string transactionReference =
        string `PAY-${uuid:createType4AsString()}`;

    int paymentId = 0;

    transaction {

        var insertResult = check dbClient->execute(
            `INSERT INTO payments
                (
                    order_id,
                    amount,
                    status,
                    transaction_reference
                )
             VALUES
                (
                    ${orderEvent.orderId},
                    ${orderEvent.totalAmount},
                    'COMPLETED',
                    ${transactionReference}
                )`
        );

        int|string? generatedId = insertResult.lastInsertId;

        if generatedId is int {
            paymentId = generatedId;
        } else {
            fail error("INVALID_GENERATED_PAYMENT_ID");
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
                    'payment-service',
                    'orders.created'
                )`
        );

        check commit;
    }

    // -------------------------------------------------
    // PUBLISH payments.completed
    // -------------------------------------------------

    PaymentCompletedEvent paymentEvent = {
        eventId: uuid:createType4AsString(),
        eventType: "payments.completed",
        paymentId: paymentId,
        orderId: orderEvent.orderId,
        amount: orderEvent.totalAmount,
        status: "COMPLETED",
        transactionReference: transactionReference
    };

    string eventJson = paymentEvent.toJsonString();

    check kafkaProducer->send({
        topic: "payments.completed",
        key: orderEvent.orderId.toString().toBytes(),
        value: eventJson.toBytes()
    });

    io:println(
        "Payment completed for order ",
        orderEvent.orderId,
        " | paymentId=",
        paymentId
    );
}

service on paymentListener {

    remote function onConsumerRecord(
            kafka:Caller caller,
            kafka:BytesConsumerRecord[] records) {

        foreach kafka:BytesConsumerRecord kafkaRecord in records {

            string|error messageResult =
                string:fromBytes(kafkaRecord.value);

            if messageResult is error {
                io:println(
                    "Failed to decode Kafka message"
                );
                continue;
            }

            io:println(
                "Payment Service received: ",
                messageResult
            );

            json|error jsonResult =
                messageResult.fromJsonString();

            if jsonResult is error {
                io:println(
                    "Invalid JSON event: ",
                    jsonResult.message()
                );
                continue;
            }

            OrderCreatedEvent|error eventResult =
                jsonResult.cloneWithType();

            if eventResult is error {
                io:println(
                    "Invalid orders.created event structure: ",
                    eventResult.message()
                );
                continue;
            }

            error? processResult =
                processOrderCreatedEvent(eventResult);

            if processResult is error {
                io:println(
                    "Payment processing failed: ",
                    processResult.message()
                );

                continue;
            }
        }

        kafka:Error? commitResult = caller->'commit();

        if commitResult is kafka:Error {
            io:println(
                "Failed to commit Kafka offset: ",
                commitResult.message()
            );
        }
    }
}