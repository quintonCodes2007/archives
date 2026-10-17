import { request, post, put } from "./http";
const base = "/order-api/orders";
export const orderApi = {
  list: (filters = {}) => request(`${base}?${new URLSearchParams(filters)}`),
  create: (data) => post(base, data),
  cancel: (id) => put(`${base}/${id}/cancel`),
};
