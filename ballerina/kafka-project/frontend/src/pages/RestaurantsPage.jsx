import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { restaurantApi } from "../api/restaurantApi";
import { usePolling } from "../hooks/usePolling";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { openingState } from "../utils/format";
import FoodArt from "../components/FoodArt";
import Icon from "../components/Icon";
import {
  Badge,
  DataState,
  Empty,
  Field,
  Live,
  Modal,
  PageHeader,
} from "../components/UI";

export function RestaurantForm({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await restaurantApi.create({
        name: fields.name.trim(),
        address: fields.address.trim(),
        email: fields.email.trim() || null,
        phone: fields.phone.trim() || null,
      });
      notify(
        "Restaurant added. You can now build its menu and publish opening hours.",
      );
      onSaved();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a restaurant" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <Field label="Restaurant name">
          <input
            name="name"
            maxLength={150}
            placeholder="e.g. Burger House"
            required
          />
        </Field>
        <Field label="Street address">
          <input
            name="address"
            maxLength={255}
            placeholder="Street and city"
            required
          />
        </Field>
        <Field label="Email (optional)">
          <input name="email" type="email" maxLength={255} />
        </Field>
        <Field label="Phone (optional)">
          <input name="phone" type="tel" maxLength={30} />
        </Field>
        {error && (
          <div role="alert" className="error-notice">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Adding…" : "Add restaurant"}
        </button>
      </form>
    </Modal>
  );
}

export default function RestaurantsPage({ admin = false, kitchen = false }) {
  const load = useCallback(() => restaurantApi.list(), []);
  const query = usePolling(load, 10000);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const { session } = useAuth();
  const restaurants = (query.data || []).filter(
    (r) =>
      (admin || kitchen || r.active) &&
      r.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="discovery-page">
      {(!admin && !kitchen) && <section className="discover-hero">
        <div className="hero-text"><span className="hero-count">N° 01 / CURATED LOCAL CRAVINGS</span><h1>GOOD FOOD.<br/><em>BAD HABITS.</em></h1><p>Skip the ordinary. Discover independent Namibian kitchens cooking up something worth staying in for.</p><a href="#restaurants" className="hero-cta">EXPLORE THE LINEUP <span>↗</span></a><div className="hero-ticker">HOT & FRESH <span>✳</span> MADE IN NAMIBIA <span>✳</span> YOUR NEXT OBSESSION</div></div>
        <div className="hero-visual"><FoodArt kind="burgerAlt"/><div className="hero-sticker">100%<br/>LOCAL<br/><small>GOODNESS</small></div><span className="hero-photo-label">THE NIGHTSHIFT EDIT / 2026</span></div>
      </section>}
      {(admin || kitchen) && <div className="management-hero"><div><span className="eyebrow">{kitchen ? "KITCHEN OPERATIONS / 01" : "RESTAURANT MANAGEMENT / 02"}</span><h1>{kitchen ? "Choose your station." : "Your culinary empire."}</h1><p>{kitchen ? "Step inside a kitchen and take control of the live preparation queue." : "Build menus, manage inventory and run the restaurants that keep the city fed."}</p></div><div className="management-graphic">{kitchen ? "HOT / 01" : "HQ / 02"}<span>✳</span></div></div>}
      <div className="directory-head" id="restaurants">
        <div><span className="eyebrow">{kitchen ? "ACTIVE KITCHENS" : admin ? "MANAGED RESTAURANTS" : "THE NEIGHBOURHOOD EDIT"}</span><h2>{kitchen ? "Pick a kitchen" : admin ? "Your locations" : "The local lineup"}<sup>{restaurants.length.toString().padStart(2,"0")}</sup></h2></div>
        <div className="directory-controls"><Live {...query}/><label className="search-field"><Icon name="search" size={18}/><input aria-label="Search restaurants" value={search} onChange={e=>setSearch(e.target.value)} placeholder="SEARCH KITCHENS"/></label>{admin && <button className="button primary" onClick={()=>setModal(true)}><Icon name="plus" size={17}/> NEW LOCATION</button>}</div>
      </div>
      <DataState query={query}>
        {!restaurants.length ? <Empty title={search ? "Nothing found" : "The lineup is empty"} icon="store">{search ? "Try another name." : admin ? "Add a restaurant to get started." : "Restaurants will appear once they're available."}</Empty> :
        <div className="night-restaurant-list">{restaurants.map((restaurant,index)=>{
          const state = openingState(restaurant);
          const path = kitchen ? `/kitchen/${restaurant.id}` : admin ? `/admin/restaurants/${restaurant.id}` : `/order/${restaurant.id}`;
          const kind = /pizza/i.test(restaurant.name) ? "pizza" : /chicken/i.test(restaurant.name) ? "chicken" : index%3===1 ? "burgerAlt" : index%3===2 ? "wrap" : "burger";
          return <Link to={path} className="night-restaurant" key={restaurant.id}>
            <div className="restaurant-image"><FoodArt kind={kind} name={restaurant.name}/><span>FEATURED / {String(index+1).padStart(2,"0")}</span></div>
            <div className="restaurant-body"><div className="restaurant-index">{String(index+1).padStart(2,"0")} / THE LINEUP</div><div className="restaurant-title-row"><h3>{restaurant.name}</h3><span className="restaurant-go">↗</span></div><p><Icon name="pin" size={15}/>{restaurant.address}</p><div className="restaurant-meta"><span><Icon name="clock" size={15}/>{state.detail}</span><span>{restaurant.menuCount} MENU ITEMS</span></div></div>
            <div className="restaurant-visit"><Badge status={state.open ? "AVAILABLE" : state.open===false ? "OFFLINE" : "CREATED"}>{state.label}</Badge><strong>{kitchen ? "OPEN STATION" : admin ? "EDIT KITCHEN" : "SEE THE MENU"} <span>↗</span></strong></div>
          </Link>;
        })}</div>}
      </DataState>
      <div className="directory-end">YOU'VE REACHED THE END OF THE GOOD STUFF <span>✳</span></div>
      {modal && <RestaurantForm onClose={()=>setModal(false)} onSaved={query.refresh}/>}
    </div>
  );
}
