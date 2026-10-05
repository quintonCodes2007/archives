import ballerina/http;
import ballerinax/mysql;
import ballerinax/mysql.driver as _;

configurable string dbHost = "localhost";
configurable int dbPort = 3307;

final mysql:Client dbClient = check new (
    host = dbHost,
    user = "foodapp",
    password = "foodapp",
    database = "food_delivery",
    port = dbPort
);

type DashboardStats record {|
    int totalCustomers;
    int totalRestaurants;
    int totalOrders;
    int deliveredOrders;
    int activeDeliveries;
    decimal totalRevenue;
|};

type OrderStatusCount record {|
    string status;
    int count;
|};

type RestaurantStats record {|
    int restaurantId;
    string restaurantName;
    int totalOrders;
    decimal revenue;
|};

service /admin on new http:Listener(8087) {

    resource function get health() returns json {
        return {
            "service": "admin-service",
            "status": "UP"
        };
    }

    // GET /admin/dashboard
    resource function get dashboard()
            returns DashboardStats|http:InternalServerError {

        int|error customerCount = dbClient->queryRow(
            `SELECT COUNT(*) FROM customers`
        );

        int|error restaurantCount = dbClient->queryRow(
            `SELECT COUNT(*) FROM restaurants`
        );

        int|error orderCount = dbClient->queryRow(
            `SELECT COUNT(*) FROM orders`
        );

        int|error deliveredCount = dbClient->queryRow(
            `SELECT COUNT(*)
             FROM orders
             WHERE status = 'DELIVERED'`
        );

        int|error activeDeliveryCount = dbClient->queryRow(
            `SELECT COUNT(*)
             FROM deliveries
             WHERE status != 'DELIVERED'
               AND status != 'CANCELLED'`
        );

        decimal|error revenueResult = dbClient->queryRow(
            `SELECT COALESCE(SUM(amount), 0.00)
             FROM payments
             WHERE status = 'COMPLETED'`
        );

        if customerCount is error ||
           restaurantCount is error ||
           orderCount is error ||
           deliveredCount is error ||
           activeDeliveryCount is error ||
           revenueResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to generate dashboard statistics"
                }
            };

            return response;
        }

        return {
            totalCustomers: customerCount,
            totalRestaurants: restaurantCount,
            totalOrders: orderCount,
            deliveredOrders: deliveredCount,
            activeDeliveries: activeDeliveryCount,
            totalRevenue: revenueResult
        };
    }

    // GET /admin/orders/status
    resource function get orders/status()
            returns OrderStatusCount[]|http:InternalServerError {

        stream<OrderStatusCount, error?> resultStream =
            dbClient->query(
                `SELECT
                    status,
                    COUNT(*) AS count
                 FROM orders
                 GROUP BY status
                 ORDER BY status`
            );

        OrderStatusCount[] results = [];

        error? streamResult =
            from OrderStatusCount item in resultStream
            do {
                results.push(item);
            };

        if streamResult is error {
            http:InternalServerError response = {
                body: {
                    message: "Failed to load order status statistics"
                }
            };

            return response;
        }

        return results;
    }

    // GET /admin/restaurants/report
    resource function get restaurants/report()
            returns RestaurantStats[]|http:InternalServerError {

        stream<RestaurantStats, error?> resultStream =
            dbClient->query(
                `SELECT
                    r.id AS restaurantId,
                    r.name AS restaurantName,
                    COUNT(o.id) AS totalOrders,
                    COALESCE(SUM(
                        CASE
                            WHEN o.status = 'DELIVERED'
                            THEN o.total_amount
                            ELSE 0
                        END
                    ), 0.00) AS revenue
                 FROM restaurants r
                 LEFT JOIN orders o
                    ON r.id = o.restaurant_id
                 GROUP BY r.id, r.name
                 ORDER BY revenue DESC`
            );

        RestaurantStats[] results = [];

        error? streamResult =
            from RestaurantStats item in resultStream
            do {
                results.push(item);
            };

        if streamResult is error {
            http:InternalServerError response = {
                body: {
                    message: "Failed to generate restaurant report"
                }
            };

            return response;
        }

        return results;
    }
}