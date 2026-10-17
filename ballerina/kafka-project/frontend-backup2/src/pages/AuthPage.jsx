import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { customerApi } from "../api/customerApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DEMO_ADMIN } from "../config/demoAuth";
import FoodArt from "../components/FoodArt";
import Icon from "../components/Icon";
import { Field } from "../components/UI";

export default function AuthPage() {
  const { session, login } = useAuth();
  const [role, setRole] = useState("customer");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const notify = useToast();
  if (session)
    return (
      <Navigate
        to={session.role === "admin" ? "/admin" : "/restaurants"}
        replace
      />
    );
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (role === "admin") {
        if (
          fields.username !== DEMO_ADMIN.username ||
          fields.password !== DEMO_ADMIN.password
        )
          throw new Error("The demo admin username or password is incorrect.");
        login({ role: "admin" });
        navigate("/admin");
      } else {
        // Email-only demo sign-in resolves an actual database customer. No
        // password is invented, stored, or presented as production security.
        const customer = register
          ? await customerApi.create({
              username: fields.username.trim(),
              fullName: fields.fullName.trim(),
              email: fields.email.trim(),
              phone: fields.phone.trim() || null,
            })
          : await customerApi.lookup(fields.email);
        login({ role: "customer", customer });
        notify(
          register
            ? "Your account is ready. Let’s find something delicious."
            : `Welcome back, ${customer.fullName}.`,
        );
        navigate("/restaurants");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Icon name="leaf" size={23} />
          </span>
          <span className="brand-word">savour<span className="brand-dot">.</span></span>
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR TABLE IS WAITING</span>
          <h1>
            {role === "admin"
              ? "The control room."
              : register
                ? "Join the good side."
                : "Craving something good?"}
          </h1>
          <p className="auth-intro">
            {role === "admin"
              ? "Your restaurants, your people, your operation."
              : "Good tastes better when it’s local. Step inside."}
          </p>
          <div className="segmented" aria-label="Choose your role">
            {["customer", "admin"].map((value) => (
              <button
                key={value}
                type="button"
                className={role === value ? "selected" : ""}
                onClick={() => {
                  setRole(value);
                  setError("");
                }}
              >
                <Icon name={value === "customer" ? "bag" : "store"} size={17} />
                {value === "customer" ? "Customer" : "Admin"}
              </button>
            ))}
          </div>
          {role === "customer" && (
            <div className="auth-tabs">
              <button
                className={!register ? "selected" : ""}
                onClick={() => {
                  setRegister(false);
                  setError("");
                }}
              >
                Log in
              </button>
              <button
                className={register ? "selected" : ""}
                onClick={() => {
                  setRegister(true);
                  setError("");
                }}
              >
                Create account
              </button>
            </div>
          )}
          <form
            onSubmit={submit}
            key={`${role}-${register}`}
            className="form-stack"
          >
            {role === "admin" ? (
              <>
                <Field label="Username">
                  <input
                    name="username"
                    autoComplete="username"
                    placeholder="Enter your username"
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                {register && (
                  <>
                    <Field label="Full name">
                      <input
                        name="fullName"
                        autoComplete="name"
                        maxLength={100}
                        placeholder="Your full name"
                        required
                      />
                    </Field>
                    <Field label="Username">
                      <input
                        name="username"
                        autoComplete="username"
                        maxLength={50}
                        placeholder="Choose a username"
                        required
                      />
                    </Field>
                  </>
                )}
                <Field label="Email address">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    placeholder="you@example.com"
                    required
                  />
                </Field>
                {register && (
                  <Field label="Phone (optional)">
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="+264 …"
                    />
                  </Field>
                )}
              </>
            )}
            {error && (
              <div className="error-notice" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy
                ? "Please wait…"
                : role === "admin"
                  ? "Open workspace"
                  : register
                    ? "Create account"
                    : "Let’s eat"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="demo-note">
            {role === "admin" ? (
              <>
                Assignment demo · <strong>{DEMO_ADMIN.username} / {DEMO_ADMIN.password}</strong>
              </>
            ) : (
              "Assignment demo: sign in with a registered email. No password is required."
            )}
          </p>
          <div className="auth-operations">
            <span>Here to keep things moving?</span>
            <Link to="/kitchen">
              <Icon name="chef" size={17} />
              Kitchen
            </Link>
            <Link to="/delivery">
              <Icon name="truck" size={18} />
              Delivery
            </Link>
          </div>
        </div>
        <small className="auth-footer">
          SAVOUR STUDIO · FOOD IS THE OCCASION. © 2026
        </small>
      </section>
      <aside className="auth-visual">
        <div className="visual-kicker">
          <span className="small-dot" />
          THE GOOD FOOD CLUB / EST. 2026
        </div>
        <div className="auth-big-number" aria-hidden="true">01 / 03</div>
        <div className="auth-collage">
          <FoodArt kind="burger" className="collage-main" />
          <FoodArt kind="pizza" />
          <FoodArt kind="fries" />
          <FoodArt kind="drink" />
          <FoodArt kind="wrap" />
        </div>
        <div className="auth-floating-note">CURATED FOR YOUR CRAVINGS <span>↗</span></div>
        <div className="visual-caption">
          <span className="eyebrow">THE CITY HAS GOOD TASTE</span>
          <h2>
            Stay hungry.
            <br />
            Go local.
          </h2>
          <p>
            Independent kitchens. Excellent cravings.
            <br />
            A better way to eat around town.
          </p>
          <span className="visual-pill">
            <Icon name="leaf" size={16} />
            FRESH PLATES. FRESH PERSPECTIVE.
          </span>
        </div>
      </aside>
    </div>
  );
}
