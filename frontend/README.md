
## Visual direction

The interface uses a modern street-food menu-board aesthetic inspired by restaurant poster/menu design: a charcoal grain texture, burnt orange accents, warm cream surfaces, condensed display typography and sharp rectangular layouts. It intentionally avoids gradients, glassmorphism, neon effects and generic card-heavy SaaS styling. No food photography is required for the layout to work.

# Counter /01 Frontend

React + Vite frontend for the DSA612S Distributed Food Delivery Platform.

## Design direction

Retro-technical restaurant docket / newspaper counter. Warm paper, black ink and one tomato-red accent. Editorial serif headlines are paired with operational monospace text. The interface intentionally avoids gradients, glassmorphism, generic icon cards and startup landing-page patterns.

## Local development

The Ballerina/Docker backend should already be running on:

- Customer Service: `8081`
- Restaurant Service: `8082`
- Order Service: `8083`
- Delivery Service: `8085`
- Admin Service: `8087`

Payment and Notification Services remain Kafka-driven and are not called directly by the browser.

Install and run:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Vite proxies browser requests so CORS changes are not required in the Ballerina services.

## Frontend proxy map

```text
/customer-api   -> http://localhost:8081
/restaurant-api -> http://localhost:8082
/order-api      -> http://localhost:8083
/delivery-api   -> http://localhost:8085
/admin-api      -> http://localhost:8087
```

## Backend endpoints used

### Customer Service

```text
GET  /customers/health
POST /customers
GET  /customers/{customerId}
POST /customers/{customerId}/addresses
GET  /customers/{customerId}/addresses
GET  /customers/{customerId}/orders
```

### Restaurant Service

```text
GET /restaurants/health
GET /restaurants/{restaurantId}/menu
PUT /restaurants/{restaurantId}/menu/{menuItemId}/inventory
GET /restaurants/{restaurantId}/hours
PUT /restaurants/{restaurantId}/hours/{dayOfWeek}
PUT /restaurants/{restaurantId}/orders/{orderId}/prepare
PUT /restaurants/{restaurantId}/orders/{orderId}/ready
```

### Order Service

```text
GET  /orders/health
POST /orders
PUT  /orders/{orderId}/cancel
```

Order creation payload:

```json
{
  "customerId": 1,
  "restaurantId": 1,
  "deliveryAddress": "Windhoek Central",
  "items": [
    {
      "menuItemId": 1,
      "quantity": 1
    }
  ]
}
```

### Delivery Service

```text
GET /deliveries/health
PUT /deliveries/{deliveryId}/pickup
PUT /deliveries/{deliveryId}/out-for-delivery
PUT /deliveries/{deliveryId}/complete
```

### Admin Service

```text
GET /admin/health
GET /admin/dashboard
GET /admin/orders/status
GET /admin/restaurants/report
```

## Main screens

- **Order desk**: customer lookup, address book, restaurant menu, opening hours, cart, create order, order history and cancellation.
- **Kitchen**: preparation state changes, inventory updates and weekly opening hours.
- **Courier**: pickup, out-for-delivery and completion actions.
- **Admin**: dashboard totals, order status report, restaurant report and service health strip.

## Docker deployment

The included `Dockerfile` builds the Vite app and serves it through Nginx. `nginx.conf` proxies requests to the Docker Compose service names.

Add a frontend service to the root `docker-compose.yml` similar to:

```yaml
frontend:
  build:
    context: ./frontend
  container_name: food_delivery_frontend
  ports:
    - "5173:80"
  depends_on:
    - customer-service
    - restaurant-service
    - order-service
    - delivery-service
    - admin-service
```

Then run from the repository root:

```bash
docker compose build frontend
docker compose up -d frontend
```

The production UI will then be available on `http://localhost:5173`.

## Integration note

The UI includes expandable "Raw service response" blocks on data-heavy screens. These are intentional: they make backend/JSON mismatches easy to inspect during the assignment defence without opening browser developer tools.
