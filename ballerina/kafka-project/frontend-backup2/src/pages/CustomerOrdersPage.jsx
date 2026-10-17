import { useCallback } from "react";
import { Link } from "react-router-dom";
import { orderApi } from "../api/orderApi";
import { useAuth } from "../context/AuthContext";
import { usePolling } from "../hooks/usePolling";
import { terminal } from "../utils/format";
import { DataState, Empty, Live, PageHeader } from "../components/UI";
import OrderCard from "../components/OrderCard";
export default function CustomerOrdersPage() {
  const { session } = useAuth();
  const load = useCallback(
    () => orderApi.list({ customerId: session.customer.id }),
    [session.customer.id],
  );
  const query = usePolling(load);
  const active = (query.data || []).filter((order) => !terminal(order.status));
  const past = (query.data || []).filter((order) => terminal(order.status));
  return (
    <>
      <PageHeader
        eyebrow="FROM THE FIRST BITE TO THE LAST MILE"
        title="My orders"
        actions={<Live {...query} />}
      >
        Follow your favourites, from the kitchen to your doorstep.
      </PageHeader>
      <DataState query={query}>
        <div className="section-toolbar">
          <h2>
            On the way <span className="count-pill">{active.length}</span>
          </h2>
          <Link className="text-button" to="/restaurants">
            Order something good →
          </Link>
        </div>
        {!active.length ? (
          <Empty title="You don’t have an active order.">
            Pick a restaurant and find your next favourite meal.
          </Empty>
        ) : (
          <div className="tracking-grid">
            {active.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                track
                onChanged={query.refresh}
              />
            ))}
          </div>
        )}
        <div className="section-toolbar">
          <h2>
            Past orders <span className="count-pill">{past.length}</span>
          </h2>
        </div>
        {!past.length ? (
          <Empty title="A fresh start">
            Your completed and cancelled orders will appear here.
          </Empty>
        ) : (
          <div className="history-grid">
            {past.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </DataState>
    </>
  );
}
