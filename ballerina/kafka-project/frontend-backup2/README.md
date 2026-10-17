# Savour Studio — Distributed Food Delivery Frontend

A **visual redesign** of the supplied DSA612S Assignment 2 frontend. The new look is editorial and bold: midnight/navy, chartreuse, violet, and warm paper. It is a working React/Vite project, **not a replacement backend**.

## Get started

1. Start the project's existing Ballerina/Kafka/MySQL microservices as usual (for example, from the parent directory with `docker compose up -d --build`).
2. In this frontend folder, install the dependencies and run Vite:

   ```bash
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`.

To produce the deployable static bundle, run `npm run build`. You can also build the existing `Dockerfile`; the included `nginx.conf` serves React history routes and proxies the API service prefixes. If the backend runs only in Docker, the Vite proxy URLs in `vite.config.js` assume those five services are published on the host.

On PowerShell, use `npm.cmd install` and `npm.cmd run dev` if the default execution policy blocks `npm.ps1`.

**Don't extract or copy the old `node_modules` from Windows to Linux.** Always install dependencies natively on the computer that runs the project.

## Features retained

- Customer account creation and demo email lookup/sign-in, restaurant discovery, menu search, stock-aware basket, quantity controls, saved delivery addresses, and order placement.
- Customer order history, tracking timeline, and cancellation where permitted by the backend.
- Kitchen restaurant selection; confirmed → preparing → ready workflow.
- Delivery waiting/active/history views, driver assignment status, schematic map, pickup, departure, and completion.
- Admin dashboard, restaurant creation, menu/inventory editing, opening hours, driver creation, order status filtering, and reports.
- Polling, loading states, visible connection errors, and retry controls.

## Routes (unchanged)

| URL | What it shows |
| --- | --- |
| `/` | Customer and admin login / customer registration |
| `/restaurants` | Customer discovery |
| `/order/:restaurantId` | Restaurant menu and checkout |
| `/customer/orders` | Customer orders and tracking |
| `/kitchen` | Kitchen picker |
| `/kitchen/:restaurantId` | Kitchen preparation board |
| `/delivery` | Delivery dispatch |
| `/admin` | Management overview |
| `/admin/restaurants` | Restaurants |
| `/admin/restaurants/:restaurantId` | Restaurant details, inventory, orders, hours and reports |
| `/admin/drivers` | Drivers |
| `/admin/orders` | Admin order table |
| `/admin/reports` | Reports and statistics |

## Backend endpoints (unchanged)

All requests use the original `src/api/` files and the existing Vite/Nginx proxy map:

| Prefix | Microservice | Default host port |
| --- | --- | --- |
| `/customer-api` | Customer | 8081 |
| `/restaurant-api` | Restaurant | 8082 |
| `/order-api` | Order | 8083 |
| `/delivery-api` | Delivery | 8085 |
| `/admin-api` | Admin | 8087 |

The payment and notification interactions still happen behind the backend using Kafka; the browser does not call those services directly.

## What changed

- A new **Savour Studio** identity and editorial homepage.
- Top navigation and a status strip instead of a permanent left sidebar.
- A reversed split login layout with a nighttime poster-style food collage.
- Wide horizontal restaurant cards and a larger lavender feature panel.
- On desktop, the basket sits **left** of the product gallery; menu cards become horizontal mini-panels.
- Restyled order tracking, charts, inventory, kitchen queues, delivery cards, modal dialogs and form controls.
- Responsive rules for desktops, tablets and phones.

The **primary new styling file** is `src/styles/savour.css`, loaded after the original theme and responsive CSS. The reusable layout is `src/layouts/AppLayout.jsx`. Other targeted wording/layout changes are in `AuthPage.jsx`, `RestaurantsPage.jsx`, and `OrderingPage.jsx`.

## Demo access and important notes

The demo admin credentials remain in `src/config/demoAuth.js` (the UI shows them on the demo login screen). The customer demo uses an existing registered email, or you can create a customer. Kitchen and dispatch workspaces remain accessible without login, matching the supplied frontend. This is a classroom demo, **not production authentication**.

The delivery map is still a schematic, not live GPS. Restaurants, drivers and orders must be available from the existing backend for the pages to show real data. No database schema or Kafka topic changes were added by this redesign.

### Verification

Source files were syntax-checked using the local Babel parser, and the original route/API files were compared with the uploaded archive. A full production bundle and browser workflow test could not be executed in the build environment because the uploaded dependencies contained Windows-only binaries; run `npm install`, `npm run build`, and `npm run test:e2e` on your machine. On Linux, the Playwright config may need a browser channel change (`PLAYWRIGHT_CHANNEL=chromium` after installing Playwright Chromium).

Since this is assessed coursework, review the changes, test your flows, and be prepared to explain the code in the presentation.
