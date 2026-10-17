import { request } from "./http";
export const adminApi = {
  dashboard: () => request("/admin-api/admin/dashboard"),
  statuses: () => request("/admin-api/admin/orders/status"),
  reports: () => request("/admin-api/admin/restaurants/report"),
};
