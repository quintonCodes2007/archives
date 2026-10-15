// Deterministic browser-only fixtures. The application itself has no fallback
// data or simulated state transitions. Live Kafka tests are in scripts/.
export const customer = {
  id: 7,
  username: "quinton",
  fullName: "Quinton",
  email: "quinton@example.com",
  phone: null,
};
export const restaurant = {
  id: 4,
  name: "Burger House",
  address: "18 Independence Avenue, Windhoek",
  active: true,
  menuCount: 2,
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: "00:00",
    closeTime: "23:59",
    closed: false,
  })),
};
export const menu = [
  {
    id: 21,
    restaurantId: 4,
    name: "Classic Beef Burger",
    description: "Beef, lettuce and house sauce.",
    price: 85,
    stockQuantity: 3,
    available: true,
    version: 0,
  },
  {
    id: 22,
    restaurantId: 4,
    name: "Fries",
    description: "Golden and crispy.",
    price: 25,
    stockQuantity: 0,
    available: true,
    version: 0,
  },
];
export const baseOrder = {
  id: 51,
  customerId: 7,
  customerName: "Quinton",
  restaurantId: 4,
  restaurantName: "Burger House",
  deliveryAddress: "12 Independence Avenue, Windhoek",
  status: "CONFIRMED",
  totalAmount: 85,
  createdAt: "2026-10-15 12:00:00",
  deliveryId: null,
  deliveryStatus: null,
  driverName: null,
  items: [
    { menuItemId: 21, name: "Classic Beef Burger", quantity: 1, unitPrice: 85 },
  ],
  history: [],
};

export async function mockApi(page, initial = {}) {
  const state = {
    restaurants: structuredClone([restaurant]),
    menu: structuredClone(menu),
    orders: [],
    deliveries: [],
    waiting: [],
    drivers: [
      {
        id: 3,
        fullName: "Anna Johannes",
        email: "anna@example.com",
        phone: "+264811110001",
        status: "AVAILABLE",
      },
    ],
    calls: [],
    error: false,
    ...initial,
  };
  await page.route("**/*-api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.calls.push({ path, method, body: request.postDataJSON() });
    const json = async (data) => route.fulfill({ status: 200, json: data });
    if (state.error)
      return route.fulfill({
        status: 503,
        json: { message: "The kitchen service is unavailable." },
      });
    if (path.endsWith("/customers/lookup")) return json(customer);
    if (path.endsWith("/customers") && method === "POST")
      return json({ ...customer, ...request.postDataJSON() });
    if (path.endsWith("/addresses"))
      return json([
        {
          id: 2,
          customerId: 7,
          label: "Home",
          addressLine: "12 Independence Avenue",
          city: "Windhoek",
          isDefault: true,
        },
      ]);
    if (path === "/restaurant-api/restaurants") {
      if (method === "POST") {
        const row = {
          id: 5,
          active: true,
          menuCount: 0,
          hours: [],
          ...request.postDataJSON(),
        };
        state.restaurants.push(row);
        return json(row);
      }
      return json(state.restaurants);
    }
    if (/\/menu$/.test(path)) {
      if (method === "POST") {
        const row = {
          id: 23,
          restaurantId: 4,
          available: true,
          version: 0,
          ...request.postDataJSON(),
        };
        state.menu.push(row);
        return json(row);
      }
      return json(state.menu);
    }
    if (/\/hours\/\d$/.test(path)) {
      const day = Number(path.split("/").at(-1));
      state.restaurants[0].hours[day] = {
        dayOfWeek: day,
        ...request.postDataJSON(),
      };
      return json({ message: "Opening hours updated" });
    }
    if (/\/inventory$/.test(path)) {
      const id = Number(path.match(/menu\/(\d+)/)[1]);
      Object.assign(
        state.menu.find((row) => row.id === id),
        request.postDataJSON(),
      );
      state.menu.find((row) => row.id === id).version++;
      return json({ message: "Inventory updated" });
    }
    if (/\/orders\/\d+\/(prepare|ready)$/.test(path)) {
      const id = Number(path.match(/orders\/(\d+)/)[1]);
      const order = state.orders.find((row) => row.id === id);
      order.status = path.endsWith("/prepare") ? "PREPARING" : "READY";
      return json({ orderId: id, status: order.status });
    }
    if (path === "/order-api/orders") {
      if (method === "POST") {
        const body = request.postDataJSON();
        const row = {
          ...structuredClone(baseOrder),
          id: 52,
          status: "CREATED",
          ...body,
          items: body.items.map((line) => ({
            ...line,
            name: menu[0].name,
            unitPrice: 85,
          })),
          totalAmount: body.items.reduce(
            (sum, line) => sum + line.quantity * 85,
            0,
          ),
        };
        state.orders.push(row);
        return json(row);
      }
      return json(
        state.orders.filter(
          (row) =>
            (!url.searchParams.get("restaurantId") ||
              row.restaurantId ===
                Number(url.searchParams.get("restaurantId"))) &&
            (!url.searchParams.get("customerId") ||
              row.customerId === Number(url.searchParams.get("customerId"))),
        ),
      );
    }
    if (path === "/delivery-api/deliveries/drivers") {
      if (method === "POST") {
        const row = { id: 9, status: "AVAILABLE", ...request.postDataJSON() };
        state.drivers.push(row);
        return json(row);
      }
      return json(state.drivers);
    }
    if (path === "/delivery-api/deliveries/waiting") return json(state.waiting);
    if (path === "/delivery-api/deliveries") return json(state.deliveries);
    if (/\/deliveries\/\d+\//.test(path)) {
      const row = state.deliveries.find(
        (d) => d.id === Number(path.match(/deliveries\/(\d+)/)[1]),
      );
      row.status = path.endsWith("/pickup")
        ? "PICKED_UP"
        : path.endsWith("/complete")
          ? "DELIVERED"
          : "OUT_FOR_DELIVERY";
      return json({ deliveryId: row.id, status: row.status });
    }
    if (path === "/admin-api/admin/dashboard")
      return json({
        totalCustomers: 1,
        totalRestaurants: state.restaurants.length,
        totalOrders: state.orders.length,
        deliveredOrders: 0,
        activeDeliveries: state.deliveries.length,
        totalRevenue: 85,
      });
    if (path === "/admin-api/admin/orders/status")
      return json([{ status: "CONFIRMED", count: 1 }]);
    if (path === "/admin-api/admin/restaurants/report")
      return json([
        {
          restaurantId: 4,
          restaurantName: "Burger House",
          totalOrders: 1,
          revenue: 0,
        },
      ]);
    throw new Error(`Unmocked API request: ${method} ${path}`);
  });
  return state;
}

export async function signInCustomer(page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill("quinton@example.com");
  await page.getByRole("button", { name: "Let’s eat" }).click();
  await page.waitForURL("**/restaurants");
}
export async function signInAdmin(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.waitForURL("**/admin");
}
