param(
    [string]$CustomerBase = 'http://localhost:8081',
    [string]$RestaurantBase = 'http://localhost:8082',
    [string]$DeliveryBase = 'http://localhost:8085'
)
$ErrorActionPreference = 'Stop'

function Send-DemoRequest {
    param([string]$Method, [string]$Uri, $Body)
    $parameters = @{ Method = $Method; Uri = $Uri; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = ConvertTo-Json -InputObject $Body -Depth 10
    }
    Invoke-RestMethod @parameters
}

function Get-OrCreateDemoCustomer {
    param([string]$Username, [string]$Name, [string]$Email)
    try {
        return Send-DemoRequest GET "$CustomerBase/customers/lookup?email=$([uri]::EscapeDataString($Email))"
    } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
    }
    Send-DemoRequest POST "$CustomerBase/customers" @{
        username = $Username; fullName = $Name; email = $Email; phone = $null
    }
}

$Quinton = Get-OrCreateDemoCustomer 'quinton' 'Quinton' 'quinton@example.com'
$DemoCustomer = Get-OrCreateDemoCustomer 'demo-customer' 'Demo Customer' 'demo@example.com'
foreach ($customer in @($Quinton, $DemoCustomer)) {
    $addresses = @(Send-DemoRequest GET "$CustomerBase/customers/$($customer.id)/addresses")
    if (-not ($addresses | Where-Object label -eq 'Demo home')) {
        $null = Send-DemoRequest POST "$CustomerBase/customers/$($customer.id)/addresses" @{
            label = 'Demo home'; addressLine = '12 Independence Avenue'; city = 'Windhoek'; isDefault = $true
        }
    }
}

function New-DemoItem {
    param([string]$Name, [string]$Description, [decimal]$Price, [int]$Stock = 40)
    @{ name = $Name; description = $Description; price = $Price; stockQuantity = $Stock }
}

$catalogue = @(
    @{
        name = 'Burger House'; address = '18 Independence Avenue, Windhoek'
        items = @(
            (New-DemoItem 'Classic Beef Burger' 'Grilled beef, lettuce, tomato and house sauce.' 85)
            (New-DemoItem 'Double Cheese Burger' 'Two beef patties with melted cheese.' 120)
            (New-DemoItem 'Crispy Chicken Burger' 'Crispy chicken, slaw and creamy mayo.' 80)
            (New-DemoItem 'Fries' 'Golden fries with a pinch of sea salt.' 25 80)
            (New-DemoItem 'Loaded Fries' 'Fries topped with cheese and smoky sauce.' 50)
            (New-DemoItem 'Chicken Wings' 'Six wings with your favourite house glaze.' 65)
            (New-DemoItem 'Coca-Cola' 'Chilled 330 ml soft drink.' 20 100)
            (New-DemoItem 'Sprite' 'Chilled 330 ml lemon-lime soft drink.' 20 100)
            (New-DemoItem 'Water' '500 ml bottled still water.' 15 100)
            (New-DemoItem 'Chocolate Brownie' 'Rich chocolate brownie, baked in house.' 35)
        )
    }
    @{
        name = 'Pizza Corner'; address = '7 Sam Nujoma Drive, Windhoek'
        items = @(
            (New-DemoItem 'Margherita' 'Tomato, mozzarella and fresh basil.' 95)
            (New-DemoItem 'Pepperoni' 'Classic pepperoni and mozzarella.' 120)
            (New-DemoItem 'BBQ Chicken Pizza' 'Chicken, red onion and smoky BBQ sauce.' 130)
            (New-DemoItem 'Garlic Bread' 'Oven-baked bread with garlic butter.' 35)
            (New-DemoItem 'Coca-Cola' 'Chilled 330 ml soft drink.' 20 100)
        )
    }
    @{
        name = 'Chicken Spot'; address = '22 Robert Mugabe Avenue, Windhoek'
        items = @(
            (New-DemoItem 'Fried Chicken Meal' 'Crispy chicken with fries and slaw.' 95)
            (New-DemoItem 'Chicken Wrap' 'Grilled chicken, fresh greens and house dressing.' 65)
            (New-DemoItem 'Spicy Wings' 'Six wings with a warm chilli glaze.' 70)
            (New-DemoItem 'Fries' 'Golden fries with a pinch of sea salt.' 25 80)
            (New-DemoItem 'Soft Drinks' 'A chilled 330 ml soft drink.' 20 100)
        )
    }
)
$restaurants = @(Send-DemoRequest GET "$RestaurantBase/restaurants")
foreach ($entry in $catalogue) {
    $restaurant = $restaurants | Where-Object name -eq $entry.name | Select-Object -First 1
    if ($null -eq $restaurant) {
        $restaurant = Send-DemoRequest POST "$RestaurantBase/restaurants" @{
            name = $entry.name; address = $entry.address; email = $null; phone = $null
        }
    }
    $menu = @(Send-DemoRequest GET "$RestaurantBase/restaurants/$($restaurant.id)/menu")
    foreach ($item in $entry.items) {
        if (-not ($menu | Where-Object name -eq $item.name)) {
            $null = Send-DemoRequest POST "$RestaurantBase/restaurants/$($restaurant.id)/menu" $item
        }
    }
    # Preserve existing published hours. Fresh demo restaurants are open all day.
    $hours = Send-DemoRequest GET "$RestaurantBase/restaurants/$($restaurant.id)/hours"
    foreach ($day in 0..6) {
        if (-not ($hours.hours | Where-Object dayOfWeek -eq $day)) {
            $null = Send-DemoRequest PUT "$RestaurantBase/restaurants/$($restaurant.id)/hours/$day" @{
                openTime = '00:00'; closeTime = '23:59'; closed = $false
            }
        }
    }
    Write-Output "$($entry.name): restaurant ID $($restaurant.id)"
}

$drivers = @(Send-DemoRequest GET "$DeliveryBase/deliveries/drivers")
foreach ($driver in @(
    @{ fullName = 'Anna Johannes'; email = 'anna.driver@example.com'; phone = '+264811110001' }
    @{ fullName = 'David Amutenya'; email = 'david.driver@example.com'; phone = '+264811110002' }
)) {
    if (-not ($drivers | Where-Object email -eq $driver.email)) {
        $null = Send-DemoRequest POST "$DeliveryBase/deliveries/drivers" $driver
    }
}
Write-Output "Quinton: customer ID $($Quinton.id), email $($Quinton.email)"
Write-Output "Demo Customer: customer ID $($DemoCustomer.id), email $($DemoCustomer.email)"
Write-Output 'Demo data ready. Existing stock, drivers and orders were preserved.'
