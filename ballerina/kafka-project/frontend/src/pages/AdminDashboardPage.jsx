import { useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { orderApi } from "../api/orderApi";
import { usePolling } from "../hooks/usePolling";
import { money } from "../utils/format";
import { DataState, Live, PageHeader, Stat } from "../components/UI";
import { RestaurantReport, StatusChart } from "../components/ReportPanels";
import OrdersTable from "../components/OrdersTable";
import Icon from "../components/Icon";
export default function AdminDashboardPage() {
  const load = useCallback(async () => {
    const [stats, statuses, reports, orders] = await Promise.all([
      adminApi.dashboard(),
      adminApi.statuses(),
      adminApi.reports(),
      orderApi.list(),
    ]);
    return { stats, statuses, reports, orders };
  }, []);
  const query = usePolling(load, 8000);
  const stats = query.data?.stats;
  return (
    <>
      <PageHeader
        eyebrow="THE BIG PICTURE"
        title="A fresh look at your business."
        actions={<Live {...query} />}
      >
        Your restaurants, your people, your next great service.
      </PageHeader>
      <DataState query={query}>
        {stats && (
          <>
            <div className="stats-grid">
              <Stat
                label="Total orders"
                value={stats.totalOrders}
                icon="bag"
                accent
              />
              <Stat
                label="Customers"
                value={stats.totalCustomers}
                icon="users"
              />
              <Stat
                label="Active deliveries"
                value={stats.activeDeliveries}
                icon="truck"
              />
              <Stat
                label="Completed payments"
                value={money(stats.totalRevenue)}
                icon="chart"
              />
            </div>
            <div className="dashboard-grid">
              <StatusChart statuses={query.data.statuses} />
              <section className="panel service-overview">
                <div className="eyebrow">A WELL-RUN SERVICE STARTS HERE</div>
                <h2>
                  Every kitchen.
                  <br />
                  One clear view.
                </h2>
                <div className="service-summary">
                  <div>
                    <strong>{stats.totalRestaurants}</strong>
                    <span>Restaurants</span>
                  </div>
                  <div>
                    <strong>{stats.deliveredOrders}</strong>
                    <span>Delivered orders</span>
                  </div>
                </div>
                <Link className="button primary" to="/admin/restaurants">
                  Manage restaurants
                  <Icon name="arrow" size={17} />
                </Link>
                <Link className="text-button" to="/admin/drivers">
                  Manage your delivery team →
                </Link>
              </section>
            </div>
            <RestaurantReport reports={query.data.reports} />
            <section className="panel order-table-panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent orders</h2>
                  <p className="muted">
                    Latest activity across your restaurants
                  </p>
                </div>
                <Link className="text-button" to="/admin/orders">
                  View all orders →
                </Link>
              </div>
              <OrdersTable orders={query.data.orders.slice(0, 8)} />
            </section>
            <p className="data-note">
              Completed payments include all successful demo payments.
              Restaurant revenue counts delivered orders only; cancellation does
              not trigger a refund in the existing service.
            </p>
          </>
        )}
      </DataState>
    </>
  );
}
