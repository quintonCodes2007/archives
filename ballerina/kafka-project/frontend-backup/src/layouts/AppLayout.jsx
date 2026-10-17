import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const adminLinks = [
  ["/admin", "grid", "Overview"],
  ["/admin/restaurants", "store", "Restaurants"],
  ["/admin/drivers", "users", "Drivers"],
  ["/admin/orders", "bag", "Orders"],
  ["/admin/reports", "chart", "Reports"],
];
export default function AppLayout({ mode = "customer" }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const links =
    mode === "admin"
      ? adminLinks
      : mode === "customer"
        ? [
            ["/restaurants", "store", "Restaurants"],
            ["/customer/orders", "bag", "My orders"],
          ]
        : [
            ["/kitchen", "chef", "Kitchen"],
            ["/delivery", "truck", "Deliveries"],
          ];
  const name =
    mode === "admin"
      ? "Demo admin"
      : mode === "customer"
        ? session?.customer.fullName
        : "Operations team";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          className="brand"
          to={
            mode === "admin"
              ? "/admin"
              : mode === "customer"
                ? "/restaurants"
                : "/kitchen"
          }
        >
          <span className="brand-mark">
            <Icon name="leaf" size={23} />
          </span>
          food<span>lane</span>
          <i />
        </Link>
        <div className="nav-label">
          {mode === "admin"
            ? "MANAGEMENT"
            : mode === "customer"
              ? "YOUR EVERYDAY FAVOURITES"
              : "WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {links.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"}>
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name={mode === "customer" ? "bag" : "chef"} size={28} />
            <strong>
              {mode === "customer"
                ? "Good food, closer."
                : "A smoother service."}
            </strong>
            <p>
              {mode === "customer"
                ? "Your next favourite meal is just around the corner."
                : "From the kitchen to the doorstep, keep things moving."}
            </p>
          </div>
          {mode !== "customer" && (
            <div className="ops-links">
              <Link to="/kitchen">
                Kitchen workspace <Icon name="arrow" size={15} />
              </Link>
              <Link to="/delivery">
                Delivery workspace <Icon name="arrow" size={15} />
              </Link>
            </div>
          )}
          <button
            className="logout-button"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <Icon name="logout" />
            {session ? "Log out" : "Back to sign in"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="workspace-name">
            {mode === "admin"
              ? "Restaurant management"
              : mode === "customer"
                ? "A little local. A lot delicious."
                : "Foodlane operations"}
          </span>
          <div className="profile">
            <span className="avatar">{name?.slice(0, 1)}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {mode === "customer"
                  ? "Customer"
                  : mode === "admin"
                    ? "Demo workspace"
                    : "No sign-in required"}
              </small>
            </div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Foodlane · Made for the way you eat.</span>
          <span>DSA Assignment 2</span>
        </footer>
      </div>
    </div>
  );
}
