# Nightshift Eats — DSA612S frontend redesign

This is a **full visual and layout rebuild** of the provided React/Vite frontend, NOT a replacement backend. The same client-side state, API calls, routes, authentication demo and microservice flows remain in place.

## Start it locally

From inside `frontend`:

```bash
npm install
npm run dev
```

Open http://localhost:5173. Run the existing Ballerina/Kafka/SQL backend and Docker services as normal. If the frontend runs on the host while backend is in Docker, make sure the Vite proxy ports in `vite.config.js` are published. `npm run build` builds a production bundle.

On Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if PowerShell blocks npm.ps1. **Do not reuse a `node_modules` directory across Windows and Linux**; `npm install` selects native binaries for the current platform.

## Actual changes

- New **Nightshift Eats** name, charcoal/forest-green canvases, acid-lime and paprika accents, expressive condensed type.
- Completely new edge-to-edge photographic landing page and sign-in layout.
- Fixed compact icon navigation rail, independent top status bar and workspace headers.
- Huge editorial food feature on discovery, with entirely new horizontal restaurant results instead of repeating grid cards.
- New split restaurant title banner, rows of photographed menu items, and receipt-like sticky cart on the **right** with original quantity/address/checkout actions.
- New delivery operations control-room composition with an **actual OpenStreetMap geographic map of Namibia**. Choose a delivery card to focus the map on its city (when recognised), with the backend's original pickup/depart/complete actions.
- Management, kitchen, reports, customer order history and driver views retain their components/workflows, now arranged within the distinct dark operations frame with new typography, panels, controls and spacing.
- Mobile layouts provided.

## Truthful map limitations

OpenStreetMap is a **real interactive geographical basemap**, not the prior mock map. It requires an internet connection to display tiles. A matched city marker is the approximate city centre. **The existing backend returns a plain-text address and delivery status but NO GPS coordinates, geocoding, route geometry, ETA or location updates.** Therefore this UI does not pretend that map markers are precise customer destinations or real-time driver positions. Adding live tracking would require additional APIs and driver location events; none were added or changed. Map data © OpenStreetMap contributors; links and attribution are shown in the UI. Based on the official OSM embed URL.

## Food photography

The photographs are **actual third-party Unsplash images**, not AI-generated images. They are linked as external image URLs (images.unsplash.com) to keep the ZIP small. An internet connection is required to load them. They are **representative food images** matched to food words in the menu item name because the backend has no image URL or photo field. The interface makes no claim that a photo represents the actual item at a specific restaurant.

Image photo IDs sourced through publicly available Unsplash photos; notable sources include:
- Cheeseburger: https://unsplash.com/photos/ (Unsplash ID `photo-1568901346375-23c9450c58cd`)
- Double burger: `photo-1550547660-d9450f859349`
- Pizza: `photo-1513104890138-7c749659a591`
- Other categories (`src/components/FoodArt.jsx`): drinks, fries, desserts, wraps, chicken, salads; all loaded through Unsplash's photo image URLs.

Unsplash license: https://unsplash.com/license. Verify the source of images before public commercial deployment, and replace them with genuine restaurant-supplied images when the backend supports them.

## Functional routes preserved

| URL | Function |
| --- | --- |
| `/` | Customer demo login/registration; demo admin login; shortcuts to kitchen and dispatch |
| `/restaurants` | Customer restaurant browse/search |
| `/order/:restaurantId` | Menu, stock-aware basket, saved addresses and order placement |
| `/customer/orders` | Order timeline/history, cancellation when allowed |
| `/kitchen` | Kitchen selection |
| `/kitchen/:restaurantId` | Preparation board with status changes |
| `/delivery` | Dispatch, pickup, departure, completion, driver availability, real geographic map |
| `/admin` | Dashboard |
| `/admin/restaurants` | Restaurant management |
| `/admin/restaurants/:restaurantId` | Menu management, inventory, opening hours, order history and reports |
| `/admin/drivers` | Driver management |
| `/admin/orders` | All-order view and status filter |
| `/admin/reports` | Analytics |

All files under `src/api` are byte-for-byte identical to the uploaded original. Proxy, Dockerfile, compose snippet and Nginx config are preserved. **No backend changes are necessary.**

## Testing information

The source JSX was syntax-parsed, all API files compared against the original, and CSS syntax was parsed successfully. Production bundling couldn't be completed in the authoring environment: dependencies inside the uploaded ZIP contain Windows-only Rollup/esbuild binaries and this Linux environment cannot download its native equivalents. On your Windows computer, `npm install` followed by `npm run build` should install the correct native dependencies; please run it and report any errors. An integrated live-backend feature test was not performed here.
