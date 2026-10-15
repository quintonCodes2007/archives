import { useCallback, useState } from "react";
import { deliveryApi } from "../api/deliveryApi";
import { usePolling } from "../hooks/usePolling";
import { useToast } from "../context/ToastContext";
import { money, terminal } from "../utils/format";
import {
  Badge,
  DataState,
  Empty,
  Live,
  PageHeader,
  Stat,
} from "../components/UI";
import Icon from "../components/Icon";
import DeliveryMap from "../components/DeliveryMap";

export default function DeliveryPage() {
  const load = useCallback(async () => {
    const [deliveries, waiting, drivers] = await Promise.all([
      deliveryApi.list(),
      deliveryApi.waiting(),
      deliveryApi.drivers(),
    ]);
    return { deliveries, waiting, drivers };
  }, []);
  const query = usePolling(load);
  const [tab, setTab] = useState("active");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState({});
  const notify = useToast();
  const deliveries = query.data?.deliveries || [];
  const active = deliveries.filter((row) => !terminal(row.status));
  const completed = deliveries.filter((row) => terminal(row.status));
  const waiting = query.data?.waiting || [];
  const selectedDelivery =
    deliveries.find((row) => row.id === selected) || active[0] || completed[0];
  const actions = {
    ASSIGNED: ["Pick up", deliveryApi.pickup],
    PICKED_UP: ["Start delivery", deliveryApi.depart],
    OUT_FOR_DELIVERY: ["Complete delivery", deliveryApi.complete],
  };
  async function advance(row) {
    setBusy((current) => ({ ...current, [row.id]: true }));
    try {
      await actions[row.status][1](row.id);
      notify(`Order #${row.orderId}: delivery updated.`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy((current) => ({ ...current, [row.id]: false }));
      query.refresh();
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="DELIVERY WORKSPACE"
        title="Good food. On the move."
        actions={<Live {...query} />}
      >
        Your delivery board, from pickup to doorstep. Drivers are assigned
        automatically.
      </PageHeader>
      <DataState query={query}>
        <div className="stats-grid">
          <Stat
            label="Waiting for a driver"
            value={waiting.length}
            icon="clock"
          />
          <Stat
            label="Active deliveries"
            value={active.length}
            icon="truck"
            accent
          />
          <Stat
            label="Available drivers"
            value={
              (query.data?.drivers || []).filter(
                (d) => d.status === "AVAILABLE",
              ).length
            }
            icon="users"
          />
          <Stat
            label="Completed deliveries"
            value={completed.filter((d) => d.status === "DELIVERED").length}
            icon="check"
          />
        </div>
        <DeliveryMap delivery={selectedDelivery} />
        <div className="section-toolbar">
          <h2>Delivery board</h2>
          <div className="pill-tabs">
            {[
              ["active", "Active", active.length],
              ["waiting", "Waiting", waiting.length],
              ["completed", "History", completed.length],
            ].map(([value, label, count]) => (
              <button
                key={value}
                className={tab === value ? "selected" : ""}
                onClick={() => setTab(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
        </div>
        {tab === "waiting" ? (
          !waiting.length ? (
            <Empty title="No deliveries are waiting for a driver." icon="truck">
              New ready orders appear here if all drivers are busy.
            </Empty>
          ) : (
            <div className="delivery-grid">
              {waiting.map((row) => (
                <article className="panel delivery-card" key={row.orderId}>
                  <div className="row-between">
                    <strong>Order #{row.orderId}</strong>
                    <Badge status="WAITING" />
                  </div>
                  <h3>{row.restaurantName}</h3>
                  <p className="icon-text">
                    <Icon name="pin" size={16} />
                    {row.deliveryAddress}
                  </p>
                  <p className="muted">
                    {row.customerName} · {row.itemCount} items ·{" "}
                    {money(row.totalAmount)}
                  </p>
                  <div className="waiting-note">
                    The backend will assign the next available driver.
                  </div>
                </article>
              ))}
            </div>
          )
        ) : (tab === "active" ? active : completed).length === 0 ? (
          <Empty
            title={
              tab === "active"
                ? "No active deliveries right now."
                : "No completed deliveries yet."
            }
            icon="truck"
          >
            Your deliveries will appear here automatically.
          </Empty>
        ) : (
          <div className="delivery-grid">
            {(tab === "active" ? active : completed).map((row) => (
              <article
                className={`panel delivery-card ${selectedDelivery?.id === row.id ? "selected-delivery" : ""}`}
                key={row.id}
              >
                <div className="row-between">
                  <strong>Order #{row.orderId}</strong>
                  <Badge status={row.status} />
                </div>
                <h3>{row.restaurantName}</h3>
                <p className="icon-text">
                  <Icon name="pin" size={16} />
                  {row.deliveryAddress}
                </p>
                <p className="muted">
                  {row.customerName} · {row.itemCount} items ·{" "}
                  {money(row.totalAmount)}
                </p>
                <div className="driver-assignment">
                  <span className="avatar">{row.driverName.slice(0, 1)}</span>
                  <div>
                    <strong>{row.driverName}</strong>
                    <small>Assigned driver</small>
                  </div>
                </div>
                <div className="delivery-actions">
                  <button
                    className="button secondary"
                    onClick={() => setSelected(row.id)}
                  >
                    View route
                  </button>
                  {actions[row.status] && (
                    <button
                      className="button primary"
                      disabled={busy[row.id]}
                      onClick={() => advance(row)}
                    >
                      {busy[row.id] ? "Updating…" : actions[row.status][0]}
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="section-toolbar">
          <h2>Driver availability</h2>
          <span className="muted">All restaurants · one shared team</span>
        </div>
        {!query.data?.drivers.length ? (
          <Empty title="No drivers added yet" icon="users">
            An admin can add drivers to start deliveries.
          </Empty>
        ) : (
          <div className="driver-roster">
            {query.data.drivers.map((driver) => (
              <div className="panel driver-roster-card" key={driver.id}>
                <span className="avatar">{driver.fullName.slice(0, 1)}</span>
                <strong>{driver.fullName}</strong>
                <Badge status={driver.status} />
              </div>
            ))}
          </div>
        )}
      </DataState>
    </>
  );
}
