import { request, post, put } from "./http";
const base = "/restaurant-api/restaurants";
export const restaurantApi = {
  list: () => request(base),
  create: (data) => post(base, data),
  menu: (id) => request(`${base}/${id}/menu`),
  addMenu: (id, data) => post(`${base}/${id}/menu`, data),
  hours: (id) => request(`${base}/${id}/hours`),
  setHours: (id, day, data) => put(`${base}/${id}/hours/${day}`, data),
  inventory: (id, itemId, data) =>
    put(`${base}/${id}/menu/${itemId}/inventory`, data),
  prepare: (id, orderId) => put(`${base}/${id}/orders/${orderId}/prepare`),
  ready: (id, orderId) => put(`${base}/${id}/orders/${orderId}/ready`),
};
