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

// =====================================================
// TYPES
// =====================================================

type CreateCustomerRequest record {|
    string username;
    string fullName;
    string email;
    string? phone;
|};

type Customer record {|
    int id;
    string username;
    string fullName;
    string email;
    string? phone;
|};

type CreateAddressRequest record {|
    string label;
    string addressLine;
    string city;
    boolean isDefault;
|};

type CustomerAddress record {|
    int id;
    int customerId;
    string label;
    string addressLine;
    string city;
    boolean isDefault;
|};

type CustomerOrder record {|
    int id;
    int restaurantId;
    string deliveryAddress;
    string status;
    decimal totalAmount;
    int version;
|};


// =====================================================
// HELPERS
// =====================================================

function getCustomerAddresses(int customerId)
        returns CustomerAddress[]|error {

    stream<CustomerAddress, error?> addressStream =
        dbClient->query(
            `SELECT
                id,
                customer_id AS customerId,
                label,
                address_line AS addressLine,
                city,
                is_default AS isDefault
             FROM customer_addresses
             WHERE customer_id = ${customerId}
             ORDER BY id`
        );

    CustomerAddress[] addresses = [];

    check from CustomerAddress address in addressStream
        do {
            addresses.push(address);
        };

    return addresses;
}

function getCustomerOrders(int customerId)
        returns CustomerOrder[]|error {

    stream<CustomerOrder, error?> orderStream =
        dbClient->query(
            `SELECT
                id,
                restaurant_id AS restaurantId,
                delivery_address AS deliveryAddress,
                status,
                total_amount AS totalAmount,
                version
             FROM orders
             WHERE customer_id = ${customerId}
             ORDER BY id DESC`
        );

    CustomerOrder[] customerOrders = [];

    check from CustomerOrder customerOrder in orderStream
        do {
            customerOrders.push(customerOrder);
        };

    return customerOrders;
}

function addAddressTransactional(
        int customerId,
        CreateAddressRequest request) returns int|error {

    int addressId = 0;

    transaction {

        if request.isDefault {

            _ = check dbClient->execute(
                `UPDATE customer_addresses
                 SET is_default = FALSE
                 WHERE customer_id = ${customerId}`
            );
        }

        var insertResult = check dbClient->execute(
            `INSERT INTO customer_addresses
                (
                    customer_id,
                    label,
                    address_line,
                    city,
                    is_default
                )
             VALUES
                (
                    ${customerId},
                    ${request.label},
                    ${request.addressLine},
                    ${request.city},
                    ${request.isDefault}
                )`
        );

        int|string? generatedId =
            insertResult.lastInsertId;

        if generatedId is int {
            addressId = generatedId;
        } else {
            fail error("INVALID_GENERATED_ADDRESS_ID");
        }

        check commit;
    }

    return addressId;
}


// =====================================================
// CUSTOMER SERVICE
// =====================================================

service /customers on new http:Listener(8081) {

    // -------------------------------------------------
    // HEALTH
    // -------------------------------------------------

    resource function get health() returns json {

        return {
            "service": "customer-service",
            "status": "UP"
        };
    }


    // -------------------------------------------------
    // CREATE CUSTOMER
    // POST /customers
    // -------------------------------------------------

    resource function post .(
            @http:Payload CreateCustomerRequest request)
            returns Customer|
                http:BadRequest|
                http:Conflict|
                http:InternalServerError {

        if request.username.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "username is required"
                }
            };

            return response;
        }

        if request.fullName.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "fullName is required"
                }
            };

            return response;
        }

        if request.email.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "email is required"
                }
            };

            return response;
        }

        int|error duplicateCount =
            dbClient->queryRow(
                `SELECT COUNT(*)
                 FROM customers
                 WHERE username = ${request.username}
                    OR email = ${request.email}
                    OR (
                        ${request.phone} IS NOT NULL
                        AND phone = ${request.phone}
                    )`
            );

        if duplicateCount is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to validate customer"
                }
            };

            return response;
        }

        if duplicateCount > 0 {

            http:Conflict response = {
                body: {
                    message:
                        "Username, email or phone already exists"
                }
            };

            return response;
        }

        var insertResult = dbClient->execute(
            `INSERT INTO customers
                (
                    username,
                    full_name,
                    email,
                    phone
                )
             VALUES
                (
                    ${request.username},
                    ${request.fullName},
                    ${request.email},
                    ${request.phone}
                )`
        );

        if insertResult is error {

            http:Conflict response = {
                body: {
                    message:
                        "Could not create customer. Username, email or phone may already exist."
                }
            };

            return response;
        }

        int|string? generatedId =
            insertResult.lastInsertId;

        if generatedId is int {

            return {
                id: generatedId,
                username: request.username,
                fullName: request.fullName,
                email: request.email,
                phone: request.phone
            };

        } else {

            http:InternalServerError response = {
                body: {
                    message: "Invalid generated customer ID"
                }
            };

            return response;
        }
    }


    // -------------------------------------------------
    // GET CUSTOMER
    // GET /customers/{customerId}
    // -------------------------------------------------

    resource function get [int customerId]()
            returns Customer|
                http:NotFound {

        Customer|error customerResult =
            dbClient->queryRow(
                `SELECT
                    id,
                    username,
                    full_name AS fullName,
                    email,
                    phone
                 FROM customers
                 WHERE id = ${customerId}`
            );

        if customerResult is error {

            http:NotFound response = {
                body: {
                    message: "Customer not found"
                }
            };

            return response;
        }

        return customerResult;
    }


    // -------------------------------------------------
    // ADD CUSTOMER ADDRESS
    // POST /customers/{customerId}/addresses
    // -------------------------------------------------

    resource function post [int customerId]/addresses(
            @http:Payload CreateAddressRequest request)
            returns json|
                http:BadRequest|
                http:NotFound|
                http:Conflict|
                http:InternalServerError {

        if request.label.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "Address label is required"
                }
            };

            return response;
        }

        if request.addressLine.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "Address line is required"
                }
            };

            return response;
        }

        if request.city.trim().length() == 0 {

            http:BadRequest response = {
                body: {
                    message: "City is required"
                }
            };

            return response;
        }

        int|error customerCount =
            dbClient->queryRow(
                `SELECT COUNT(*)
                 FROM customers
                 WHERE id = ${customerId}`
            );

        if customerCount is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to validate customer"
                }
            };

            return response;
        }

        if customerCount == 0 {

            http:NotFound response = {
                body: {
                    message: "Customer not found"
                }
            };

            return response;
        }

        int|error addressId =
            addAddressTransactional(
                customerId,
                request
            );

        if addressId is error {

            http:Conflict response = {
                body: {
                    message: addressId.message()
                }
            };

            return response;
        }

        return {
            id: addressId,
            customerId: customerId,
            label: request.label,
            addressLine: request.addressLine,
            city: request.city,
            isDefault: request.isDefault
        };
    }


    // -------------------------------------------------
    // GET CUSTOMER ADDRESSES
    // GET /customers/{customerId}/addresses
    // -------------------------------------------------

    resource function get [int customerId]/addresses()
            returns CustomerAddress[]|
                http:NotFound|
                http:InternalServerError {

        int|error customerCount =
            dbClient->queryRow(
                `SELECT COUNT(*)
                 FROM customers
                 WHERE id = ${customerId}`
            );

        if customerCount is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to validate customer"
                }
            };

            return response;
        }

        if customerCount == 0 {

            http:NotFound response = {
                body: {
                    message: "Customer not found"
                }
            };

            return response;
        }

        CustomerAddress[]|error addressResult =
            getCustomerAddresses(customerId);

        if addressResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to load customer addresses"
                }
            };

            return response;
        }

        return addressResult;
    }


    // -------------------------------------------------
    // ORDER HISTORY
    // GET /customers/{customerId}/orders
    // -------------------------------------------------

    resource function get [int customerId]/orders()
            returns CustomerOrder[]|
                http:NotFound|
                http:InternalServerError {

        int|error customerCount =
            dbClient->queryRow(
                `SELECT COUNT(*)
                 FROM customers
                 WHERE id = ${customerId}`
            );

        if customerCount is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to validate customer"
                }
            };

            return response;
        }

        if customerCount == 0 {

            http:NotFound response = {
                body: {
                    message: "Customer not found"
                }
            };

            return response;
        }

        CustomerOrder[]|error orderResult =
            getCustomerOrders(customerId);

        if orderResult is error {

            http:InternalServerError response = {
                body: {
                    message: "Failed to load customer order history"
                }
            };

            return response;
        }

        return orderResult;
    }
}