# Foodlane frontend

React + Vite interface for the DSA Assignment 2 distributed food delivery platform. The original assignment architecture and documentation remain in `../docs/README.md`. The previous frontend is preserved in `../backups/frontend-before-redesign-20261015.zip`.

## Start the backend

Start Docker Desktop, then open PowerShell at the project root:

```powershell
Set-Location 'C:\Users\QUINTON KHUWISEB\Desktop\archives\ballerina\kafka-project'
docker compose up -d --build
docker compose ps
```

MySQL's initialization script runs on a new database volume. Existing volumes are preserved. Do not remove volumes to update the UI. Payment and Notification run through Kafka, with no browser-facing payment endpoint.

## Install and run the frontend

Use Node.js 22.12+ (the checked environment uses Node 22.17):

```powershell
Set-Location .\frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies all API requests; no CORS/schema changes are needed. To check the production bundle:

```powershell
npm.cmd run build
```

`npm.cmd` works even when PowerShell's execution policy blocks `npm.ps1`. Plain `npm` also works where scripts are enabled.

The existing optional frontend Docker service is in `compose-snippet.yml`. Add it under `services:` in the root Compose file if you want Nginx to serve the UI, then `docker compose up -d --build frontend`. Do not also run Vite on port 5173. Nginx has matching service proxies and a history-routing fallback. `vite preview` previews static files only and does not provide the backend proxy; use Vite dev or the Nginx container for the full workflow.

## Demo sign-in

- **Customer:** create an account with the real Customer Service, or log in using an existing registered email. No customer password is requested because the schema has none. This is intentionally email-only demo identity, not production authentication.
- **Admin:** username `admin`, password `admin123`, centralized in `src/config/demoAuth.js`.
- **Kitchen and delivery:** no sign-in. Links appear on the entry page; open them in separate tabs to demonstrate the workflow.

Sessions are stored per tab in `sessionStorage` and survive reloads until logout/tab closure. Only role and customer details are stored. Route guards separate the interfaces; the APIs themselves remain unauthenticated assignment APIs. Frontend role checks do not provide server-side security.

## Pages

| Route | Experience |
| --- | --- |
| `/` | Customer login/create account or admin login |
| `/restaurants` | Customer restaurant gallery and opening hours |
| `/order/:restaurantId` | Searchable menu, stock-aware cart, saved addresses and checkout |
| `/customer/orders` | Current order timelines and past orders |
| `/kitchen` | Restaurant picker, no login |
| `/kitchen/:restaurantId` | Confirmed → preparing → ready kitchen queue |
| `/delivery` | Waiting, active and historical deliveries, global driver availability and schematic map |
| `/admin` | Real dashboard totals, status breakdown and restaurant performance |
| `/admin/restaurants` | Restaurant list and creation |
| `/admin/restaurants/:restaurantId` | Overview, menu/inventory, hours, orders and reports |
| `/admin/drivers` | Global driver list and creation |
| `/admin/orders` | Orders filtered by status |
| `/admin/reports` | Admin Service status and restaurant reports |

## Workflow

1. Customer signs in → selects a restaurant → adds food → enters/selects a delivery address → places an order.
2. Order Service reserves stock transactionally and publishes `orders.created`. Payment Service processes the simulated payment and emits `payments.completed`. Order Service confirms the order. React never confirms payments.
3. Kitchen automatically sees confirmed orders. Staff use the order card to Start preparing, then Mark ready through the original Restaurant Service actions.
4. Delivery Service automatically assigns a global AVAILABLE driver under its original row-lock/version protections. If all drivers are busy, the READY order remains in Waiting; a backend job retries every five seconds, including after restart.
5. The driver uses the delivery card: Pick up → Start delivery → Complete delivery. Completion releases the driver and publishes `delivery.completed`; Order Service updates the customer order to DELIVERED.
6. The customer's tracking page refreshes automatically. No one needs to type an order or delivery ID.

**Existing state-machine detail:** Order Service changes READY → OUT_FOR_DELIVERY on `delivery.assigned`, before pickup. The UI calls that order stage “Delivery in progress” and separately displays the delivery's ASSIGNED/PICKED_UP/OUT_FOR_DELIVERY status and driver. It never claims physical pickup from assignment alone.

Cancellation remains supported only from CONFIRMED or PREPARING. It restores stock using the existing transaction and emits the original cancellation event. The existing Payment Service does not implement refunds; the cancellation confirmation says so. Admin completed-payment totals and delivered-order revenue are intentionally labelled separately.

Published restaurant hours use Sunday=0 through Saturday=6 and the device's local clock. Closed published hours prevent UI checkout. Missing hours are labelled “Hours not published”; the original backend only checks restaurant.active, so it may still accept direct API orders outside published hours. No backend scheduling policy was silently introduced.

## Automatic updates and error handling

`src/hooks/usePolling.js` schedules a new request only after the prior request settles. Kitchen, delivery, drivers and customer tracking use a four-second delay. Less urgent menu/admin data uses eight seconds; restaurant lists/reports use ten seconds. Timers are cleaned up when a page unmounts, and late responses are ignored. A subtle indicator shows Live updates or Reconnecting; errors remain visible with retry controls. Mutations refresh the page's data without reloading the browser. Loading, empty and failure states are separate.

The HTTP helper centralizes JSON parsing, 15-second timeouts and friendly errors. A failed checkout may occur after the order was saved but Kafka publication failed in the existing backend; its error tells the customer to check My orders before retrying. Mutations are never retried automatically.

## API map

Existing Vite and Nginx prefixes are preserved:

| Frontend prefix | Service |
| --- | --- |
| `/customer-api` | Customer, localhost:8081 |
| `/restaurant-api` | Restaurant, localhost:8082 |
| `/order-api` | Order, localhost:8083 |
| `/delivery-api` | Delivery, localhost:8085 |
| `/admin-api` | Admin, localhost:8087 |

New small backend resources:

| Endpoint | Purpose |
| --- | --- |
| `GET /customers/lookup?email=...` | Real customer lookup for demo sign-in |
| `GET /restaurants` | Catalogue, menu counts and published weekly hours |
| `POST /restaurants` | Create name/address with optional email/phone |
| `POST /restaurants/{id}/menu` | Create name/description/price/stockQuantity |
| `GET /orders?restaurantId=...&customerId=...` | Filtered order details, items, history and driver/delivery state; zero/omitted filters mean all |
| `GET /deliveries` | Joined delivery list |
| `GET /deliveries/waiting` | READY orders with no delivery row |
| `GET /deliveries/drivers` | Global drivers |
| `POST /deliveries/drivers` | Create fullName/email/phone, initially AVAILABLE |

Existing create-customer/address, inventory, opening-hours, kitchen, order create/cancel, delivery action and Admin Service report endpoints remain in use. No endpoint is guessed or simulated in the production app. There is no price-update API: prices are set at menu-item creation; inventory management changes stock and availability only. No database migrations were needed.

## Source structure

`api/` contains explicit service adapters, `context/` demo sessions and toast feedback, `hooks/` controlled polling, `layouts/` role navigation, `components/` reusable UI, `pages/` routed workflows, `styles/` the responsive theme, and `utils/` status/price/time mapping. Icons are local inline SVG; food art uses local CSS illustrations. Product names only choose decorative illustrations, not invented database categories.

## Demo setup and checks

Follow `../DEMO-DATA.md`; `../scripts/Seed-Demo.ps1` creates three restaurants, twenty menu items, two customers and at least two drivers through the public APIs. `../scripts/Test-Workflow.ps1` exercises the real backend lifecycle and concurrency protections on an idle demo system.

Browser checks use explicitly isolated test fixtures in `tests/`; they check the UI contract, routing, checkout quantities, polling, valid actions, admin forms and mobile layout. They do not prove Kafka behavior. Run with installed Microsoft Edge:

```powershell
npm.cmd run test:e2e
```

On another operating system, install Playwright Chromium with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` (PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'chromium'`). `docs/FRONTEND-IMPLEMENTATION.md` records the actual verification results and limitations.

## Offline considerations

Fonts use the system stack. React, routing and CSS are bundled with npm. No Google Fonts, maps, icon CDN, external auth or remote product photography is required. The delivery map is an **illustrative schematic**, not GPS or a real geographic route. Its isolated component can later accept a coordinate adapter.

After dependencies/images are installed, the app can operate with the local Docker backend without internet. This is not a service-worker/PWA offline cache: the local server, MySQL and Kafka still need to be running. First-time npm installation, Ballerina dependency resolution and Docker image pulls require internet.
