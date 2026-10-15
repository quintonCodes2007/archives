import { useCallback, useState } from "react";
import { orderApi } from "../api/orderApi";
import { usePolling } from "../hooks/usePolling";
import { DataState, Live, PageHeader } from "../components/UI";
import OrdersTable from "../components/OrdersTable";
import { ORDER_STEPS, STATUS_LABELS } from "../utils/format";
export default function AdminOrdersPage() {
  const query = usePolling(useCallback(() => orderApi.list(), []));
  const [status, setStatus] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="ACROSS ALL RESTAURANTS"
        title="Every order, in view."
        actions={<Live {...query} />}
      >
        Keep an eye on what’s cooking and what’s on its way.
      </PageHeader>
      <div className="section-toolbar">
        <h2>Order list</h2>
        <select
          aria-label="Filter by order status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[...ORDER_STEPS, "CANCELLED"].map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <DataState query={query}>
        <section className="panel">
          <OrdersTable
            orders={(query.data || []).filter(
              (order) => !status || order.status === status,
            )}
          />
        </section>
      </DataState>
    </>
  );
}
