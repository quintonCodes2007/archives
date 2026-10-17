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
  const links = mode === "admin"
    ? adminLinks
    : mode === "customer"
      ? [["/restaurants", "store", "Explore"], ["/customer/orders", "bag", "My orders"]]
      : [["/kitchen", "chef", "Kitchen"], ["/delivery", "truck", "Dispatch"]];
  const name = mode === "admin" ? "Demo admin" : mode === "customer" ? session?.customer?.fullName : "Operations team";
  const home = mode === "admin" ? "/admin" : mode === "customer" ? "/restaurants" : "/kitchen";
  return (
    <div className={`app-shell app-shell--${mode}`}>
      <header className="masthead">
        <div className="masthead-inner">
          <Link className="brand" to={home} aria-label="Savour home">
            <span className="brand-mark"><Icon name="leaf" size={21} /></span>
            <span className="brand-word">savour<span className="brand-dot">.</span></span>
          </Link>
          <nav className="masthead-nav" aria-label="Main navigation">
            {links.map(([to, icon, label]) => (
              <NavLink key={to} to={to} end={to === "/admin"}>
                <Icon name={icon} size={17} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="masthead-account">
            <div className="profile">
              <span className="avatar">{name?.slice(0, 1)?.toUpperCase() || "S"}</span>
              <div className="profile-label"><strong>{name || "Guest"}</strong><small>{mode === "customer" ? "Food explorer" : mode === "admin" ? "Management" : "Live operations"}</small></div>
            </div>
            <button className="logout-button" onClick={() => { logout(); navigate("/"); }} title={session ? "Log out" : "Return to login"}>
              <Icon name="logout" size={17}/><span>{session ? "Log out" : "Sign in"}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="workspace-strip">
        <div className="workspace-strip-inner">
          <span className="workspace-edition">SAVOUR <span> / </span> {mode === "customer" ? "THE FOOD EDIT" : mode === "admin" ? "STUDIO MANAGER" : "SERVICE DESK"}</span>
          <span className="workspace-message">{mode === "customer" ? "Local kitchens. Seriously good food." : mode === "admin" ? "Everything you need to run the show." : "From the pass to the front door."}</span>
          <div className="workspace-tools">
            {mode !== "customer" && <><Link to="/kitchen"><Icon name="chef" size={15}/> Kitchen</Link><Link to="/delivery"><Icon name="truck" size={15}/> Dispatch</Link></>}
            <span className="workspace-live"><span /> MADE FOR NAMIBIA</span>
          </div>
        </div>
      </div>
      <div className="main-shell">
        <main className="page-content"><Outlet /></main>
        <footer className="app-footer"><span>© 2026 SAVOUR STUDIO · LOCAL GOODNESS, DELIVERED.</span><span>DSA · DISTRIBUTED FOOD PLATFORM</span></footer>
      </div>
    </div>
  );
}
