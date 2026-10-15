# Frontend workflow redesign

## Repository inspection (15 October 2026)

- Docker exposes Customer 8081, Restaurant 8082, Order 8083, Delivery 8085 and Admin 8087. MySQL is exposed on 3308 (internal 3306); Kafka uses internal 29092 and host 9092. Payment and Notification have no HTTP API.
- Vite already proxies `/customer-api`, `/restaurant-api`, `/order-api`, `/delivery-api`, `/admin-api`. Nginx provides the same paths and SPA fallback. Preserve both.
- Customers have username, full_name, email and nullable phone; no passwords. Addresses have label, address_line, city and is_default. Use email-only demo identity with a session, without schema changes.
- Restaurants have name, address, nullable email/phone and active. Hours are separate, Sunday=0 through Saturday=6. Menu has name, nullable description, price, stock_quantity, available and version. There are no categories or image fields.
- Orders have customer/restaurant, address, status, total, version and timestamps; order_items retain quantities and unit prices. Status history exists. Customer Service already lists a customer's basic orders, but no endpoint provides the detailed kitchen queue.
- Drivers are global, with full_name, email, phone, status and version. Deliveries require an assigned driver. There is no row for an unassigned waiting order; detect READY orders without a delivery.
- Existing resources support customer/address creation and lookup by ID; menu reads/inventory updates; hours reads/updates; prepare/ready; order creation/cancellation; delivery pickup/out-for-delivery/completion; admin dashboard/status/restaurant reports.
- Missing: email lookup; restaurant list/create; menu create; detailed filtered order reads; driver list/create; delivery and waiting-order reads. Add these to the owning services using existing SQL patterns.
- `orders.created` -> Payment -> `payments.completed` -> Order CONFIRMED. Restaurant changes CONFIRMED -> PREPARING -> READY, publishing `orders.status.updated`. Delivery reserves an AVAILABLE driver using a row lock/version check and publishes `delivery.assigned`. Order Service then changes READY -> OUT_FOR_DELIVERY **at assignment**, before physical pickup. Delivery actions independently run ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED. `delivery.completed` changes the order to DELIVERED. UI must distinguish these states.
- Payment and Notification remain Kafka consumers. Notifications are persisted as SYSTEM/EMAIL/SMS records; this does not implement an external mail/SMS provider.
- Existing inventory transaction uses row locks and conditional decrements. Delivery assignment uses a transaction, driver row locks, versions and a unique delivery/order constraint. Retain these protections.
- Existing no-driver handling leaves the Kafka offset uncommitted, but does not retry a consumed record in the running consumer. Add a five-second backend waiting-queue retry, which also discovers newly added or released drivers and work persisted before restart; never assign from React.
- Opening hours are informational in the original backend: order creation only checks restaurant.active. The frontend reflects published hours, without changing the backend's acceptance policy.

## Implementation plan

1. Preserve the original frontend as `backups/frontend-before-redesign-20261015.zip`.
2. Separate routing, demo sessions, HTTP adapters, controlled polling, reusable layout and feedback.
3. Build customer entry, restaurant gallery, stock-aware cart/address book and current/past order tracking.
4. Build a polling kitchen queue and delivery operations with valid actions and an explicitly schematic offline map.
5. Build global admin, restaurant inventory/hours/orders and real reports/driver management.
6. Implement only the missing API resources above; preserve schema, event shapes, transactions and existing routes.
7. Document API additions and demo data; install/build frontend; compile changed Ballerina services; exercise APIs and concurrency if Docker is available.

## Verification notes

The original assignment documentation in `docs/README.md` is retained.

## Implemented API additions

All existing routes and the MySQL schema remain intact. Resources are added to the existing listeners; helper read models live beside each service's `main.bal`.

| Owner | Resource | Contract |
| --- | --- | --- |
| Customer, 8081 | `GET /customers/lookup?email=...` | Exact email lookup returning existing Customer shape; 404 when absent. Demo identity only. |
| Restaurant, 8082 | `GET /restaurants` | Array of id, name, address, email, phone, active, menuCount and published weekly hours. |
| Restaurant | `POST /restaurants` | name, address, optional nullable email/phone. New restaurant is active. Hours remain unpublished until set. |
| Restaurant | `POST /restaurants/{id}/menu` | name, description, decimal price, integer stockQuantity. New item is available. Validates name/description lengths and nonnegative numeric values; duplicate names return conflict. |
| Order, 8083 | `GET /orders?restaurantId=...&customerId=...` | Optional positive filters (zero means all). Includes names/address, actual items/unit prices, history, createdAt, nullable deliveryId/deliveryStatus/driverName. |
| Delivery, 8085 | `GET /deliveries` | Actual joined delivery/order/driver/restaurant/customer data, itemCount and totalAmount. |
| Delivery | `GET /deliveries/waiting` | READY orders with no delivery; does not fabricate delivery IDs or driver assignments. |
| Delivery | `GET /deliveries/drivers` | Global id/fullName/email/phone/status; no internal version fields. |
| Delivery | `POST /deliveries/drivers` | fullName/email/phone, initially AVAILABLE, with unique email/phone enforced by MySQL. |

`operations.bal` schedules the five-second waiting-order job through the bundled Ballerina task module. It invokes the existing assignment function with a stable retry event ID. The assignment transaction now also locks the order row and verifies READY before reserving a driver. The original driver lock, conditional status/version update, unique delivery/order constraint, transaction and Kafka publication remain responsible for assignment. React only reads assignments and calls the three existing delivery actions.

No new payment or notification endpoints, browser-side Kafka connections, customer password columns, categories, GPS fields, driver ownership fields or backend admin-auth architecture were added. The existing event publication is not a transactional outbox; an infrastructure failure between database commit and Kafka send remains a limitation of the original architecture.

## Frontend implementation

- React Router provides customer/admin route guards and public operations routes.
- `AuthContext` stores only demo role/customer details in sessionStorage; credentials are centralized in `config/demoAuth.js`.
- Explicit API modules preserve the five existing Vite/Nginx proxies. A shared HTTP helper handles JSON, failures and timeouts.
- `usePolling` has one self-scheduling timer per mounted loader and ignores late responses after cleanup. Four-second queues, eight-second menu/dashboard refreshes and ten-second catalogue/report refreshes.
- Checkout quantities are capped against the current menu, while final prices and reservations are computed only in the original Order Service transaction. Checkout never simulates payment.
- The customer timeline maps OUT_FOR_DELIVERY to “Delivery in progress,” with a separate physical delivery status/driver label. READY without a delivery shows waiting, not out for delivery.
- Menu inventory exposes the original stock and availability update; no unsupported price-update call is shown.
- All food art, icons, fonts and the explicitly illustrative delivery map work without external asset APIs.
- PowerShell API-only seeding and real workflow/concurrency checks are in `scripts/`; `DEMO-DATA.md` documents their usage. Seeding reuses existing records and preserves stock/hours.
- The previous frontend is archived; unused monolithic API/style/utility files were replaced with organized modules. Source is formatted with local Prettier.
- Service Docker build contexts exclude generated `target/` files and logs. Local Ballerina builds regenerate the four changed service lockfiles with the installed 2201.13.6 compiler (project/Docker distribution remains 2201.13.4).

## Completed checks so far

- `npm.cmd install`: passed, 74 packages audited, zero vulnerabilities reported at installation.
- `npm.cmd run build`: passed; 72 modules, approximately 323 kB JS / 44 kB CSS before gzip.
- Headless Microsoft Edge browser suite: **8 passed** after the component refactor. Contract fixtures are isolated to tests, with no fixture fallback in the shipped app. Covers session/role routing, customer registration, checkout payload/stock limits, status polling, kitchen actions without ID entry, delivery state actions/waiting separation, restaurant/driver/menu creation, stock/availability updates, published and closed hours, API failure/retry and a 390px viewport overflow check.
- Desktop entry/menu and mobile ordering screenshots captured and visually reviewed.
- Native Ballerina builds: Customer, Restaurant, Order and Delivery all generated executables. Existing transitive connector/jar warnings were emitted. Windows UTF-8 BOMs in the two new helper files were removed after the compiler flagged them.
- Both PowerShell scripts passed syntax parsing.
- Compose configuration validation passed; Docker Desktop was started without removing existing volumes. Full container build/live API verification is recorded below when finished.
