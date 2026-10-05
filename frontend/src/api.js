class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with HTTP ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data;
}

const jsonBody = (body) => JSON.stringify(body);

export const api = {
  customer: {
    health: () => request('/customer-api/customers/health'),
    get: (customerId) => request(`/customer-api/customers/${customerId}`),
    create: (payload) =>
      request('/customer-api/customers', {
        method: 'POST',
        body: jsonBody(payload)
      }),
    addresses: (customerId) =>
      request(`/customer-api/customers/${customerId}/addresses`),
    addAddress: (customerId, payload) =>
      request(`/customer-api/customers/${customerId}/addresses`, {
        method: 'POST',
        body: jsonBody(payload)
      }),
    orders: (customerId) =>
      request(`/customer-api/customers/${customerId}/orders`)
  },

  restaurant: {
    health: () => request('/restaurant-api/restaurants/health'),
    menu: (restaurantId) =>
      request(`/restaurant-api/restaurants/${restaurantId}/menu`),
    hours: (restaurantId) =>
      request(`/restaurant-api/restaurants/${restaurantId}/hours`),
    setHours: (restaurantId, dayOfWeek, payload) =>
      request(`/restaurant-api/restaurants/${restaurantId}/hours/${dayOfWeek}`, {
        method: 'PUT',
        body: jsonBody(payload)
      }),
    updateInventory: (restaurantId, menuItemId, payload) =>
      request(
        `/restaurant-api/restaurants/${restaurantId}/menu/${menuItemId}/inventory`,
        {
          method: 'PUT',
          body: jsonBody(payload)
        }
      ),
    prepareOrder: (restaurantId, orderId) =>
      request(`/restaurant-api/restaurants/${restaurantId}/orders/${orderId}/prepare`, {
        method: 'PUT'
      }),
    readyOrder: (restaurantId, orderId) =>
      request(`/restaurant-api/restaurants/${restaurantId}/orders/${orderId}/ready`, {
        method: 'PUT'
      })
  },

  order: {
    health: () => request('/order-api/orders/health'),
    create: (payload) =>
      request('/order-api/orders', {
        method: 'POST',
        body: jsonBody(payload)
      }),
    cancel: (orderId) =>
      request(`/order-api/orders/${orderId}/cancel`, {
        method: 'PUT'
      })
  },

  delivery: {
    health: () => request('/delivery-api/deliveries/health'),
    pickup: (deliveryId) =>
      request(`/delivery-api/deliveries/${deliveryId}/pickup`, {
        method: 'PUT'
      }),
    outForDelivery: (deliveryId) =>
      request(`/delivery-api/deliveries/${deliveryId}/out-for-delivery`, {
        method: 'PUT'
      }),
    complete: (deliveryId) =>
      request(`/delivery-api/deliveries/${deliveryId}/complete`, {
        method: 'PUT'
      })
  },

  admin: {
    health: () => request('/admin-api/admin/health'),
    dashboard: () => request('/admin-api/admin/dashboard'),
    orderStatus: () => request('/admin-api/admin/orders/status'),
    restaurantReport: () => request('/admin-api/admin/restaurants/report')
  }
};

export { ApiError };
