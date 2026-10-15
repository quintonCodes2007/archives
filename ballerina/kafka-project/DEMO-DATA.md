# Foodlane demo data

Start Docker Desktop, then run from the project root in PowerShell:

```powershell
Set-Location 'C:\Users\QUINTON KHUWISEB\Desktop\archives\ballerina\kafka-project'
docker compose up -d --build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Seed-Demo.ps1
```

The script uses **only real REST APIs**, with no direct SQL. It creates Burger House (10 products), Pizza Corner (5 products), Chicken Spot (5 products), two customers with addresses, and two global drivers. Prices are Namibia dollars, N$15–N$130. Existing customers are matched by email, restaurants/products by name and drivers by email. Rerunning preserves existing stock, published hours, drivers and orders. Fix any existing conflicting usernames/phone numbers rather than expecting the script to overwrite them.

Fresh demo restaurants have published hours 00:00–23:59 every day so you can demonstrate most of the day. The UI uses the device's local time. Missing hours are not presented as a claim that the restaurant is open. No invented restaurant categories or image fields are stored.

Sign in as a customer using `quinton@example.com` or `demo@example.com`. Customer sign-in is an **email-only assignment demo**, resolving real Customer Service records. Admin: `admin` / `admin123`.

## Inspect IDs through the APIs

`curl.exe` is explicit because Windows PowerShell may alias `curl` to `Invoke-WebRequest`.

```powershell
curl.exe 'http://localhost:8082/restaurants'
curl.exe 'http://localhost:8081/customers/lookup?email=quinton%40example.com'
curl.exe 'http://localhost:8085/deliveries/drivers'
$restaurants = @(Invoke-RestMethod 'http://localhost:8082/restaurants')
$burger = $restaurants | Where-Object name -eq 'Burger House' | Select-Object -First 1
$menu = @(Invoke-RestMethod "http://localhost:8082/restaurants/$($burger.id)/menu")
$menu | Format-Table id, name, price, stockQuantity
```

## Create an order without guessing IDs

Use the variables above, then:

```powershell
$customer = Invoke-RestMethod 'http://localhost:8081/customers/lookup?email=quinton%40example.com'
$item = $menu | Where-Object { $_.available -and $_.stockQuantity -gt 0 } | Select-Object -First 1
if ($null -eq $item) { throw 'Add stock through restaurant administration first.' }
$body = @{
    customerId = $customer.id
    restaurantId = $burger.id
    deliveryAddress = '12 Independence Avenue, Windhoek'
    items = @(@{ menuItemId = $item.id; quantity = 1 })
} | ConvertTo-Json -Depth 5
$order = Invoke-RestMethod -Method Post -Uri 'http://localhost:8083/orders' -ContentType 'application/json' -Body $body
$order
# Payment confirms asynchronously; no payment API call is needed.
Invoke-RestMethod "http://localhost:8083/orders?customerId=$($customer.id)"
Invoke-RestMethod "http://localhost:8083/orders?restaurantId=$($burger.id)"
```

## Demonstrate all four workspaces

1. In the frontend (`http://localhost:5173`), customer sign-in → choose Burger House → add food → choose/type an address → Place order → My orders. No order ID entry.
2. Open `/kitchen` in another tab → choose Burger House → confirmed orders appear → Start preparing → Mark ready.
3. Open `/delivery` → assigned delivery appears → Pick up → Start delivery → Complete delivery. The customer page updates automatically.
4. Admin sign-in → Restaurants → manage menu stock/availability and weekly hours; add restaurants and global drivers; inspect Orders/Reports.

For concurrency, mark two orders ready with two AVAILABLE drivers. They should receive different drivers. Create a third while both are busy: it stays in Waiting. Complete one delivery and the backend's five-second retry assigns a free driver. To demonstrate inventory protection, use a low-stock item and place concurrent orders; the backend must reject overselling. Do not change stock while running that test.

The order status becomes OUT_FOR_DELIVERY when a driver is assigned in the existing Order Service. Delivery rows separately show ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY and DELIVERED. The customer UI labels the order stage “Delivery in progress” and shows the actual delivery state, so assignment is not presented as physical pickup.

## Validation script

After seeding, `scripts/Test-Workflow.ps1` exercises real payment confirmation, kitchen transitions, delivery actions, stock reservation/restoration, multiple drivers and waiting-queue recovery. It creates **one more order than the available driver count** (three orders with two drivers), plus two cancellation orders and two isolated test menu items. It requires an idle delivery system with at least two AVAILABLE drivers. Test items are left unavailable, preserving history. Run it only on this assignment/demo database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Workflow.ps1
```

The service API contracts and verification record are in `docs/FRONTEND-IMPLEMENTATION.md`. No seeding or test success is implied unless the commands actually complete against a running backend.
