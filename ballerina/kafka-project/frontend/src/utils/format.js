export const money = (value) => `N$${Number(value || 0).toFixed(2)}`;
export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const ORDER_STEPS = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
export const STATUS_LABELS = {
  CREATED: "Order received",
  CONFIRMED: "Payment confirmed",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  OUT_FOR_DELIVERY: "Delivery in progress",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  AVAILABLE: "Available",
  OFFLINE: "Offline",
  WAITING: "Waiting for a driver",
};
export const terminal = (status) => ["DELIVERED", "CANCELLED"].includes(status);
export function dateTime(value) {
  return value
    ? new Date(value.replace(" ", "T")).toLocaleString("en-NA", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
export function openingState(restaurant) {
  if (!restaurant.active)
    return {
      label: "Unavailable",
      open: false,
      detail: "Restaurant is inactive",
    };
  // Sunday=0, matching restaurant_hours. Use the customer's local clock.
  const now = new Date();
  const row = restaurant.hours?.find((hour) => hour.dayOfWeek === now.getDay());
  if (!row)
    return {
      label: "Hours not published",
      open: null,
      detail: "Contact the restaurant for opening hours",
    };
  if (row.closed)
    return { label: "Closed today", open: false, detail: "Closed today" };
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const open = time >= row.openTime && time < row.closeTime;
  return {
    label: open ? "Open now" : "Closed now",
    open,
    detail: `${row.openTime} – ${row.closeTime}`,
  };
}
