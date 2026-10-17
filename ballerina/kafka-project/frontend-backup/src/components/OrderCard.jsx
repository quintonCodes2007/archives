import { useState } from "react";
import { orderApi } from "../api/orderApi";
import { useToast } from "../context/ToastContext";
import { dateTime, money, ORDER_STEPS, STATUS_LABELS } from "../utils/format";
import { Badge, Modal } from "./UI";
import Icon from "./Icon";

export function OrderTimeline({ order }) {
  const current = ORDER_STEPS.indexOf(order.status);
  if (order.status === "CANCELLED")
    return (
      <div className="cancelled-message">
        This order was cancelled and its reserved stock has been returned.
      </div>
    );
  return (
    <ol className="order-timeline">
      {ORDER_STEPS.map((step, index) => (
        <li
          key={step}
          className={index <= current ? "complete" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span className="step-dot">
            {index < current ? <Icon name="check" size={12} /> : index + 1}
          </span>
          <span>{STATUS_LABELS[step]}</span>
        </li>
      ))}
    </ol>
  );
}
export default function OrderCard({ order, track = false, onChanged }) {
  const notify = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true);
    try {
      await orderApi.cancel(order.id);
      notify("Order cancelled.");
      setConfirm(false);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
      onChanged?.();
    }
  }
  return (
    <article className={`panel order-card ${track ? "tracked-order" : ""}`}>
      <div className="row-between">
        <div>
          <span className="eyebrow">ORDER #{order.id}</span>
          <h3>{order.restaurantName}</h3>
        </div>
        <Badge status={order.status} />
      </div>
      <div className="order-meta">
        <span>{dateTime(order.createdAt)}</span>
        <strong>{money(order.totalAmount)}</strong>
      </div>
      {track && <OrderTimeline order={order} />}
      <div className="order-lines">
        {order.items.map((item) => (
          <div key={item.menuItemId}>
            <span>
              <b>{item.quantity}×</b> {item.name}
            </span>
            <span>{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="order-address">
        <Icon name="pin" size={16} />
        {order.deliveryAddress}
      </div>
      {order.deliveryStatus && (
        <div className="driver-note">
          <Icon name="truck" size={18} />
          <span>
            <strong>{order.driverName}</strong> ·{" "}
            {STATUS_LABELS[order.deliveryStatus]}
            {order.deliveryStatus === "ASSIGNED" ? " · waiting for pickup" : ""}
          </span>
        </div>
      )}
      {track && order.status === "READY" && !order.deliveryId && (
        <p className="waiting-note">
          Your food is ready. Waiting for an available driver.
        </p>
      )}
      {track && order.status === "CREATED" && (
        <p className="muted">
          Your order was received. Waiting for automatic payment confirmation.
        </p>
      )}
      {track && ["CONFIRMED", "PREPARING"].includes(order.status) && (
        <button
          className="text-button danger-text"
          onClick={() => setConfirm(true)}
        >
          Cancel order
        </button>
      )}
      {confirm && (
        <Modal
          title={`Cancel order #${order.id}?`}
          onClose={() => setConfirm(false)}
        >
          <p>
            The restaurant will stop this order and its stock will be restored.
            The existing demo payment service does not process refunds.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep order
            </button>
            <button className="button danger" disabled={busy} onClick={cancel}>
              {busy ? "Cancelling…" : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}
