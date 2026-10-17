import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { restaurantApi } from "../api/restaurantApi";
import { orderApi } from "../api/orderApi";
import { adminApi } from "../api/adminApi";
import { usePolling } from "../hooks/usePolling";
import { DAYS, money, terminal } from "../utils/format";
import {
  Badge,
  DataState,
  Empty,
  Live,
  PageHeader,
  Stat,
} from "../components/UI";
import OrdersTable from "../components/OrdersTable";
import Icon from "../components/Icon";

import MenuItemForm from "../components/restaurant/MenuItemForm";
import InventoryRow from "../components/restaurant/InventoryRow";
import HoursRow from "../components/restaurant/HoursRow";

export default function RestaurantAdminPage() {
  const { restaurantId } = useParams();
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(false);
  const load = useCallback(async () => {
    const [restaurants, menu, orders, reports] = await Promise.all([
      restaurantApi.list(),
      restaurantApi.menu(restaurantId),
      orderApi.list({ restaurantId }),
      adminApi.reports(),
    ]);
    const restaurant = restaurants.find(
      (row) => row.id === Number(restaurantId),
    );
    if (!restaurant) throw new Error("This restaurant could not be found.");
    return {
      restaurant,
      menu,
      orders,
      report: reports.find((row) => row.restaurantId === Number(restaurantId)),
    };
  }, [restaurantId]);
  const query = usePolling(load, 8000);
  const data = query.data;
  return (
    <>
      <Link className="back-link" to="/admin/restaurants">
        ← All restaurants
      </Link>
      <PageHeader
        eyebrow="RESTAURANT WORKSPACE"
        title={data?.restaurant.name || "Restaurant management"}
        actions={
          <>
            <Live {...query} />
            <Link className="button secondary" to={`/kitchen/${restaurantId}`}>
              <Icon name="chef" size={18} />
              Open kitchen
            </Link>
          </>
        }
      >
        {data?.restaurant.address || "Menus, inventory and daily service."}
      </PageHeader>
      <div className="page-tabs">
        {[
          ["overview", "Overview"],
          ["menu", "Menu & inventory"],
          ["hours", "Opening hours"],
          ["orders", "Orders"],
          ["reports", "Reports"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "selected" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <DataState query={query}>
        {data && (
          <>
            {tab === "overview" && (
              <>
                <div className="stats-grid">
                  <Stat
                    label="Menu items"
                    value={data.menu.length}
                    icon="bag"
                  />
                  <Stat
                    label="Active orders"
                    value={
                      data.orders.filter((order) => !terminal(order.status))
                        .length
                    }
                    icon="chef"
                    accent
                  />
                  <Stat
                    label="Delivered orders"
                    value={
                      data.orders.filter(
                        (order) => order.status === "DELIVERED",
                      ).length
                    }
                    icon="check"
                  />
                  <Stat
                    label="Low stock items"
                    value={
                      data.menu.filter((item) => item.stockQuantity <= 5).length
                    }
                    icon="store"
                  />
                </div>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Active orders</h2>
                      <p className="muted">
                        Preparation is managed in the kitchen workspace.
                      </p>
                    </div>
                  </div>
                  <OrdersTable
                    orders={data.orders.filter(
                      (order) => !terminal(order.status),
                    )}
                  />
                </section>
                <section className="panel stock-warnings">
                  <h2>Stock to keep an eye on</h2>
                  {!data.menu.some((item) => item.stockQuantity <= 5) ? (
                    <p className="muted">
                      No low-stock warnings. Your kitchen is well stocked.
                    </p>
                  ) : (
                    data.menu
                      .filter((item) => item.stockQuantity <= 5)
                      .map((item) => (
                        <div className="row-between" key={item.id}>
                          <strong>{item.name}</strong>
                          <Badge status="WAITING">
                            {item.stockQuantity} remaining
                          </Badge>
                        </div>
                      ))
                  )}
                </section>
              </>
            )}
            {tab === "menu" && (
              <>
                <div className="section-toolbar">
                  <div>
                    <h2>On the menu</h2>
                    <span className="muted">
                      Keep your menu stocked and ready for service.
                    </span>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => setModal(true)}
                  >
                    <Icon name="plus" size={18} />
                    Add menu item
                  </button>
                </div>
                {!data.menu.length ? (
                  <Empty title="No menu items yet." icon="store">
                    Add a burger, pizza, drink or your kitchen’s signature dish.
                  </Empty>
                ) : (
                  <section className="panel inventory-list">
                    {data.menu.map((item) => (
                      <InventoryRow
                        key={`${item.id}-${item.version}`}
                        restaurantId={restaurantId}
                        item={item}
                        onSaved={query.refresh}
                      />
                    ))}
                  </section>
                )}
                <p className="data-note">
                  Set prices when adding an item. Here you can update current
                  stock and choose which items are available to order.
                </p>
              </>
            )}
            {tab === "hours" && (
              <section className="panel hours-panel">
                <h2>Weekly opening hours</h2>
                <p className="muted">
                  Publish each day’s hours, or mark it closed. Same-day hours
                  only.
                </p>
                {DAYS.map((_, day) => (
                  <HoursRow
                    key={`${restaurantId}-${day}`}
                    restaurantId={restaurantId}
                    day={day}
                    row={data.restaurant.hours.find(
                      (row) => row.dayOfWeek === day,
                    )}
                    onSaved={query.refresh}
                  />
                ))}
              </section>
            )}
            {tab === "orders" && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Order history</h2>
                </div>
                <OrdersTable orders={data.orders} />
              </section>
            )}
            {tab === "reports" && (
              <div className="stats-grid three">
                <Stat
                  label="Total orders"
                  value={data.report ? data.report.totalOrders : "—"}
                  icon="bag"
                />
                <Stat
                  label="Revenue from delivered orders"
                  value={data.report ? money(data.report.revenue) : "—"}
                  icon="chart"
                  accent
                />
                <Stat
                  label="Menu items"
                  value={data.menu.length}
                  icon="store"
                />
              </div>
            )}
          </>
        )}
      </DataState>
      {modal && (
        <MenuItemForm
          restaurantId={restaurantId}
          onClose={() => setModal(false)}
          onSaved={query.refresh}
        />
      )}
    </>
  );
}
