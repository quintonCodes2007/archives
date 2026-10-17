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
    <div className="dispatch-page">
      <div className="dispatch-hero"><div><span className="eyebrow">FIELD OPERATIONS / NAMIBIA</span><h1>Every order.<br/><em>In motion.</em></h1><p>From the restaurant pass to the customer's door. Manage pickups, departures and deliveries in one command centre.</p></div><div className="dispatch-clock"><span>OPERATIONS ACTIVE</span><strong>24<span>/</span>7</strong><Live {...query}/></div></div>
      <DataState query={query}>
        <div className="dispatch-strip stats-grid">
          <Stat label="AWAITING ASSIGNMENT" value={waiting.length} icon="clock"/>
          <Stat label="ON THE ROAD" value={active.length} icon="truck" accent/>
          <Stat label="DRIVERS AVAILABLE" value={(query.data?.drivers||[]).filter(d=>d.status==="AVAILABLE").length} icon="users"/>
          <Stat label="SUCCESSFULLY DELIVERED" value={completed.filter(d=>d.status==="DELIVERED").length} icon="check"/>
        </div>
        <div className="dispatch-map-board"><DeliveryMap delivery={selectedDelivery}/><div className="dispatch-side"><div className="dispatch-side-head"><span className="eyebrow">LIVE QUEUE / {String(active.length).padStart(2,'0')}</span><h2>On the radar.</h2><p>Select a job to inspect its approximate destination.</p></div>
          <div className="dispatch-side-scroll">{!active.length ? <Empty title="The roads are clear" icon="truck">Active assignments appear here when orders are dispatched.</Empty> : active.map(row=><button className={`radar-job ${selectedDelivery?.id===row.id ? "selected" : ""}`} key={row.id} onClick={()=>setSelected(row.id)}><span className="radar-job-top">JOB #{row.orderId}<Badge status={row.status}/></span><strong>{row.restaurantName}</strong><small>{row.deliveryAddress}</small><span className="radar-job-bottom">{row.driverName} <span>EXPLORE ↗</span></span></button>)}</div>
        </div></div>
        <div className="dispatch-board-title"><div><span className="eyebrow">DELIVERY CONTROL / LIVE STATUS</span><h2>The dispatch board.</h2></div><div className="pill-tabs">{[["active","ACTIVE",active.length],["waiting","WAITING",waiting.length],["completed","HISTORY",completed.length]].map(([value,label,count])=><button key={value} className={tab===value ? "selected" : ""} onClick={()=>setTab(value)}>{label} <span>{count}</span></button>)}</div></div>
        {tab === "waiting" ? (!waiting.length ? <Empty title="No orders waiting" icon="truck">Ready orders waiting for a driver will show here automatically.</Empty> : <div className="dispatch-cards">{waiting.map(row=><article key={row.orderId} className="dispatch-ticket"><div className="ticket-top"><strong>#{row.orderId}</strong><Badge status="WAITING"/></div><h3>{row.restaurantName}</h3><p><Icon name="pin" size={15}/>{row.deliveryAddress}</p><p>{row.customerName} · {row.itemCount} items · {money(row.totalAmount)}</p><div className="waiting-note">Automatic driver assignment pending</div></article>)}</div>) :
        (tab === "active" ? active : completed).length===0 ? <Empty title={tab==="active" ? "No active deliveries" : "No completed deliveries"} icon="truck">New delivery activity will appear here.</Empty> :
        <div className="dispatch-cards">{(tab==="active"?active:completed).map(row=><article className={`dispatch-ticket ${selectedDelivery?.id===row.id ? "selected" : ""}`} key={row.id}><div className="ticket-top"><strong>ORDER #{row.orderId}</strong><Badge status={row.status}/></div><h3>{row.restaurantName}</h3><p><Icon name="pin" size={15}/>{row.deliveryAddress}</p><p>{row.customerName} · {row.itemCount} items · {money(row.totalAmount)}</p><div className="ticket-driver"><span>{row.driverName.slice(0,1)}</span><div><strong>{row.driverName}</strong><small>ASSIGNED DRIVER</small></div></div><div className="ticket-actions"><button className="button secondary" onClick={()=>{setSelected(row.id);document.querySelector('.geo-panel')?.scrollIntoView({behavior:'smooth',block:'center'});}}>MAP VIEW ↗</button>{actions[row.status] && <button className="button primary" disabled={busy[row.id]} onClick={()=>advance(row)}>{busy[row.id] ? "UPDATING" : actions[row.status][0].toUpperCase()} ↗</button>}</div></article>)}</div>}
        <div className="dispatch-board-title"><div><span className="eyebrow">YOUR PEOPLE</span><h2>Driver roster.</h2></div><span className="muted">SHARED ACROSS ALL RESTAURANTS</span></div>
        {!query.data?.drivers.length ? <Empty title="No drivers registered" icon="users">An administrator can add drivers from the Driver management page.</Empty> : <div className="driver-roster">{query.data.drivers.map(driver=><div key={driver.id} className="driver-roster-card"><span className="avatar">{driver.fullName.slice(0,1)}</span><strong>{driver.fullName}</strong><Badge status={driver.status}/></div>)}</div>}
      </DataState>
    </div>
  );
}
