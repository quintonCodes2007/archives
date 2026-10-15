import { request, post, put } from "./http";
const base = "/delivery-api/deliveries";
export const deliveryApi = {
  list: () => request(base),
  waiting: () => request(`${base}/waiting`),
  drivers: () => request(`${base}/drivers`),
  addDriver: (data) => post(`${base}/drivers`, data),
  pickup: (id) => put(`${base}/${id}/pickup`),
  depart: (id) => put(`${base}/${id}/out-for-delivery`),
  complete: (id) => put(`${base}/${id}/complete`),
};
