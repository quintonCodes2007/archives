# Distributed Food Delivery Platform

## Overview

This project is a distributed food delivery platform developed for **DSA612S – Distributed Systems and Applications**.

The system is implemented using:

- **Ballerina** for microservices
- **Apache Kafka** for asynchronous event-driven communication
- **MySQL** for persistent storage
- **Docker** and **Docker Compose** for containerization and orchestration

The platform separates the major business functions of a food delivery system into independent services that communicate through REST APIs and Kafka events.

---

## Architecture

### System Architecture Diagram

![Distributed Food Delivery Platform Architecture](docs/architecture.png)

The architecture consists of seven Ballerina microservices connected through Apache Kafka and a shared MySQL persistence layer.

The seven services are:

1. Customer Service
2. Restaurant Service
3. Order Service
4. Payment Service
5. Delivery Service
6. Notification Service
7. Admin Service

Supporting infrastructure:

- Apache Kafka
- MySQL
- Docker Compose

### High-Level Event Flow

```text
Customer
   |
   v
Order Service
   |
   | orders.created
   v
Kafka
   |
   v
Payment Service
   |
   | payments.completed
   v
Kafka
   |
   v
Order Service
   |
   v
Restaurant Service
   |
   | orders.status.updated
   v
Kafka
   |
   v
Delivery Service
   |
   | delivery.assigned
   v
Kafka
   |
   v
Order Service
   |
   v
Delivery Lifecycle
   |
   | delivery.completed
   v
Kafka
   |
   v
Order Service
```

The Notification Service independently listens to important Kafka lifecycle events and generates notifications for customers, restaurants, and drivers.

---

# Microservices

## 1. Customer Service

**Port:** `8081`

### Responsibilities

- Customer account management
- Delivery address management
- Historical order retrieval
- Duplicate username validation
- Duplicate email validation
- Duplicate phone number validation
- Default address management

### Example Endpoints

```text
GET  /customers/health
POST /customers
GET  /customers/{customerId}
POST /customers/{customerId}/addresses
GET  /customers/{customerId}/addresses
GET  /customers/{customerId}/orders
```

---

## 2. Restaurant Service

**Port:** `8082`

### Responsibilities

- Restaurant menu retrieval
- Real-time inventory management
- Kitchen opening-hours management
- Restaurant order processing
- Order preparation state management
- Publishing order-status events

### Restaurant Order Transitions

```text
CONFIRMED
    ↓
PREPARING
    ↓
READY
```

### Kitchen Opening Hours

The Restaurant Service stores and manages weekly kitchen opening hours.

```text
GET /restaurants/{restaurantId}/hours
PUT /restaurants/{restaurantId}/hours/{dayOfWeek}
```

`dayOfWeek` uses values from `0` to `6`.

A normal opening-hours request:

```json
{
  "openTime": "08:00",
  "closeTime": "21:00",
  "closed": false
}
```

A closed day is stored with:

```json
{
  "openTime": "",
  "closeTime": "",
  "closed": true
}
```

Closed days are persisted with null opening and closing times.

### Example Endpoints

```text
GET /restaurants/health
GET /restaurants/{restaurantId}/menu

PUT /restaurants/{restaurantId}/menu/{menuItemId}/inventory

GET /restaurants/{restaurantId}/hours
PUT /restaurants/{restaurantId}/hours/{dayOfWeek}

PUT /restaurants/{restaurantId}/orders/{orderId}/prepare
PUT /restaurants/{restaurantId}/orders/{orderId}/ready
```

When an order changes preparation state, Restaurant Service publishes:

```text
orders.status.updated
```

---

## 3. Order Service

**Port:** `8083`

### Responsibilities

- Order creation
- Customer and restaurant validation
- Inventory validation
- Server-side order total calculation
- Transactional stock reduction
- Central order-state management
- Order-status history
- Order cancellation
- Inventory restoration after cancellation
- Kafka event production and consumption

### Supported Order Lifecycle

```text
CREATED
   ↓
CONFIRMED
   ↓
PREPARING
   ↓
READY
   ↓
OUT_FOR_DELIVERY
   ↓
DELIVERED
```

An order can also terminate as:

```text
CONFIRMED ──→ CANCELLED

PREPARING ──→ CANCELLED
```

### Kafka Communication

Order Service publishes:

```text
orders.created
orders.cancelled
```

Order Service consumes:

```text
payments.completed
delivery.assigned
delivery.completed
```

### Order Cancellation

Orders can be cancelled using:

```text
PUT /orders/{orderId}/cancel
```

Cancellation is allowed while an order is still in an eligible pre-delivery state.

When cancellation succeeds:

- The order status becomes `CANCELLED`.
- The transition is written to `order_status_history`.
- The ordered inventory is restored.
- Inventory version numbers are incremented.
- An `orders.cancelled` Kafka event is published.
- Customer and restaurant cancellation notifications are generated.

Cancellation runs inside a MySQL transaction so that order state and inventory remain consistent.

---

## 4. Payment Service

The Payment Service is event-driven and does not require a public HTTP port.

### Responsibilities

- Consume newly created orders
- Simulate payment processing
- Store payment records
- Generate transaction references
- Prevent duplicate payment processing
- Publish payment confirmation events

Consumes:

```text
orders.created
```

Publishes:

```text
payments.completed
```

Payment processing is idempotent so the same Kafka event does not create duplicate payment records.

---

## 5. Delivery Service

**Port:** `8085`

### Responsibilities

- Driver assignment
- Driver availability management
- Delivery lifecycle management
- Delivery timestamps
- Concurrency-safe driver allocation
- Delivery event production

The Delivery Service listens to:

```text
orders.status.updated
```

A driver is only assigned when:

```text
newStatus = READY
```

### Delivery Lifecycle

```text
ASSIGNED
    ↓
PICKED_UP
    ↓
OUT_FOR_DELIVERY
    ↓
DELIVERED
```

### Example Endpoints

```text
GET /deliveries/health

PUT /deliveries/{deliveryId}/pickup
PUT /deliveries/{deliveryId}/out-for-delivery
PUT /deliveries/{deliveryId}/complete
```

Publishes:

```text
delivery.assigned
delivery.completed
```

After successful delivery completion, the assigned driver's status returns to:

```text
AVAILABLE
```

---

## 6. Notification Service

The Notification Service is event-driven and generates simulated multi-channel notifications.

### Supported Channels

```text
SYSTEM
EMAIL
SMS
```

### Supported Recipients

- Customers
- Restaurants
- Drivers

### Consumed Events

```text
payments.completed
orders.status.updated
delivery.assigned
delivery.completed
orders.cancelled
```

For example, one successful payment event can generate:

```text
CUSTOMER   SYSTEM
CUSTOMER   EMAIL
CUSTOMER   SMS

RESTAURANT SYSTEM
RESTAURANT EMAIL
RESTAURANT SMS
```

Email and SMS delivery are simulated by storing notification records in MySQL with a `SENT` status. No external SMS or email provider is required.

The service uses unique Kafka event IDs and the `processed_events` table to prevent duplicate event processing.

---

## 7. Admin Service

**Port:** `8087`

### Responsibilities

- Platform-wide statistics
- Order statistics
- Revenue reporting
- Restaurant reporting
- Delivery performance information

### Example Endpoints

```text
GET /admin/health
GET /admin/dashboard
GET /admin/orders/status
GET /admin/restaurants/report
```

### Example Dashboard Statistics

```text
Total customers
Total restaurants
Total orders
Delivered orders
Active deliveries
Total completed payment revenue
```

---

# Kafka

Apache Kafka acts as the asynchronous communication layer between the services.

## Topics

| Topic | Producer | Main Consumer(s) | Purpose |
|---|---|---|---|
| `orders.created` | Order Service | Payment Service | Announces newly created orders |
| `payments.completed` | Payment Service | Order Service, Notification Service | Confirms simulated payment |
| `orders.status.updated` | Restaurant Service | Delivery Service, Notification Service | Announces preparation-state changes |
| `delivery.assigned` | Delivery Service | Order Service, Notification Service | Announces driver assignment |
| `delivery.completed` | Delivery Service | Order Service, Notification Service | Announces delivery completion |
| `orders.cancelled` | Order Service | Notification Service | Announces successful cancellation |
| `notifications.requested` | Platform | Notification infrastructure | Reserved notification event topic |

Kafka allows services to coordinate asynchronously without requiring direct synchronous communication between every service.

Example:

```text
Order Service
     |
     | orders.created
     v
   Kafka
     |
     v
Payment Service
```

The Order Service therefore does not need to directly invoke the Payment Service.

---

# Database

The project uses **MySQL 8.4**.

Database:

```text
food_delivery
```

Important tables include:

```text
customers
customer_addresses
restaurants
restaurant_hours
menu_items
orders
order_items
order_status_history
payments
drivers
deliveries
notifications
processed_events
```

The schema includes foreign keys, uniqueness constraints, status fields, timestamps and version columns.

---

# Idempotency

Kafka systems may deliver the same event more than once.

To prevent duplicate processing, this project uses:

```text
processed_events
```

Processed Kafka events are recorded using their event IDs and service names.

A uniqueness constraint protects:

```text
event_id + service_name
```

This allows the same Kafka event to be consumed by different services while preventing the same service from processing that event repeatedly.

Examples include:

- Duplicate payment events do not create multiple payment records.
- Duplicate delivery events do not repeatedly advance an order.
- Duplicate notification events do not generate the same notifications again.

---

# Concurrency Handling

The platform uses database transactions, pessimistic locking and optimistic version checks to protect shared mutable data.

## Inventory Concurrency

Order creation performs inventory validation inside a transaction.

Critical inventory rows are locked using:

```text
SELECT ... FOR UPDATE
```

Stock updates are also conditional so that quantities cannot drop below the requested amount.

### Concurrency Test

The Beef Burger inventory was set to:

```text
1
```

Two order requests were sent concurrently.

Result:

```text
Request A: HTTP 201 Created
Request B: HTTP 409 Conflict
Request B message: INSUFFICIENT_STOCK: 1
Final inventory quantity: 0
Orders created: 1
```

This demonstrates that concurrent requests cannot oversell inventory.

---

## Driver Assignment Concurrency

Driver assignment uses transactions, driver status validation and version checks.

The system selects an available driver and updates the record only when the driver is still:

```text
AVAILABLE
```

### Concurrency Test

Two orders were moved to `READY` while only one driver was available.

Result:

```text
Order 13 → driver 1 assigned
Order 13 → OUT_FOR_DELIVERY

Order 12 → remained READY
Second assignment → NO_AVAILABLE_DRIVER

Delivery records created for driver 1: 1
```

This demonstrates that one driver cannot be assigned to two active deliveries concurrently.

---

## Consistency Strategy

Shared resources such as inventory, orders and drivers are protected through:

- MySQL transactions
- `SELECT ... FOR UPDATE`
- Conditional updates
- `version` columns
- State validation
- Kafka event IDs
- Idempotent consumers

These mechanisms reduce race conditions and protect distributed state during concurrent operations.

---

# Optimistic Locking

Mutable records include a:

```text
version
```

field.

Successful updates increment the version.

Conditional updates can verify the expected version before modifying a record, allowing concurrent state changes to be detected and rejected safely.

---

# Docker

Every Ballerina microservice has its own Dockerfile.

The full platform is orchestrated using:

```text
docker-compose.yml
```

The Docker Compose environment contains:

```text
MySQL
Kafka

Customer Service
Restaurant Service
Order Service
Payment Service
Delivery Service
Notification Service
Admin Service
```

Docker service configuration uses container-level hostnames such as:

```text
mysql
kafka
```

instead of host-machine addresses.

---

# Running the Application

From the project root:

```bash
docker compose up -d
```

Check running containers:

```bash
docker compose ps
```

Expected containers include:

```text
food_delivery_mysql
food_delivery_kafka
customer_service
restaurant_service
order_service
payment_service
delivery_service
notification_service
admin_service
```

To stop the environment:

```bash
docker compose down
```

---

# Health Checks

## Customer Service

```bash
curl http://localhost:8081/customers/health
```

## Restaurant Service

```bash
curl http://localhost:8082/restaurants/health
```

## Order Service

```bash
curl http://localhost:8083/orders/health
```

## Delivery Service

```bash
curl http://localhost:8085/deliveries/health
```

## Admin Service

```bash
curl http://localhost:8087/admin/health
```

Payment Service and Notification Service operate primarily as Kafka consumers and do not require public HTTP health endpoints for the implemented workflow.

---

# End-to-End Demonstration

The complete platform has been tested while running through Docker Compose.

## Step 1 – Create Order

```bash
curl -X POST http://localhost:8083/orders \
-H "Content-Type: application/json" \
-d '{
  "customerId":1,
  "restaurantId":1,
  "deliveryAddress":"Windhoek Central",
  "items":[
    {
      "menuItemId":1,
      "quantity":1
    }
  ]
}'
```

The order begins as:

```text
CREATED
```

Order Service publishes:

```text
orders.created
```

---

## Step 2 – Payment

Payment Service receives the order event and simulates a successful payment.

Example:

```text
Payment completed for order 8
```

It publishes:

```text
payments.completed
```

Order Service then performs:

```text
CREATED → CONFIRMED
```

---

## Step 3 – Restaurant Preparation

```bash
curl -X PUT \
http://localhost:8082/restaurants/1/orders/8/prepare
```

State:

```text
CONFIRMED → PREPARING
```

Then:

```bash
curl -X PUT \
http://localhost:8082/restaurants/1/orders/8/ready
```

State:

```text
PREPARING → READY
```

Restaurant Service publishes:

```text
orders.status.updated
```

---

## Step 4 – Driver Assignment

Delivery Service receives the `READY` event and assigns an available driver.

Example:

```text
READY order 8 assigned to driver 1
```

Delivery Service publishes:

```text
delivery.assigned
```

Order Service updates:

```text
READY → OUT_FOR_DELIVERY
```

---

## Step 5 – Delivery

Pickup:

```bash
curl -X PUT \
http://localhost:8085/deliveries/3/pickup
```

```text
ASSIGNED → PICKED_UP
```

Out for delivery:

```bash
curl -X PUT \
http://localhost:8085/deliveries/3/out-for-delivery
```

```text
PICKED_UP → OUT_FOR_DELIVERY
```

Complete:

```bash
curl -X PUT \
http://localhost:8085/deliveries/3/complete
```

Delivery status:

```text
OUT_FOR_DELIVERY → DELIVERED
```

Delivery Service publishes:

```text
delivery.completed
```

Order Service then performs:

```text
OUT_FOR_DELIVERY → DELIVERED
```

The driver returns to:

```text
AVAILABLE
```

---

# Cancellation Demonstration

A confirmed order can be cancelled using:

```bash
curl -X PUT \
http://localhost:8083/orders/10/cancel
```

Successful response:

```json
{
  "orderId": 10,
  "previousStatus": "CONFIRMED",
  "status": "CANCELLED",
  "message": "Order cancelled successfully"
}
```

The cancellation:

- Restores ordered inventory
- Updates order history
- Increments relevant versions
- Publishes `orders.cancelled`
- Generates customer notifications
- Generates restaurant notifications

Example history:

```text
NULL → CREATED
CREATED → CONFIRMED
CONFIRMED → CANCELLED
```

---

# Notification Demonstration

Notification Service generates multi-channel records for lifecycle events.

For example, a successful payment generated:

```text
CUSTOMER    SYSTEM
CUSTOMER    EMAIL
CUSTOMER    SMS

RESTAURANT  SYSTEM
RESTAURANT  EMAIL
RESTAURANT  SMS
```

A cancellation generated the same three simulated channels for both the customer and restaurant.

Relevant event types include:

```text
payments.completed
orders.status.updated
delivery.assigned
delivery.completed
orders.cancelled
```

---

# Technologies

```text
Ballerina Swan Lake 2201.13.4
Apache Kafka 4.2.2
MySQL 8.4
Docker
Docker Compose
REST APIs
Event-Driven Architecture
```

---

# Project Structure

```text
dsa-assignment-2/
│
├── services/
│   ├── customer-service/
│   ├── restaurant-service/
│   ├── order-service/
│   ├── payment-service/
│   ├── delivery-service/
│   ├── notification-service/
│   └── admin-service/
│
├── infrastructure/
│   ├── mysql/
│   │   └── init.sql
│   └── kafka/
│
├── docs/
│   └── architecture.png
│
├── docker-compose.yml
└── README.md
```

---

# Design Decisions

The platform applies several distributed-systems principles:

- Independent microservice boundaries
- REST APIs for synchronous interactions
- Kafka for asynchronous coordination
- Persistent relational storage
- Event-driven communication
- Idempotent Kafka consumers
- Atomic database transactions
- Pessimistic row locking
- Optimistic version checking
- State-transition validation
- Concurrency-safe inventory updates
- Concurrency-safe driver assignment
- Containerized deployment
- Loose coupling between services

---

# Current Status

All seven required backend services have been implemented and run through Docker Compose.

Verified primary order lifecycle:

```text
CREATED
→ CONFIRMED
→ PREPARING
→ READY
→ OUT_FOR_DELIVERY
→ DELIVERED
```

Verified cancellation lifecycle:

```text
CONFIRMED
→ CANCELLED
```

The implementation currently includes:

- Customer account management
- Delivery addresses
- Customer order history
- Restaurant menus
- Real-time inventory
- Kitchen opening hours
- Transactional order creation
- Simulated payment processing
- Order lifecycle management
- Order cancellation
- Inventory restoration after cancellation
- Driver assignment
- Delivery lifecycle tracking
- Multi-channel notification simulation
- Customer, restaurant and driver notifications
- Kafka-based asynchronous communication
- Kafka event idempotency
- Inventory concurrency protection
- Driver assignment concurrency protection
- Admin statistics and reporting
- MySQL persistence
- Docker Compose orchestration
- Architecture documentation
- End-to-end testing