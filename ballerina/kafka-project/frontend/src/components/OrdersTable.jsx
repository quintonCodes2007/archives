import { Badge, Empty } from "./UI";
import { dateTime, money } from "../utils/format";
export default function OrdersTable({ orders }) {
  if (!orders.length) return <Empty title="No orders to show yet." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Restaurant</th>
            <th>Placed</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <strong>#{order.id}</strong>
              </td>
              <td>{order.customerName}</td>
              <td>{order.restaurantName}</td>
              <td>{dateTime(order.createdAt)}</td>
              <td className="nowrap">{money(order.totalAmount)}</td>
              <td>
                <Badge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
