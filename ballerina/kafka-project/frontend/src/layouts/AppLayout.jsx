import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const adminLinks = [
  ["/admin", "grid", "Command"], ["/admin/restaurants", "store", "Restaurants"],
  ["/admin/drivers", "users", "Drivers"], ["/admin/orders", "bag", "All orders"],
  ["/admin/reports", "chart", "Analytics"],
];
const customerLinks = [["/restaurants", "store", "Discover"], ["/customer/orders", "bag", "Orders"]];
const operationsLinks = [["/kitchen", "chef", "Kitchens"], ["/delivery", "truck", "Dispatch"]];
export default function AppLayout({ mode = "customer" }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const links = mode === "admin" ? adminLinks : mode === "customer" ? customerLinks : operationsLinks;
  const name = mode === "admin" ? "Administrator" : mode === "customer" ? session?.customer?.fullName : "Operations team";
  const home = mode === "admin" ? "/admin" : mode === "customer" ? "/restaurants" : "/kitchen";
  return (
    <div className={`noir-shell app-shell--${mode}`}>
      <aside className="command-rail" aria-label="Application navigation">
        <Link className="rail-logo" to={home} aria-label="Nightshift home"><span>N</span><b>.</b></Link>
        <div className="rail-divider" />
        <nav className="rail-navigation" aria-label="Main navigation">
          {links.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} title={label}>
              <Icon name={icon} size={21}/><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-spacer" />
        <div className="rail-bottom">
          {mode !== "customer" && <Link to="/delivery" title="Delivery control"><Icon name="truck" size={20}/><span>Dispatch</span></Link>}
          <button onClick={() => { logout(); navigate("/"); }} title={session ? "Sign out" : "Sign in"}><Icon name="logout" size={20}/><span>{session ? "Sign out" : "Sign in"}</span></button>
        </div>
      </aside>
      <div className="noir-main">
        <header className="noir-topbar">
          <div className="topbar-location"><span className="signal-pulse"/> <span>NOW SERVING</span> <b>NAMIBIA</b></div>
          <Link to={home} className="wordmark">NIGHTSHIFT<span> / </span>EATS<span className="wordmark-star">✳</span></Link>
          <div className="topbar-user"><span className="topbar-greeting">{name || "Guest"}</span><span className="topbar-avatar">{(name || "N")[0].toUpperCase()}</span></div>
        </header>
        <div className="section-ribbon"><span>{mode === "customer" ? "01 / THE MENU" : mode === "admin" ? "02 / CONTROL CENTRE" : "03 / SERVICE OPERATIONS"}</span><span>INDEPENDENT KITCHENS · BOLD FLAVOUR · MADE IN NAMIBIA</span><span className="ribbon-live">● LIVE PLATFORM</span></div>
        <main className="noir-content page-content"><Outlet /></main>
        <footer className="noir-footer"><span>NIGHTSHIFT EATS © 2026</span><span>DESIGNED FOR THE HUNGRY / POWERED BY LOCAL KITCHENS</span><span>DSA612S</span></footer>
      </div>
    </div>
  );
}
