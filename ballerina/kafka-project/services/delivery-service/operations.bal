import ballerina/io;
import ballerina/task;

type DriverProfile record {|
    int id;
    string fullName;
    string email;
    string phone;
    string status;
|};

type CreateDriverRequest record {|
    string fullName;
    string email;
    string phone;
|};

type DeliveryDetails record {|
    int id;
    int orderId;
    int driverId;
    string driverName;
    string restaurantName;
    string customerName;
    string deliveryAddress;
    string status;
    string orderStatus;
    decimal totalAmount;
    int itemCount;
|};

type WaitingDelivery record {|
    int orderId;
    int restaurantId;
    string restaurantName;
    string customerName;
    string deliveryAddress;
    decimal totalAmount;
    int itemCount;
|};

type ReadyOrder record {|
    int id;
    int restaurantId;
|};

function readDeliveries() returns DeliveryDetails[]|error {
    stream<DeliveryDetails, error?> rows = dbClient->query(
        `SELECT d.id, d.order_id AS orderId, d.driver_id AS driverId,
            dr.full_name AS driverName, r.name AS restaurantName,
            c.full_name AS customerName, o.delivery_address AS deliveryAddress,
            d.status, o.status AS orderStatus, o.total_amount AS totalAmount,
            (SELECT CAST(COALESCE(SUM(quantity), 0) AS SIGNED)
             FROM order_items
             WHERE order_id = o.id) AS itemCount
         FROM deliveries d
         JOIN drivers dr ON dr.id = d.driver_id
         JOIN orders o ON o.id = d.order_id
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN customers c ON c.id = o.customer_id
         ORDER BY d.id DESC`);

    DeliveryDetails[] results = [];
    check from DeliveryDetails row in rows do {
        results.push(row);
    };

    return results;
}

function readWaitingDeliveries() returns WaitingDelivery[]|error {
    stream<WaitingDelivery, error?> rows = dbClient->query(
        `SELECT o.id AS orderId, o.restaurant_id AS restaurantId,
            r.name AS restaurantName, c.full_name AS customerName,
            o.delivery_address AS deliveryAddress, o.total_amount AS totalAmount,
            (SELECT CAST(COALESCE(SUM(quantity), 0) AS SIGNED)
             FROM order_items
             WHERE order_id = o.id) AS itemCount
         FROM orders o
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN customers c ON c.id = o.customer_id
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.status = 'READY'
           AND d.id IS NULL
         ORDER BY o.id`);

    WaitingDelivery[] results = [];
    check from WaitingDelivery row in rows do {
        results.push(row);
    };

    return results;
}

// A failed Kafka record is not automatically redelivered in the running poll
// loop. Retry persisted READY orders from the backend, including after restart.
// Assignment still uses the original row locks, conditional version update,
// unique delivery/order constraint and Kafka delivery.assigned event.
function retryWaitingOrders() returns error? {
    stream<ReadyOrder, error?> rows = dbClient->query(
        `SELECT o.id, o.restaurant_id AS restaurantId
         FROM orders o
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.status = 'READY'
           AND d.id IS NULL
         ORDER BY o.id`);

    ReadyOrder[] orders = [];
    check from ReadyOrder row in rows do {
        orders.push(row);
    };

    foreach ReadyOrder currentOrder in orders {
        error? result = processOrderStatusEvent({
            eventId: string `waiting-ready-${currentOrder.id}`,
            eventType: "orders.status.updated",
            orderId: currentOrder.id,
            restaurantId: currentOrder.restaurantId,
            oldStatus: "PREPARING",
            newStatus: "READY"
        });

        if result is error {
            if result.message() == "NO_AVAILABLE_DRIVER" {
                return;
            }

            io:println(
                "Waiting order retry: ",
                result.message()
            );
        }
    }
}

class WaitingOrdersJob {
    *task:Job;

    public function execute() {
        error? result = retryWaitingOrders();

        if result is error {
            io:println(
                "Waiting queue unavailable: ",
                result.message()
            );
        }
    }
}

function init() returns error? {
    _ = check task:scheduleJobRecurByFrequency(
        new WaitingOrdersJob(),
        5
    );
}

