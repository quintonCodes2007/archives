// Read models only. All lifecycle writes retain the original transactional paths.
type OrderLine record {|
    int menuItemId;
    string name;
    int quantity;
    decimal unitPrice;
|};

type StatusHistory record {|
    string? oldStatus;
    string newStatus;
    string changedAt;
|};

type OrderDetails record {|
    int id;
    int customerId;
    string customerName;
    int restaurantId;
    string restaurantName;
    string deliveryAddress;
    string status;
    decimal totalAmount;
    string createdAt;
    int? deliveryId;
    string? deliveryStatus;
    string? driverName;
    OrderLine[] items = [];
    StatusHistory[] history = [];
|};

function readOrders(int restaurantId, int customerId) returns OrderDetails[]|error {
    stream<OrderDetails, error?> rows = dbClient->query(
        `SELECT o.id, o.customer_id AS customerId, c.full_name AS customerName,
            o.restaurant_id AS restaurantId, r.name AS restaurantName,
            o.delivery_address AS deliveryAddress, o.status, o.total_amount AS totalAmount,
            DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
            d.id AS deliveryId, d.status AS deliveryStatus, dr.full_name AS driverName
         FROM orders o JOIN customers c ON c.id = o.customer_id
         JOIN restaurants r ON r.id = o.restaurant_id
         LEFT JOIN deliveries d ON d.order_id = o.id
         LEFT JOIN drivers dr ON dr.id = d.driver_id
         WHERE (${restaurantId} = 0 OR o.restaurant_id = ${restaurantId})
           AND (${customerId} = 0 OR o.customer_id = ${customerId})
         ORDER BY o.id DESC`);
    OrderDetails[] orders = [];
    check from OrderDetails row in rows do { orders.push(row); };
    foreach OrderDetails currentOrder in orders {
        stream<OrderLine, error?> items = dbClient->query(
            `SELECT oi.menu_item_id AS menuItemId, m.name, oi.quantity, oi.unit_price AS unitPrice
             FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
             WHERE oi.order_id = ${currentOrder.id} ORDER BY oi.id`);
        check from OrderLine item in items do { currentOrder.items.push(item); };
        stream<StatusHistory, error?> history = dbClient->query(
            `SELECT old_status AS oldStatus, new_status AS newStatus,
                DATE_FORMAT(changed_at, '%Y-%m-%d %H:%i:%s') AS changedAt
             FROM order_status_history WHERE order_id = ${currentOrder.id} ORDER BY id`);
        check from StatusHistory entry in history do { currentOrder.history.push(entry); };
    }
    return orders;
}

