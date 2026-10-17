import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { restaurantApi } from "../api/restaurantApi";
import { customerApi } from "../api/customerApi";
import { orderApi } from "../api/orderApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePolling } from "../hooks/usePolling";
import { money, openingState } from "../utils/format";
import {
  Badge,
  DataState,
  Empty,
  Field,
  Modal,
  PageHeader,
} from "../components/UI";
import FoodArt from "../components/FoodArt";
import Icon from "../components/Icon";

function AddressForm({ customerId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const address = await customerApi.addAddress(customerId, {
        ...data,
        isDefault: data.isDefault === "on",
      });
      onSaved(address);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Save a delivery address" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <Field label="Label">
          <input
            name="label"
            placeholder="Home or work"
            maxLength={50}
            required
          />
        </Field>
        <Field label="Street address">
          <input name="addressLine" maxLength={255} required />
        </Field>
        <Field label="City">
          <input name="city" defaultValue="Windhoek" maxLength={100} required />
        </Field>
        <label className="checkbox-field">
          <input type="checkbox" name="isDefault" defaultChecked />
          Use as my default address
        </label>
        {error && (
          <div role="alert" className="error-notice">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save address"}
        </button>
      </form>
    </Modal>
  );
}

export default function OrderingPage() {
  const { restaurantId } = useParams();
  const { session } = useAuth();
  const customerId = session.customer.id;
  const load = useCallback(async () => {
    const [restaurants, menu, addresses] = await Promise.all([
      restaurantApi.list(),
      restaurantApi.menu(restaurantId),
      customerApi.addresses(customerId),
    ]);
    const restaurant = restaurants.find(
      (row) => row.id === Number(restaurantId),
    );
    if (!restaurant) throw new Error("This restaurant could not be found.");
    return { restaurant, menu, addresses };
  }, [restaurantId, customerId]);
  const query = usePolling(load, 8000);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [address, setAddress] = useState("");
  const [addressModal, setAddressModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);
  const notify = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    setCart({});
    setAddress("");
    setPlaced(false);
  }, [restaurantId]);
  useEffect(() => {
    const addresses = query.data?.addresses;
    if (addresses?.length) {
      const preferred = addresses.find((row) => row.isDefault) || addresses[0];
      setAddress(
        (current) => current || `${preferred.addressLine}, ${preferred.city}`,
      );
    }
  }, [query.data?.addresses]);
  const menu = query.data?.menu || [];
  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({
          ...menu.find((item) => item.id === Number(id)),
          quantity,
        }))
        .filter((item) => item.id),
    [cart, menu],
  );
  const total = lines.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const state = query.data ? openingState(query.data.restaurant) : null;
  const invalidCart = lines.some(
    (item) => !item.available || item.quantity > item.stockQuantity,
  );
  const visible = menu.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (section !== "available" || (item.available && item.stockQuantity > 0)),
  );
  function quantity(item, delta) {
    setCart((current) => {
      const next = { ...current };
      const amount = (next[item.id] || 0) + delta;
      if (amount <= 0) delete next[item.id];
      else next[item.id] = Math.min(amount, item.stockQuantity);
      return next;
    });
  }
  async function checkout(event) {
    event.preventDefault();
    if (busy || placed || !lines.length) return;
    setBusy(true);
    try {
      const created = await orderApi.create({
        customerId,
        restaurantId: Number(restaurantId),
        deliveryAddress: address.trim(),
        items: lines.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
      });
      setPlaced(true);
      setCart({});
      notify(
        `Order #${created.id} placed. Your kitchen will receive it after payment confirmation.`,
      );
      navigate("/customer/orders");
    } catch (error) {
      notify(
        `${error.message} Check My orders before retrying if the order may have been created.`,
        "error",
      );
      query.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="night-order-page">
      <Link className="back-link" to="/restaurants">← BACK TO ALL KITCHENS</Link>
      <div className="order-showcase"><div className="order-showcase-photo"><FoodArt kind="burgerAlt"/></div><div className="order-showcase-content"><span className="eyebrow">THE KITCHEN / ORDER ONLINE</span><h1>{query.data?.restaurant.name || "Tonight's menu."}</h1><p><Icon name="pin" size={16}/>{query.data?.restaurant.address || "The freshest local food"}</p><div className="order-showcase-badges">{state && <Badge status={state.open ? "AVAILABLE" : "OFFLINE"}>{state.label}</Badge>}<span>FRESHLY PREPARED</span><span>MADE WITH ATTITUDE</span></div></div><div className="order-showcase-num">MENU<br/><strong>N° 01</strong></div></div>
      <DataState query={query}>
        <div className="order-workspace">
          <div className="menu-area"><div className="night-menu-head"><div><span className="eyebrow">CHOOSE YOUR CRAVING</span><h2>What's cooking?<sup>{menu.length.toString().padStart(2,"0")}</sup></h2></div><label className="search-field"><Icon name="search" size={17}/><input aria-label="Search menu" placeholder="FIND SOMETHING GOOD" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
          <div className="night-filter-bar"><button className={section==="all" ? "selected" : ""} onClick={()=>setSection("all")}>01 / ALL DISHES</button><button className={section==="available" ? "selected" : ""} onClick={()=>setSection("available")}>02 / AVAILABLE NOW</button><span>FRESH FROM THE KITCHEN ↗</span></div>
          {!visible.length ? <Empty title={search ? "No matching dishes" : "Nothing's on the menu yet"}>{search ? "Try a different search." : "This kitchen is preparing its lineup."}</Empty> :
          <div className="night-menu-list">{visible.map((item,index)=>{
            const unavailable = !item.available || item.stockQuantity <= 0;
            return <article className={`night-menu-item ${unavailable ? "unavailable" : ""}`} key={item.id}>
              <div className="menu-item-photo"><FoodArt name={item.name}/><span className="menu-item-index">{String(index+1).padStart(2,"0")}</span></div>
              <div className="menu-item-main"><span className="menu-item-category">NIGHTSHIFT SELECTS / {unavailable ? "SOLD OUT" : `${item.stockQuantity} LEFT`}</span><h3>{item.name}</h3><p>{item.description || "Cooked fresh for your next craving."}</p><div className="menu-item-foot"><strong>{money(item.price)}</strong>{cart[item.id] ? <div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={()=>quantity(item,-1)}>−</button><span>{cart[item.id]}</span><button aria-label={`Add one ${item.name}`} disabled={unavailable || cart[item.id]>=item.stockQuantity} onClick={()=>quantity(item,1)}>+</button></div> : <button className="night-add" aria-label={`Add ${item.name} to order`} disabled={unavailable || busy} onClick={()=>quantity(item,1)}>{unavailable ? "UNAVAILABLE" : "ADD TO BAG"} <span>↗</span></button>}</div></div>
            </article>;
          })}</div>}
          </div>
          <aside className="night-cart"><div className="night-cart-head"><div><span className="eyebrow">YOUR FOOD, YOUR RULES</span><h2>THE BAG <span>({lines.reduce((n,item)=>n+item.quantity,0)})</span></h2></div><span className="cart-asterisk">✳</span></div>
            {!lines.length ? <div className="night-cart-empty"><span>✳</span><h3>Nothing in here.<br/>Yet.</h3><p>Build your perfect order from the menu on the left.</p></div> : <div className="night-cart-lines">{lines.map(item=><div className="night-cart-line" key={item.id}><FoodArt name={item.name}/><div><strong>{item.name}</strong><span>{money(item.price)} · {item.quantity}×</span><div className="quantity-control"><button aria-label={`Decrease ${item.name}`} onClick={()=>quantity(item,-1)}>−</button><span>{item.quantity}</span><button aria-label={`Increase ${item.name}`} disabled={item.quantity>=item.stockQuantity || !item.available} onClick={()=>quantity(item,1)}>+</button></div><button className="text-button" aria-label={`Remove ${item.name} from order`} onClick={()=>setCart(current=>{const next={...current};delete next[item.id];return next;})}>REMOVE</button></div></div>)}</div>}
            {lines.length>0 && <button className="clear-bag" onClick={()=>setCart({})}>CLEAR ENTIRE BAG ×</button>}
            <form onSubmit={checkout} className="night-checkout"><div className="checkout-heading"><h3>DELIVERY DETAILS</h3><button type="button" onClick={()=>setAddressModal(true)}>+ SAVE ADDRESS</button></div>
              {query.data?.addresses.length>0 && <Field label="Saved addresses"><select aria-label="Saved delivery address" value="" onChange={e=>{if(e.target.value)setAddress(e.target.value);}}><option value="">CHOOSE A SAVED ADDRESS</option>{query.data.addresses.map(row=><option key={row.id} value={`${row.addressLine}, ${row.city}`}>{row.label} · {row.addressLine}, {row.city}</option>)}</select></Field>}
              <Field label="Your delivery address"><textarea required maxLength={255} placeholder="Street, building and city" rows={2} value={address} onChange={e=>setAddress(e.target.value)}/></Field>
              <div className="night-totals"><div><span>SUBTOTAL</span><span>{money(total)}</span></div><div><strong>TOTAL DUE</strong><strong>{money(total)}</strong></div></div>
              {invalidCart && <p className="error-notice">Some selected quantities aren't available. Please adjust your order.</p>}
              {state?.open===false && <p className="waiting-note">{state.detail}. Ordering follows published hours.</p>}
              <button className="button primary night-place-order" disabled={busy || placed || !lines.length || invalidCart || !address.trim() || !query.data?.restaurant.active || state?.open===false}>{busy ? "PLACING ORDER…" : "CONFIRM MY ORDER"}<span>↗</span></button><p className="checkout-note">Automatic demo payment. No card details required.</p>
            </form>
          </aside>
        </div>
      </DataState>
      {addressModal && <AddressForm customerId={customerId} onClose={()=>setAddressModal(false)} onSaved={saved=>{setAddress(`${saved.addressLine}, ${saved.city}`);query.refresh();notify("Address saved.");}}/>}
    </div>
  );
}
