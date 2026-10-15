import { test, expect } from "@playwright/test";
import { baseOrder, mockApi, signInAdmin, signInCustomer } from "./fixtures";

test("customer checkout uses real contract, respects stock and tracks polling updates", async ({
  page,
}) => {
  const state = await mockApi(page);
  await signInCustomer(page);
  await expect(
    page.getByRole("link", { name: "Drivers", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Explore menu" }).click();
  await expect(
    page.getByRole("button", { name: "Add Fries to order" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Add Classic Beef Burger to order" })
    .click();
  await page
    .getByRole("button", { name: "Add one Classic Beef Burger" })
    .click();
  await page
    .getByRole("button", { name: "Add one Classic Beef Burger" })
    .click();
  await expect(
    page.getByRole("button", { name: "Add one Classic Beef Burger" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL("**/customer/orders");
  const checkout = state.calls.find(
    (call) => call.path === "/order-api/orders" && call.method === "POST",
  );
  expect(checkout.body).toEqual({
    customerId: 7,
    restaurantId: 4,
    deliveryAddress: "12 Independence Avenue, Windhoek",
    items: [{ menuItemId: 21, quantity: 3 }],
  });
  state.orders[0].status = "PREPARING";
  await expect(page.locator(".order-card .badge")).toHaveText("Preparing");
  await page.reload();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
  await page.goto("/admin");
  await page.waitForURL("**/restaurants");
});

test("kitchen cards advance only confirmed and preparing orders without ID entry", async ({
  page,
}) => {
  const state = await mockApi(page, { orders: [structuredClone(baseOrder)] });
  await page.goto("/kitchen/4");
  await page.getByRole("button", { name: "Start preparing" }).click();
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(
    page.getByText("Waiting for an available driver", { exact: true }),
  ).toBeVisible();
  expect(
    state.calls.some(
      (call) =>
        call.path === "/restaurant-api/restaurants/4/orders/51/prepare" &&
        call.method === "PUT",
    ),
  ).toBe(true);
  expect(
    state.calls.some(
      (call) =>
        call.path === "/restaurant-api/restaurants/4/orders/51/ready" &&
        call.method === "PUT",
    ),
  ).toBe(true);
  await expect(page.locator("input")).toHaveCount(0);
});

test("delivery exposes only valid actions and separates waiting orders", async ({
  page,
}) => {
  const state = await mockApi(page, {
    deliveries: [
      {
        id: 8,
        orderId: 51,
        driverId: 3,
        driverName: "Anna Johannes",
        restaurantName: "Burger House",
        customerName: "Quinton",
        deliveryAddress: "Windhoek",
        totalAmount: 85,
        itemCount: 1,
        status: "ASSIGNED",
        orderStatus: "OUT_FOR_DELIVERY",
      },
    ],
    waiting: [
      {
        orderId: 53,
        restaurantName: "Pizza Corner",
        customerName: "Demo Customer",
        deliveryAddress: "Windhoek",
        itemCount: 2,
        totalAmount: 120,
      },
    ],
  });
  await page.goto("/delivery");
  await expect(page.getByText("No live GPS · works offline")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete delivery" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Waiting 1" }).click();
  await expect(
    page.getByText("Waiting for a driver", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pick up", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Active 1" }).click();
  await page.getByRole("button", { name: "Pick up", exact: true }).click();
  await page
    .getByRole("button", { name: "Start delivery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(page.getByText("No active deliveries right now.")).toBeVisible();
  await page.getByRole("button", { name: "History 1" }).click();
  await expect(page.locator(".delivery-card .badge")).toHaveText("Delivered");
  expect(
    state.calls
      .filter((call) => call.method === "PUT")
      .map((call) => call.path),
  ).toEqual([
    "/delivery-api/deliveries/8/pickup",
    "/delivery-api/deliveries/8/out-for-delivery",
    "/delivery-api/deliveries/8/complete",
  ]);
});

test("admin creates restaurants, global drivers and menu items through service APIs", async ({
  page,
}) => {
  const state = await mockApi(page);
  await signInAdmin(page);
  await page.getByRole("link", { name: "Restaurants", exact: true }).click();
  await page
    .getByRole("button", { name: "Add restaurant", exact: true })
    .click();
  await page.getByLabel("Restaurant name").fill("Pizza Corner");
  await page.getByLabel("Street address").fill("Windhoek Central");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add restaurant", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pizza Corner" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Drivers", exact: true }).click();
  await page.getByRole("button", { name: "Add driver", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("David Amutenya");
  await page.getByLabel("Email address").fill("david@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("+264811110002");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add driver", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "David Amutenya" }),
  ).toBeVisible();
  await page.goto("/admin/restaurants/4");
  await page.getByRole("button", { name: "Menu & inventory" }).click();
  await page.getByRole("button", { name: "Add menu item" }).click();
  await page.getByLabel("Item name").fill("Chicken Wrap");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Grilled chicken and fresh greens.");
  await page.getByLabel("Price (N$)").fill("65");
  await page.getByLabel("Starting stock").fill("20");
  await page.getByRole("button", { name: "Add to menu" }).click();
  await expect(
    page.getByRole("heading", { name: "Chicken Wrap" }),
  ).toBeVisible();
  expect(
    state.calls.find(
      (call) =>
        call.path === "/restaurant-api/restaurants/4/menu" &&
        call.method === "POST",
    ).body,
  ).toMatchObject({ name: "Chicken Wrap", price: 65, stockQuantity: 20 });
});

test("API errors remain visible and mobile layouts do not overflow", async ({
  page,
}) => {
  const state = await mockApi(page);
  await signInCustomer(page);
  state.error = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "The kitchen service is unavailable.",
  );
  state.error = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Burger House" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Explore menu" }).click();
  await expect(page.getByRole("heading", { name: "Your order" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-ordering.png",
    fullPage: true,
  });
});

test("customer registration sends the schema fields and starts a demo session", async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Demo Customer");
  await page.getByLabel("Username", { exact: true }).fill("demo-customer");
  await page.getByLabel("Email address").fill("demo@example.com");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/restaurants");
  expect(
    state.calls.find(
      (call) =>
        call.path === "/customer-api/customers" && call.method === "POST",
    ).body,
  ).toEqual({
    username: "demo-customer",
    fullName: "Demo Customer",
    email: "demo@example.com",
    phone: null,
  });
});

test("restaurant inventory and opening hours use the existing update contracts", async ({
  page,
}) => {
  const state = await mockApi(page);
  await signInAdmin(page);
  await page.goto("/admin/restaurants/4");
  await page.getByRole("button", { name: "Menu & inventory" }).click();
  let row = page
    .locator(".inventory-item")
    .filter({
      has: page.getByRole("heading", { name: "Classic Beef Burger" }),
    });
  await row.getByRole("spinbutton").fill("10");
  await row.getByLabel("Available", { exact: true }).uncheck();
  await row.getByRole("button", { name: "Save stock" }).click();
  await expect(row.getByText("Unavailable", { exact: true })).toBeVisible();
  expect(
    state.calls.find(
      (call) =>
        call.path.endsWith("/menu/21/inventory") && call.method === "PUT",
    ).body,
  ).toEqual({ stockQuantity: 10, available: false });
  await page
    .getByRole("button", { name: "Opening hours", exact: true })
    .click();
  const sunday = page.locator(".hours-row").first();
  await sunday.getByLabel("Sunday opening time").fill("09:00");
  await sunday.getByLabel("Sunday closing time").fill("18:00");
  await sunday.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sunday.getByLabel("Sunday opening time")).toHaveValue("09:00");
  expect(
    state.calls.find(
      (call) => call.path.endsWith("/hours/0") && call.method === "PUT",
    ).body,
  ).toEqual({ openTime: "09:00", closeTime: "18:00", closed: false });
  await sunday.getByLabel("Closed", { exact: true }).check();
  await expect(sunday.getByLabel("Sunday opening time")).toBeDisabled();
  await sunday.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sunday.getByLabel("Closed", { exact: true })).toBeChecked();
  expect(
    state.calls
      .filter((call) => call.path.endsWith("/hours/0") && call.method === "PUT")
      .at(-1).body,
  ).toEqual({ openTime: "", closeTime: "", closed: true });
});

test("capture representative desktop design and navigation", async ({
  page,
}) => {
  await mockApi(page, { orders: [structuredClone(baseOrder)] });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/auth-desktop.png",
    fullPage: true,
  });
  await signInCustomer(page);
  await page.getByRole("link", { name: "Explore menu" }).click();
  await page
    .getByRole("button", { name: "Add Classic Beef Burger to order" })
    .click();
  await page.screenshot({
    path: "test-results/ordering-desktop.png",
    fullPage: true,
  });
});
