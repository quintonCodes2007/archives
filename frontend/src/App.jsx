import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { asArray, labelize, money, normalizeBoolean, pick, statusClass } from './utils.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER_STEPS = ['CREATED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const TABS = [
  ['desk', 'Order'],
  ['kitchen', 'Kitchen'],
  ['courier', 'Courier'],
  ['admin', 'Admin']
];

function Notice({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <button className={`notice notice--${notice.kind || 'info'}`} onClick={onDismiss} type="button">
      <strong>{notice.kind === 'error' ? 'ERROR' : 'NOTE'}</strong>
      <span>{notice.message}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}

function StatusStamp({ status }) {
  if (!status) return <span className="stamp">UNKNOWN</span>;
  return <span className={`stamp stamp--${statusClass(status)}`}>{String(status).replaceAll('_', ' ')}</span>;
}

function StatusTrack({ status }) {
  if (!status) return null;
  if (status === 'CANCELLED') {
    return (
      <div className="status-track status-track--cancelled">
        <span>CREATED</span><i />
        <span>CONFIRMED</span><i />
        <span className="current">CANCELLED</span>
      </div>
    );
  }

  const current = ORDER_STEPS.indexOf(status);
  return (
    <div className="status-track">
      {ORDER_STEPS.map((step, index) => (
        <div className="status-track__unit" key={step}>
          <span className={index === current ? 'current' : index < current ? 'done' : ''}>{step.replaceAll('_', ' ')}</span>
          {index < ORDER_STEPS.length - 1 && <i className={index < current ? 'done' : ''} />}
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ index, eyebrow, title, aside }) {
  return (
    <header className="section-heading">
      <div className="section-heading__number">{String(index).padStart(2, '0')}</div>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {aside && <div className="section-heading__aside">{aside}</div>}
    </header>
  );
}

function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function JsonFallback({ data }) {
  if (data == null) return null;
  return (
    <details className="raw-data">
      <summary>Raw service response</summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function DataTable({ data, empty = 'No rows returned.' }) {
  const rows = asArray(data, ['rows', 'data', 'report', 'restaurants', 'orders', 'statuses']);
  if (!rows.length) return <Empty>{empty}</Empty>;
  if (typeof rows[0] !== 'object' || rows[0] === null) {
    return <pre className="paper-pre">{JSON.stringify(rows, null, 2)}</pre>;
  }

  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{labelize(column)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => {
                const value = row[column];
                return <td key={column}>{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—')}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricGrid({ data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return <Empty>No dashboard data returned.</Empty>;
  return (
    <div className="metric-grid">
      {Object.entries(data).map(([key, value]) => (
        <div className="metric" key={key}>
          <span>{labelize(key)}</span>
          <strong>{typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}</strong>
        </div>
      ))}
    </div>
  );
}

function ServiceStrip({ health, onRefresh }) {
  const entries = [
    ['CUSTOMER', health.customer],
    ['RESTAURANT', health.restaurant],
    ['ORDER', health.order],
    ['DELIVERY', health.delivery],
    ['ADMIN', health.admin]
  ];

  return (
    <aside className="service-strip">
      <div className="service-strip__head">
        <span>HTTP SERVICES</span>
        <button className="text-button" type="button" onClick={onRefresh}>CHECK</button>
      </div>
      <div className="service-strip__items">
        {entries.map(([name, state]) => (
          <div className="service-state" key={name}>
            <span className={`service-dot service-dot--${state || 'checking'}`} />
            <b>{name}</b>
            <small>{state || 'CHECKING'}</small>
          </div>
        ))}
      </div>
      <div className="service-strip__event-note">PAYMENT + NOTIFICATION / KAFKA EVENT LINE</div>
    </aside>
  );
}

function OrderDesk({ notify }) {
  const [customerId, setCustomerId] = useState(1);
  const [restaurantId, setRestaurantId] = useState(1);
  const [customer, setCustomer] = useState(null);
  const [addressesRaw, setAddressesRaw] = useState(null);
  const [ordersRaw, setOrdersRaw] = useState(null);
  const [menuRaw, setMenuRaw] = useState(null);
  const [hoursRaw, setHoursRaw] = useState(null);
  const [cart, setCart] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState('Windhoek Central');
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ username: '', fullName: '', email: '', phone: '' });
  const [newAddress, setNewAddress] = useState({ label: 'Home', addressLine: '', city: 'Windhoek', isDefault: true });

  const menu = asArray(menuRaw, ['menu', 'items', 'menuItems']);
  const addresses = asArray(addressesRaw, ['addresses']);
  const orders = asArray(ordersRaw, ['orders', 'history']);
  const hours = asArray(hoursRaw, ['hours']);

  const refreshCustomer = useCallback(async () => {
    const [customerResult, addressesResult, ordersResult] = await Promise.allSettled([
      api.customer.get(customerId),
      api.customer.addresses(customerId),
      api.customer.orders(customerId)
    ]);
    if (customerResult.status === 'fulfilled') setCustomer(customerResult.value);
    if (addressesResult.status === 'fulfilled') setAddressesRaw(addressesResult.value);
    if (ordersResult.status === 'fulfilled') setOrdersRaw(ordersResult.value);
  }, [customerId]);

  const refreshRestaurant = useCallback(async () => {
    const [menuResult, hoursResult] = await Promise.allSettled([
      api.restaurant.menu(restaurantId),
      api.restaurant.hours(restaurantId)
    ]);
    if (menuResult.status === 'fulfilled') setMenuRaw(menuResult.value);
    if (hoursResult.status === 'fulfilled') setHoursRaw(hoursResult.value);
  }, [restaurantId]);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  useEffect(() => {
    refreshRestaurant();
  }, [refreshRestaurant]);

  const addToCart = (item) => {
    const id = Number(pick(item, 'id', 'menuItemId'));
    if (!id) return;
    setCart((current) => {
      const existing = current.find((line) => line.id === id);
      if (existing) return current.map((line) => line.id === id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { id, name: pick(item, 'name', 'itemName') || `Item ${id}`, price: Number(pick(item, 'price') || 0), quantity: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((current) => current
      .map((line) => line.id === id ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line)
      .filter((line) => line.quantity > 0));
  };

  const cartTotal = useMemo(() => cart.reduce((total, line) => total + line.price * line.quantity, 0), [cart]);

  const placeOrder = async () => {
    if (!cart.length) return notify('Add at least one menu item first.', 'error');
    if (!deliveryAddress.trim()) return notify('Enter a delivery address.', 'error');
    setBusy(true);
    try {
      const result = await api.order.create({
        customerId: Number(customerId),
        restaurantId: Number(restaurantId),
        deliveryAddress: deliveryAddress.trim(),
        items: cart.map((line) => ({ menuItemId: line.id, quantity: line.quantity }))
      });
      setLastOrder(result);
      setCart([]);
      notify(`Order ${result?.id ?? ''} created. Payment confirmation will arrive through Kafka.`);
      await refreshRestaurant();
      setTimeout(refreshCustomer, 900);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      const result = await api.order.cancel(orderId);
      notify(result?.message || `Order ${orderId} cancelled.`);
      await refreshCustomer();
      await refreshRestaurant();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const createCustomer = async (event) => {
    event.preventDefault();
    try {
      const result = await api.customer.create(newCustomer);
      notify(`Customer created${result?.id ? ` with ID ${result.id}` : ''}.`);
      if (result?.id) setCustomerId(result.id);
      setNewCustomer({ username: '', fullName: '', email: '', phone: '' });
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const addAddress = async (event) => {
    event.preventDefault();
    try {
      await api.customer.addAddress(customerId, newAddress);
      notify('Address saved.');
      setNewAddress((value) => ({ ...value, addressLine: '' }));
      await refreshCustomer();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <main>
      <section className="desk-grid">
        <div className="desk-grid__identity ruled-panel">
          <SectionHeading index={1} eyebrow="Identity" title="Who is ordering?" />
          <div className="two-field">
            <Field label="Customer ID"><input type="number" min="1" value={customerId} onChange={(e) => setCustomerId(e.target.value)} /></Field>
            <Field label="Restaurant ID"><input type="number" min="1" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} /></Field>
          </div>
          <div className="button-row">
            <button type="button" onClick={refreshCustomer}>Reload customer</button>
            <button type="button" className="button--quiet" onClick={refreshRestaurant}>Reload kitchen</button>
          </div>

          {customer && (
            <div className="identity-card">
              <span className="eyebrow">CUSTOMER RECORD</span>
              <h3>{pick(customer, 'fullName', 'full_name', 'username') || `Customer ${customerId}`}</h3>
              <p>{pick(customer, 'email') || 'No email returned'}</p>
              <p>{pick(customer, 'phone') || 'No phone returned'}</p>
            </div>
          )}

          <div className="hours-mini">
            <span className="eyebrow">KITCHEN WEEK</span>
            {hours.length ? hours.map((day, index) => (
              <div className="hours-mini__row" key={pick(day, 'dayOfWeek') ?? index}>
                <b>{DAYS[Number(pick(day, 'dayOfWeek'))] || `Day ${pick(day, 'dayOfWeek')}`}</b>
                <span>{normalizeBoolean(pick(day, 'closed')) ? 'CLOSED' : `${pick(day, 'openTime') || '—'}–${pick(day, 'closeTime') || '—'}`}</span>
              </div>
            )) : <small>No hours configured.</small>}
          </div>
        </div>

        <div className="desk-grid__menu ruled-panel">
          <SectionHeading index={2} eyebrow="Menu" title="What is moving today?" aside={`${menu.length} lines`} />
          {menu.length ? (
            <div className="menu-ledger">
              {menu.map((item, index) => {
                const id = Number(pick(item, 'id', 'menuItemId'));
                const stock = Number(pick(item, 'stockQuantity', 'stock_quantity', 'stock') ?? 0);
                const available = pick(item, 'available') === undefined ? true : normalizeBoolean(pick(item, 'available'));
                return (
                  <article className="menu-line" key={id || index}>
                    <div className="menu-line__index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="menu-line__body">
                      <h3>{pick(item, 'name', 'itemName') || `Menu item ${id}`}</h3>
                      <p>{pick(item, 'description') || 'No description on file.'}</p>
                      <div className="menu-line__meta">
                        <b>{money(pick(item, 'price'))}</b>
                        <span>STOCK {stock}</span>
                        <span>{available ? 'AVAILABLE' : 'OFF MENU'}</span>
                      </div>
                    </div>
                    <button type="button" disabled={!available || stock <= 0} onClick={() => addToCart(item)}>ADD</button>
                  </article>
                );
              })}
            </div>
          ) : <Empty>No menu rows returned for restaurant {restaurantId}.</Empty>}
          <JsonFallback data={menuRaw} />
        </div>

        <aside className="desk-grid__docket order-docket">
          <div className="docket-tear">CUT HERE / ORDER DOCKET / {new Date().toLocaleDateString()}</div>
          <h2>ORDER</h2>
          <Field label="Deliver to"><textarea rows="3" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></Field>
          <div className="docket-lines">
            {cart.length ? cart.map((line) => (
              <div className="docket-line" key={line.id}>
                <div><b>{line.name}</b><small>{money(line.price)} each</small></div>
                <div className="qty-control">
                  <button type="button" onClick={() => changeQty(line.id, -1)}>−</button>
                  <span>{line.quantity}</span>
                  <button type="button" onClick={() => changeQty(line.id, 1)}>+</button>
                </div>
                <strong>{money(line.price * line.quantity)}</strong>
              </div>
            )) : <Empty>Your docket is empty.</Empty>}
          </div>
          <div className="docket-total"><span>ESTIMATE</span><strong>{money(cartTotal)}</strong></div>
          <p className="microcopy">The backend recalculates the real total from MySQL prices before creating the order.</p>
          <button className="button--primary button--full" type="button" disabled={busy || !cart.length} onClick={placeOrder}>{busy ? 'SENDING…' : 'PLACE ORDER'}</button>
          {lastOrder && (
            <div className="last-ticket">
              <span>LAST TICKET</span>
              <b>#{lastOrder.id}</b>
              <StatusStamp status={lastOrder.status} />
            </div>
          )}
        </aside>
      </section>

      <section className="wide-section">
        <SectionHeading index={3} eyebrow="History" title="Orders on this account" aside={<button className="text-button" type="button" onClick={refreshCustomer}>REFRESH</button>} />
        {orders.length ? (
          <div className="order-list">
            {orders.map((order, index) => {
              const orderId = pick(order, 'id', 'orderId');
              const status = pick(order, 'status');
              const cancellable = ['CONFIRMED', 'PREPARING'].includes(status);
              return (
                <article className="order-row" key={orderId ?? index}>
                  <div className="order-row__id"><small>ORDER</small><strong>#{orderId ?? '?'}</strong></div>
                  <div className="order-row__main">
                    <div className="order-row__head">
                      <StatusStamp status={status} />
                      <b>{money(pick(order, 'totalAmount', 'total_amount'))}</b>
                      <span>{pick(order, 'deliveryAddress', 'delivery_address') || 'Address not returned'}</span>
                    </div>
                    <StatusTrack status={status} />
                  </div>
                  <div className="order-row__action">
                    {cancellable ? <button type="button" onClick={() => cancelOrder(orderId)}>CANCEL</button> : <span>—</span>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <Empty>No historical orders returned.</Empty>}
        <JsonFallback data={ordersRaw} />
      </section>

      <section className="account-tools">
        <div className="ruled-panel">
          <SectionHeading index={4} eyebrow="Account tool" title="Register customer" />
          <form className="form-grid" onSubmit={createCustomer}>
            <Field label="Username"><input required value={newCustomer.username} onChange={(e) => setNewCustomer({ ...newCustomer, username: e.target.value })} /></Field>
            <Field label="Full name"><input required value={newCustomer.fullName} onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })} /></Field>
            <Field label="Email"><input required type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></Field>
            <Field label="Phone"><input required value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></Field>
            <button className="button--primary" type="submit">CREATE ACCOUNT</button>
          </form>
        </div>

        <div className="ruled-panel">
          <SectionHeading index={5} eyebrow="Address book" title={`Customer ${customerId}`} />
          {addresses.length ? (
            <div className="address-list">
              {addresses.map((address, index) => (
                <div className="address-row" key={pick(address, 'id') ?? index}>
                  <b>{pick(address, 'label') || 'Address'}</b>
                  <span>{pick(address, 'addressLine', 'address_line') || '—'}, {pick(address, 'city') || '—'}</span>
                  {normalizeBoolean(pick(address, 'isDefault', 'is_default')) && <em>DEFAULT</em>}
                </div>
              ))}
            </div>
          ) : <Empty>No addresses returned.</Empty>}
          <form className="address-form" onSubmit={addAddress}>
            <input aria-label="Address label" placeholder="Label" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
            <input aria-label="Address line" required placeholder="Address line" value={newAddress.addressLine} onChange={(e) => setNewAddress({ ...newAddress, addressLine: e.target.value })} />
            <input aria-label="City" required placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
            <label className="check"><input type="checkbox" checked={newAddress.isDefault} onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })} /> Default</label>
            <button type="submit">SAVE ADDRESS</button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Kitchen({ notify }) {
  const [restaurantId, setRestaurantId] = useState(1);
  const [orderId, setOrderId] = useState('');
  const [menuRaw, setMenuRaw] = useState(null);
  const [hoursRaw, setHoursRaw] = useState(null);
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [hoursDraft, setHoursDraft] = useState({});
  const [activity, setActivity] = useState([]);

  const menu = asArray(menuRaw, ['menu', 'items', 'menuItems']);
  const hours = asArray(hoursRaw, ['hours']);

  const refresh = useCallback(async () => {
    try {
      const [menuData, hoursData] = await Promise.all([
        api.restaurant.menu(restaurantId),
        api.restaurant.hours(restaurantId)
      ]);
      setMenuRaw(menuData);
      setHoursRaw(hoursData);
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [restaurantId, notify]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const next = {};
    menu.forEach((item) => {
      const id = pick(item, 'id', 'menuItemId');
      next[id] = {
        stockQuantity: Number(pick(item, 'stockQuantity', 'stock_quantity', 'stock') ?? 0),
        available: pick(item, 'available') === undefined ? true : normalizeBoolean(pick(item, 'available'))
      };
    });
    setInventoryDraft(next);
  }, [menuRaw]);

  useEffect(() => {
    const next = {};
    hours.forEach((row) => {
      const day = Number(pick(row, 'dayOfWeek'));
      next[day] = {
        openTime: pick(row, 'openTime') || '08:00',
        closeTime: pick(row, 'closeTime') || '21:00',
        closed: normalizeBoolean(pick(row, 'closed'))
      };
    });
    setHoursDraft(next);
  }, [hoursRaw]);

  const log = (message) => setActivity((items) => [{ time: new Date().toLocaleTimeString(), message }, ...items].slice(0, 8));

  const transition = async (kind) => {
    if (!orderId) return notify('Enter an order ID.', 'error');
    try {
      const result = kind === 'prepare'
        ? await api.restaurant.prepareOrder(restaurantId, orderId)
        : await api.restaurant.readyOrder(restaurantId, orderId);
      const message = `Order ${orderId}: ${pick(result, 'oldStatus') || ''}${pick(result, 'oldStatus') ? ' → ' : ''}${pick(result, 'status', 'newStatus') || kind.toUpperCase()}`;
      log(message);
      notify(message);
    } catch (error) {
      notify(error.message, 'error');
      log(`FAILED // ${error.message}`);
    }
  };

  const saveInventory = async (itemId) => {
    try {
      const draft = inventoryDraft[itemId];
      const result = await api.restaurant.updateInventory(restaurantId, itemId, draft);
      notify(pick(result, 'message') || `Inventory updated for item ${itemId}.`);
      log(`Inventory ${itemId}: stock ${draft.stockQuantity}, ${draft.available ? 'available' : 'off menu'}`);
      await refresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const saveHours = async (day) => {
    const draft = hoursDraft[day] || { openTime: '08:00', closeTime: '21:00', closed: false };
    try {
      await api.restaurant.setHours(restaurantId, day, draft);
      notify(`${DAYS[day]} hours saved.`);
      log(`${DAYS[day]}: ${draft.closed ? 'closed' : `${draft.openTime}–${draft.closeTime}`}`);
      await refresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <main className="operator-layout">
      <section className="operator-main">
        <div className="ruled-panel kitchen-order-box">
          <SectionHeading index={1} eyebrow="Pass" title="Move an order through the kitchen" />
          <div className="kitchen-command">
            <Field label="Restaurant"><input type="number" min="1" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} /></Field>
            <Field label="Order ID"><input type="number" min="1" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="e.g. 14" /></Field>
            <button type="button" onClick={() => transition('prepare')}>MARK PREPARING</button>
            <button className="button--primary" type="button" onClick={() => transition('ready')}>MARK READY</button>
          </div>
          <p className="microcopy">READY publishes <b>orders.status.updated</b>; Delivery Service handles driver assignment through Kafka.</p>
        </div>

        <div className="ruled-panel">
          <SectionHeading index={2} eyebrow="Stock ledger" title="Menu & inventory" aside={<button className="text-button" onClick={refresh} type="button">REFRESH</button>} />
          {menu.length ? menu.map((item, index) => {
            const id = pick(item, 'id', 'menuItemId');
            const draft = inventoryDraft[id] || { stockQuantity: 0, available: true };
            return (
              <div className="inventory-row" key={id || index}>
                <div className="inventory-row__item"><small>#{id}</small><b>{pick(item, 'name') || `Item ${id}`}</b><span>{money(pick(item, 'price'))}</span></div>
                <label><span>STOCK</span><input type="number" min="0" value={draft.stockQuantity} onChange={(e) => setInventoryDraft({ ...inventoryDraft, [id]: { ...draft, stockQuantity: Number(e.target.value) } })} /></label>
                <label className="check"><input type="checkbox" checked={draft.available} onChange={(e) => setInventoryDraft({ ...inventoryDraft, [id]: { ...draft, available: e.target.checked } })} /> AVAILABLE</label>
                <button type="button" onClick={() => saveInventory(id)}>SAVE LINE</button>
              </div>
            );
          }) : <Empty>No menu rows returned.</Empty>}
        </div>

        <div className="ruled-panel">
          <SectionHeading index={3} eyebrow="Kitchen clock" title="Opening hours" />
          <div className="hours-editor">
            {DAYS.map((name, day) => {
              const draft = hoursDraft[day] || { openTime: '08:00', closeTime: '21:00', closed: false };
              return (
                <div className="hours-editor__row" key={name}>
                  <b>{name}</b>
                  <input aria-label={`${name} open time`} type="time" value={draft.openTime} disabled={draft.closed} onChange={(e) => setHoursDraft({ ...hoursDraft, [day]: { ...draft, openTime: e.target.value } })} />
                  <span>TO</span>
                  <input aria-label={`${name} close time`} type="time" value={draft.closeTime} disabled={draft.closed} onChange={(e) => setHoursDraft({ ...hoursDraft, [day]: { ...draft, closeTime: e.target.value } })} />
                  <label className="check"><input type="checkbox" checked={draft.closed} onChange={(e) => setHoursDraft({ ...hoursDraft, [day]: { ...draft, closed: e.target.checked } })} /> CLOSED</label>
                  <button type="button" onClick={() => saveHours(day)}>SAVE</button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="activity-ledger">
        <div className="docket-tear">KITCHEN ACTIVITY / LOCAL</div>
        <h2>PASS LOG</h2>
        {activity.length ? activity.map((item, index) => (
          <div className="activity-line" key={`${item.time}-${index}`}><time>{item.time}</time><span>{item.message}</span></div>
        )) : <Empty>No actions in this browser session.</Empty>}
        <div className="rule-note">Kafka events continue outside this browser. This panel records only actions sent from the UI.</div>
      </aside>
    </main>
  );
}

function Courier({ notify }) {
  const [deliveryId, setDeliveryId] = useState('');
  const [last, setLast] = useState(null);
  const [activity, setActivity] = useState([]);

  const run = async (action) => {
    if (!deliveryId) return notify('Enter a delivery ID.', 'error');
    try {
      const result = await api.delivery[action](deliveryId);
      setLast(result);
      const message = `Delivery ${deliveryId}: ${pick(result, 'status') || labelize(action)}`;
      setActivity((items) => [{ time: new Date().toLocaleTimeString(), message }, ...items].slice(0, 10));
      notify(message);
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <main className="courier-sheet">
      <div className="courier-sheet__title">
        <div className="eyebrow">DRIVER CONTROL / PORT 8085</div>
        <h1>Delivery run sheet</h1>
        <p>The delivery ID comes from the Delivery Service after a READY order receives a driver.</p>
      </div>

      <section className="delivery-sequence">
        <div className="delivery-id-block">
          <span>DELIVERY ID</span>
          <input type="number" min="1" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)} placeholder="4" />
        </div>
        <button type="button" onClick={() => run('pickup')}><small>01</small><b>PICK UP</b><span>ASSIGNED → PICKED_UP</span></button>
        <div className="route-rule" />
        <button type="button" onClick={() => run('outForDelivery')}><small>02</small><b>LEAVE RESTAURANT</b><span>PICKED_UP → OUT_FOR_DELIVERY</span></button>
        <div className="route-rule" />
        <button className="button--primary" type="button" onClick={() => run('complete')}><small>03</small><b>COMPLETE DROP</b><span>OUT_FOR_DELIVERY → DELIVERED</span></button>
      </section>

      <section className="courier-bottom">
        <div className="ruled-panel">
          <SectionHeading index={4} eyebrow="Latest response" title="Delivery state" />
          {last ? <><StatusStamp status={pick(last, 'status')} /><JsonFallback data={last} /></> : <Empty>No delivery action sent yet.</Empty>}
        </div>
        <div className="ruled-panel">
          <SectionHeading index={5} eyebrow="Driver note" title="What happens behind the screen" />
          <p className="body-copy">Completing a delivery updates the delivery record, returns the assigned driver to <b>AVAILABLE</b>, publishes <b>delivery.completed</b>, and lets Order Service move the order to <b>DELIVERED</b>.</p>
        </div>
        <div className="ruled-panel courier-log">
          <SectionHeading index={6} eyebrow="Session log" title="Actions" />
          {activity.length ? activity.map((item, index) => <div className="activity-line" key={`${item.time}-${index}`}><time>{item.time}</time><span>{item.message}</span></div>) : <Empty>No actions yet.</Empty>}
        </div>
      </section>
    </main>
  );
}

function Admin({ notify }) {
  const [dashboard, setDashboard] = useState(null);
  const [statusReport, setStatusReport] = useState(null);
  const [restaurantReport, setRestaurantReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.admin.dashboard(),
      api.admin.orderStatus(),
      api.admin.restaurantReport()
    ]);
    if (results[0].status === 'fulfilled') setDashboard(results[0].value);
    if (results[1].status === 'fulfilled') setStatusReport(results[1].value);
    if (results[2].status === 'fulfilled') setRestaurantReport(results[2].value);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) notify(`${failed.length} admin report request(s) failed.`, 'error');
    setLoading(false);
  }, [notify]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <main className="admin-sheet">
      <header className="admin-masthead">
        <div><div className="eyebrow">ADMIN SERVICE / PORT 8087</div><h1>Operations ledger</h1></div>
        <button type="button" onClick={refresh}>{loading ? 'LOADING…' : 'REFRESH ALL'}</button>
      </header>

      <section className="ruled-panel admin-section">
        <SectionHeading index={1} eyebrow="Dashboard" title="Platform totals" />
        <MetricGrid data={dashboard} />
        <JsonFallback data={dashboard} />
      </section>

      <section className="admin-columns">
        <div className="ruled-panel admin-section">
          <SectionHeading index={2} eyebrow="Orders" title="Status report" />
          <DataTable data={statusReport} empty="No order-status rows returned." />
          <JsonFallback data={statusReport} />
        </div>
        <div className="ruled-panel admin-section">
          <SectionHeading index={3} eyebrow="Restaurants" title="Performance report" />
          <DataTable data={restaurantReport} empty="No restaurant-report rows returned." />
          <JsonFallback data={restaurantReport} />
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [tab, setTab] = useState('desk');
  const [notice, setNotice] = useState(null);
  const [health, setHealth] = useState({});

  const notify = useCallback((message, kind = 'info') => {
    setNotice({ message, kind });
    window.clearTimeout(window.__foodNoticeTimer);
    window.__foodNoticeTimer = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const checkHealth = useCallback(async () => {
    const services = {
      customer: api.customer.health,
      restaurant: api.restaurant.health,
      order: api.order.health,
      delivery: api.delivery.health,
      admin: api.admin.health
    };
    setHealth(Object.fromEntries(Object.keys(services).map((key) => [key, 'checking'])));
    const entries = await Promise.all(Object.entries(services).map(async ([key, fn]) => {
      try {
        const result = await fn();
        return [key, String(result?.status || 'up').toLowerCase() === 'up' ? 'up' : 'down'];
      } catch {
        return [key, 'down'];
      }
    }));
    setHealth(Object.fromEntries(entries));
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  return (
    <div className="app-shell">
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      <header className="masthead">
        <div className="masthead__brand">
          <span className="kicker">FOOD DELIVERY PLATFORM / LIVE</span>
          <h1>The Pass<em>.</em></h1>
          <p>Browse the menu, place orders, move kitchen tickets and finish deliveries from one glossy little control center.</p>
        </div>
        <div className="masthead__side">
          <div className="issue-block"><small>PLATFORM</small><strong>CONNECTED</strong><span>Ballerina · Kafka · MySQL</span></div>
          <div className="issue-block"><small>EVENTS</small><strong>KAFKA LIVE</strong><span>Payments + notifications stay async</span></div>
        </div>
      </header>

      <nav className="section-nav" aria-label="Application sections">
        {TABS.map(([id, label], index) => (
          <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <span>{String(index + 1).padStart(2, '0')}</span>{label}
          </button>
        ))}
      </nav>

      <ServiceStrip health={health} onRefresh={checkHealth} />

      {tab === 'desk' && <OrderDesk notify={notify} />}
      {tab === 'kitchen' && <Kitchen notify={notify} />}
      {tab === 'courier' && <Courier notify={notify} />}
      {tab === 'admin' && <Admin notify={notify} />}

      <footer className="site-footer">
        <span>THE PASS / FOOD DELIVERY</span>
        <span>PAYMENT + NOTIFICATION SERVICES REMAIN EVENT-DRIVEN THROUGH KAFKA</span>
        <span>LIVE SERVICE DATA</span>
      </footer>
    </div>
  );
}
