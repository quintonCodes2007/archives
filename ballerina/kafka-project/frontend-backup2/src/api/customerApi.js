import { request, post } from "./http";
const base = "/customer-api/customers";
export const customerApi = {
  lookup: (email) =>
    request(`${base}/lookup?email=${encodeURIComponent(email.trim())}`),
  get: (id) => request(`${base}/${id}`),
  create: (data) => post(base, data),
  addresses: (id) => request(`${base}/${id}/addresses`),
  addAddress: (id, data) => post(`${base}/${id}/addresses`, data),
};
