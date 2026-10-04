import ballerina/http;
import ballerina/sql;
import ballerinax/mysql;
import ballerinax/mysql.driver as _;

mysql:Client|sql:Error dbClient = new (
    host = "localhost",
    user = "foodapp",
    password = "foodapp",
    database = "food_delivery",
    port = 3307
);

type CreateOrderRequest record {|
    int customerId;
    int restaurantId;
    string deliveryAddress;
    decimal totalAmount;
|};

type OrderResponse record {|
    int id;
    int customerId;
    int restaurantId;
    string deliveryAddress;
    string status;
    decimal totalAmount;
|};

service /orders on new http:Listener(8083) {

    resource function get health() returns json {
        return {
            "service": "order-service",
            "status": "UP"
        };
    }

    resource function post .(@http:Payload CreateOrderRequest orderRequest)
            returns OrderResponse|http:BadRequest {

        if orderRequest.customerId <= 0 ||
                orderRequest.restaurantId <= 0 ||
                orderRequest.deliveryAddress.trim().length() == 0 ||
                orderRequest.totalAmount <= 0.0d {

            return {
                body: {
                    message: "Invalid order data"
                }
            };
        }

        return {
            id: 1,
            customerId: orderRequest.customerId,
            restaurantId: orderRequest.restaurantId,
            deliveryAddress: orderRequest.deliveryAddress,
            status: "CREATED",
            totalAmount: orderRequest.totalAmount
        };
    }
}