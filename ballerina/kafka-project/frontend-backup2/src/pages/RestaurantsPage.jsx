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
    <>
      <PageHeader
        eyebrow={
          kitchen
            ? "KITCHEN WORKSPACE"
            : admin
              ? "YOUR RESTAURANTS"
              : `HELLO, ${session?.customer?.fullName?.split(" ")[0]?.toUpperCase() || "FOODIE"}`
        }
        title={
          kitchen
            ? "Choose your kitchen"
            : admin
              ? "Manage restaurants"
              : "Find your next obsession."
        }
        actions={
          <>
            <Live {...query} />
            {admin && (
              <button className="button primary" onClick={() => setModal(true)}>
                <Icon name="plus" size={18} />
                Add restaurant
              </button>
            )}
          </>
        }
      >
        {kitchen
          ? "Open a restaurant’s live preparation queue. No sign-in needed."
          : admin
            ? "Menus, opening hours and orders, all in one place."
            : "Fresh plates, independent kitchens, zero boring bites."}
      </PageHeader>
      {!admin && !kitchen && (
        <div className="discovery-banner">
          <div>
            <span className="eyebrow">WELCOME TO THE GOOD SIDE</span>
            <h2>
              Local flavour.
              <br />
              Main character energy.
            </h2>
            <p>Find your new go-to. We handle the rest.</p>
          </div>
          <FoodArt kind="burger" />
          <span className="banner-tag">
            GOOD FOOD
            <br />
            ONLY ↗
          </span>
        </div>
      )}
      <div className="section-toolbar">
        <div>
          <h2>{kitchen ? "Restaurant kitchens" : "The local lineup"}</h2>
          <span className="muted">
            {restaurants.length}{" "}
            {restaurants.length === 1 ? "restaurant" : "restaurants"}
          </span>
        </div>
        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search restaurants"
            placeholder="Find a restaurant…"
          />
        </label>
      </div>
      <DataState query={query}>
        {!restaurants.length ? (
          <Empty
            title={search ? "No restaurants found" : "No restaurants yet"}
            icon="store"
          >
            {search
              ? "Try another restaurant name."
              : admin
                ? "Add your first restaurant to get started."
                : "Restaurants will appear here when they are added."}
          </Empty>
        ) : (
          <div className="restaurant-grid">
            {restaurants.map((restaurant, index) => {
              const state = openingState(restaurant);
              const path = kitchen
                ? `/kitchen/${restaurant.id}`
                : admin
                  ? `/admin/restaurants/${restaurant.id}`
                  : `/order/${restaurant.id}`;
              return (
                <article className="restaurant-card" key={restaurant.id}>
                  <Link
                    to={path}
                    className="restaurant-cover"
                    aria-label={`View ${restaurant.name}`}
                  >
                    <FoodArt
                      name={restaurant.name}
                      kind={
                        /pizza/i.test(restaurant.name)
                          ? "pizza"
                          : /chicken/i.test(restaurant.name)
                            ? "chicken"
                            : index % 3 === 2
                              ? "wrap"
                              : "burger"
                      }
                    />
                    <span className="cover-badge">
                      {restaurant.menuCount} menu items
                    </span>
                  </Link>
                  <div className="restaurant-card-body">
                    <div className="row-between">
                      <h3>{restaurant.name}</h3>
                      <Badge
                        status={
                          state.open
                            ? "AVAILABLE"
                            : state.open === false
                              ? "OFFLINE"
                              : "CREATED"
                        }
                      >
                        {state.label}
                      </Badge>
                    </div>
                    <p className="icon-text">
                      <Icon name="pin" size={15} />
                      {restaurant.address}
                    </p>
                    <p className="icon-text">
                      <Icon name="clock" size={15} />
                      {state.detail}
                    </p>
                    <Link className="button secondary full-width" to={path}>
                      {kitchen
                        ? "Open kitchen"
                        : admin
                          ? "Manage restaurant"
                          : "Explore menu"}
                      <Icon name="arrow" size={17} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DataState>
      {modal && (
        <RestaurantForm
          onClose={() => setModal(false)}
          onSaved={query.refresh}
        />
      )}
    </>
  );
}
