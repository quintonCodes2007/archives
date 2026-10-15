import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { orderApi } from "../api/orderApi";
import { restaurantApi } from "../api/restaurantApi";
import { usePolling } from "../hooks/usePolling";
import { useToast } from "../context/ToastContext";
import { dateTime, money } from "../utils/format";
import {
  Badge,
  DataState,
  Empty,
  Live,
  PageHeader,
  Stat,
} from "../components/UI";
import Icon from "../components/Icon";

export default function KitchenPage() {
  const { restaurantId } = useParams();
  const load = useCallback(async () => {
    const [restaurants, orders] = await Promise.all([
      restaurantApi.list(),
      orderApi.list({ restaurantId }),
    ]);
    const restaurant = restaurants.find((r) => r.id === Number(restaurantId));
    if (!restaurant)
      throw new Error("Restaurant not found. Choose another kitchen.");
    return { restaurant, orders };
  }, [restaurantId]);
  const query = usePolling(load);
  const [busy, setBusy] = useState({});
  const notify = useToast();
  const orders = query.data?.orders || [];
  const counts = (status) =>
    orders.filter((order) => order.status === status).length;
  async function advance(order) {
    setBusy((current) => ({ ...current, [order.id]: true }));
    try {
      await (order.status === "CONFIRMED"
        ? restaurantApi.prepare(restaurantId, order.id)
        : restaurantApi.ready(restaurantId, order.id));
      notify(
        order.status === "CONFIRMED"
          ? `Order #${order.id} is now preparing.`
          : `Order #${order.id} is ready for delivery.`,
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy((current) => ({ ...current, [order.id]: false }));
      query.refresh();
    }
  }
  return (
    <>
      <Link className="back-link" to="/kitchen">
        ← Change kitchen
      </Link>
      <PageHeader
        eyebrow="KITCHEN WORKSPACE"
        title={query.data?.restaurant.name || "Preparation queue"}
        actions={<Live {...query} />}
      >
        A clear counter. A happy kitchen. Paid orders appear automatically.
      </PageHeader>
      <DataState query={query}>
        <div className="stats-grid three">
          <Stat
            label="New orders"
            value={counts("CONFIRMED")}
            icon="bag"
            accent
          />
          <Stat label="Preparing" value={counts("PREPARING")} icon="chef" />
          <Stat label="Ready for pickup" value={counts("READY")} icon="truck" />
        </div>
        <div className="kitchen-board">
          {[
            ["CONFIRMED", "New orders", "No confirmed orders waiting."],
            ["PREPARING", "Preparing", "Your preparation counter is clear."],
            ["READY", "Ready for pickup", "No orders are waiting for pickup."],
          ].map(([status, label, empty]) => (
            <section
              className={`queue-column queue-${status.toLowerCase()}`}
              key={status}
            >
              <div className="queue-heading">
                <h2>
                  <span />
                  {label}
                </h2>
                <span className="count-pill">{counts(status)}</span>
              </div>
              {!counts(status) ? (
                <Empty title={empty} icon="chef" />
              ) : (
                orders
                  .filter((order) => order.status === status)
                  .sort((a, b) => a.id - b.id)
                  .map((order) => (
                    <article key={order.id} className="kitchen-ticket">
                      <div className="row-between">
                        <strong>Order #{order.id}</strong>
                        <Badge status={status} />
                      </div>
                      <h3>{order.customerName}</h3>
                      <p className="muted">
                        {dateTime(order.createdAt)} ·{" "}
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}{" "}
                        items
                      </p>
                      <div className="ticket-items">
                        {order.items.map((item) => (
                          <div key={item.menuItemId}>
                            <span className="item-quantity">
                              {item.quantity}×
                            </span>
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="row-between ticket-total">
                        <span>Order total</span>
                        <strong>{money(order.totalAmount)}</strong>
                      </div>
                      {status === "READY" ? (
                        <div className="waiting-note">
                          <Icon name="truck" size={17} />
                          {order.driverName
                            ? `${order.driverName} · assigned`
                            : "Waiting for an available driver"}
                        </div>
                      ) : (
                        <button
                          className={`button full-width ${status === "CONFIRMED" ? "primary" : "dark"}`}
                          disabled={busy[order.id]}
                          onClick={() => advance(order)}
                        >
                          {busy[order.id]
                            ? "Updating…"
                            : status === "CONFIRMED"
                              ? "Start preparing"
                              : "Mark ready"}
                          <Icon
                            name={status === "CONFIRMED" ? "chef" : "check"}
                            size={17}
                          />
                        </button>
                      )}
                    </article>
                  ))
              )}
            </section>
          ))}
        </div>
      </DataState>
    </>
  );
}
