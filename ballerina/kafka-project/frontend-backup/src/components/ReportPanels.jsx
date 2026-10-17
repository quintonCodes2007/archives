import { Link } from "react-router-dom";
import { Empty } from "./UI";
import { money, STATUS_LABELS } from "../utils/format";
export function StatusChart({ statuses }) {
  const max = Math.max(1, ...statuses.map((row) => row.count));
  return (
    <section className="panel chart-panel">
      <h2>Orders at a glance</h2>
      <p className="muted">All orders, grouped by current status</p>
      {!statuses.length ? (
        <Empty title="The first order is still to come" />
      ) : (
        <div className="status-chart">
          {statuses.map((row) => (
            <div className="status-chart-row" key={row.status}>
              <span>{STATUS_LABELS[row.status]}</span>
              <div className="chart-track">
                <div
                  style={{ width: `${(row.count / max) * 100}%` }}
                  className={`chart-bar bar-${row.status.toLowerCase()}`}
                />
              </div>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function RestaurantReport({ reports }) {
  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div>
          <h2>Restaurant performance</h2>
          <p className="muted">Revenue from delivered orders</p>
        </div>
      </div>
      {!reports.length ? (
        <Empty title="No restaurant reports yet" icon="chart" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Orders</th>
                <th>Delivered revenue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((row) => (
                <tr key={row.restaurantId}>
                  <td>
                    <strong>{row.restaurantName}</strong>
                  </td>
                  <td>{row.totalOrders}</td>
                  <td>{money(row.revenue)}</td>
                  <td>
                    <Link
                      className="text-button"
                      to={`/admin/restaurants/${row.restaurantId}`}
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
