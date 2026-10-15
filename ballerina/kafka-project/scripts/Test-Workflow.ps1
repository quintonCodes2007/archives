param([int]$TimeoutSeconds = 60)
$ErrorActionPreference = 'Stop'

function Invoke-Api {
    param([string]$Method, [string]$Uri, $Body)
    $parameters = @{ Method = $Method; Uri = $Uri; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = ConvertTo-Json -InputObject $Body -Depth 10
    }
    Invoke-RestMethod @parameters
}
function Assert-Workflow {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Output "PASS: $Message"
}
function Wait-Until {
    param([scriptblock]$Read, [scriptblock]$Condition, [string]$Description)
    $deadline = [datetime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $value = & $Read
        if (& $Condition $value) { return $value }
        Start-Sleep -Milliseconds 500
    } while ([datetime]::UtcNow -lt $deadline)
    throw "Timed out: $Description"
}

$customer = Invoke-Api GET 'http://localhost:8081/customers/lookup?email=quinton%40example.com'
$restaurant = @(Invoke-Api GET 'http://localhost:8082/restaurants') | Where-Object name -eq 'Burger House' | Select-Object -First 1
if ($null -eq $restaurant) { throw 'Run scripts/Seed-Demo.ps1 first.' }
$restaurantId = $restaurant.id
$drivers = @(Invoke-Api GET 'http://localhost:8085/deliveries/drivers')
$existingActive = @(Invoke-Api GET 'http://localhost:8085/deliveries') | Where-Object { $_.status -notin @('DELIVERED','CANCELLED') }
$available = @($drivers | Where-Object status -eq 'AVAILABLE')
if ($existingActive -or $available.Count -lt 2) { throw 'Use an idle demo system with at least two AVAILABLE drivers.' }
$runId = [guid]::NewGuid().ToString('N').Substring(0,8)
$stockItem = Invoke-Api POST "http://localhost:8082/restaurants/$restaurantId/menu" @{
    name = "Workflow test $runId"; description = 'Isolated API/concurrency test item'; price = 25; stockQuantity = ($available.Count + 5)
}

function New-TestOrder {
    param([int]$MenuItemId)
    Invoke-Api POST 'http://localhost:8083/orders' @{
        customerId = $customer.id; restaurantId = $restaurantId
        deliveryAddress = '12 Independence Avenue, Windhoek'
        items = @(@{ menuItemId = $MenuItemId; quantity = 1 })
    }
}
function Read-TestOrder {
    param([int]$Id)
    @(Invoke-Api GET "http://localhost:8083/orders?customerId=$($customer.id)") | Where-Object id -eq $Id
}

$orderIds = @()
foreach ($index in 0..$available.Count) {
    $created = New-TestOrder $stockItem.id
    $orderIds += $created.id
    $null = Wait-Until { Read-TestOrder $created.id } { param($value) $value.status -eq 'CONFIRMED' } 'Kafka payment confirmation'
    $null = Invoke-Api PUT "http://localhost:8082/restaurants/$restaurantId/orders/$($created.id)/prepare"
    $null = Invoke-Api PUT "http://localhost:8082/restaurants/$restaurantId/orders/$($created.id)/ready"
}
$initialDeliveries = @(Wait-Until {
    @(Invoke-Api GET 'http://localhost:8085/deliveries') | Where-Object { $_.orderId -in $orderIds }
} { param($value) @($value).Count -eq $available.Count } 'multiple driver assignments')
Assert-Workflow (@($initialDeliveries.driverId | Select-Object -Unique).Count -eq $available.Count) 'Each simultaneous delivery has a different global driver'
$waiting = @(Wait-Until { Invoke-Api GET 'http://localhost:8085/deliveries/waiting' } {
    param($value) @($value | Where-Object { $_.orderId -in $orderIds }).Count -eq 1
} 'one order waiting for a driver') | Where-Object { $_.orderId -in $orderIds }
Assert-Workflow ((Read-TestOrder $waiting[0].orderId).status -eq 'READY') 'Unassigned order remains READY, never falsely out for delivery'

foreach ($delivery in $initialDeliveries) {
    $null = Wait-Until { Read-TestOrder $delivery.orderId } { param($value) $value.status -eq 'OUT_FOR_DELIVERY' } 'assignment event reaches Order Service'
    $null = Invoke-Api PUT "http://localhost:8085/deliveries/$($delivery.id)/pickup"
    $null = Invoke-Api PUT "http://localhost:8085/deliveries/$($delivery.id)/out-for-delivery"
    $null = Invoke-Api PUT "http://localhost:8085/deliveries/$($delivery.id)/complete"
}
$next = Wait-Until { @(Invoke-Api GET 'http://localhost:8085/deliveries') | Where-Object orderId -eq $waiting[0].orderId } { param($value) $null -ne $value } 'backend retries waiting order'
Assert-Workflow ($next.status -eq 'ASSIGNED') 'Waiting order automatically receives a newly available driver'
$null = Wait-Until { Read-TestOrder $next.orderId } { param($value) $value.status -eq 'OUT_FOR_DELIVERY' } 'waiting assignment event reaches Order Service'
$null = Invoke-Api PUT "http://localhost:8085/deliveries/$($next.id)/pickup"
$null = Invoke-Api PUT "http://localhost:8085/deliveries/$($next.id)/out-for-delivery"
$null = Invoke-Api PUT "http://localhost:8085/deliveries/$($next.id)/complete"
$null = Wait-Until {
    @(Invoke-Api GET "http://localhost:8083/orders?customerId=$($customer.id)") | Where-Object { $_.id -in $orderIds }
} { param($value) @($value | Where-Object status -eq 'DELIVERED').Count -eq $orderIds.Count } 'Kafka delivery completion'
Write-Output 'PASS: all orders reached DELIVERED through Kafka'

$before = @(Invoke-Api GET "http://localhost:8082/restaurants/$restaurantId/menu") | Where-Object id -eq $stockItem.id
$cancelled = New-TestOrder $stockItem.id
$null = Wait-Until { Read-TestOrder $cancelled.id } { param($value) $value.status -eq 'CONFIRMED' } 'cancellable order confirmed'
$null = Invoke-Api PUT "http://localhost:8083/orders/$($cancelled.id)/cancel"
$after = @(Invoke-Api GET "http://localhost:8082/restaurants/$restaurantId/menu") | Where-Object id -eq $stockItem.id
Assert-Workflow ($after.stockQuantity -eq $before.stockQuantity) 'Cancellation restores reserved stock'

# Two independent PowerShell processes race for the last unit. This checks the
# actual Order Service transaction; no client-side counter is used as proof.
$raceItem = Invoke-Api POST "http://localhost:8082/restaurants/$restaurantId/menu" @{
    name = "Last unit $runId"; description = 'Isolated last-unit race'; price = 15; stockQuantity = 1
}
$raceBody = @{
    customerId = $customer.id; restaurantId = $restaurantId; deliveryAddress = 'Windhoek test address'
    items = @(@{ menuItemId = $raceItem.id; quantity = 1 })
} | ConvertTo-Json -Depth 5
$jobs = foreach ($index in 1..2) {
    Start-Job -ArgumentList $raceBody -ScriptBlock {
        param($body)
        try {
            $created = Invoke-RestMethod -Method Post -Uri 'http://localhost:8083/orders' -ContentType 'application/json' -Body $body
            [pscustomobject]@{ status = 200; id = $created.id }
        } catch { [pscustomobject]@{ status = [int]$_.Exception.Response.StatusCode; id = 0 } }
    }
}
$race = @($jobs | Wait-Job | Receive-Job)
$jobs | Remove-Job
Assert-Workflow (@($race | Where-Object status -eq 200).Count -eq 1 -and @($race | Where-Object status -eq 409).Count -eq 1) 'Exactly one concurrent checkout reserves the last unit'
$winner = $race | Where-Object status -eq 200
$null = Wait-Until { Read-TestOrder $winner.id } { param($value) $value.status -eq 'CONFIRMED' } 'race winner payment'
$null = Invoke-Api PUT "http://localhost:8083/orders/$($winner.id)/cancel"
$remaining = @(Invoke-Api GET "http://localhost:8082/restaurants/$restaurantId/menu") | Where-Object id -eq $raceItem.id
Assert-Workflow ($remaining.stockQuantity -eq 1) 'Race winner cancellation restores exactly one unit'

# Leave isolated test products unavailable without deleting historical data.
foreach ($item in @($stockItem, $raceItem)) {
    $current = @(Invoke-Api GET "http://localhost:8082/restaurants/$restaurantId/menu") | Where-Object id -eq $item.id
    $null = Invoke-Api PUT "http://localhost:8082/restaurants/$restaurantId/menu/$($item.id)/inventory" @{
        stockQuantity = $current.stockQuantity; available = $false
    }
}
Write-Output "Workflow checks passed. Created real order IDs: $($orderIds -join ', '); cancellation IDs: $($cancelled.id), $($winner.id)."
