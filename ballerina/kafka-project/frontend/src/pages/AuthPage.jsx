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
    <main className="night-login">
      <div className="login-scene">
        <div className="login-photo" role="img" aria-label="Freshly made burgers photographed on a dark table" />
        <div className="login-photo-shade" />
        <header className="login-scene-head"><span className="login-logo">N<span>.</span></span><span>EST. 2026&nbsp; / &nbsp;NAMIBIA</span></header>
        <div className="login-scene-copy"><span className="tag-dark">DON'T SETTLE FOR AVERAGE</span><h2>LATE NIGHTS.<br/><em>BIG BITES.</em></h2><p>Your city's best local kitchens, one epic craving away.</p><div className="login-star">✳</div></div>
        <div className="login-scene-foot"><span>01 — 03 / EAT DIFFERENTLY</span><span>SCROLL LESS. TASTE MORE. ↗</span></div>
      </div>
      <section className="login-desk">
        <div className="login-desk-head"><span className="eyebrow">NIGHTSHIFT / EATS</span><span className="live"><i/> ORDER SYSTEM ONLINE</span></div>
        <div className="login-form-center">
          <span className="login-edition">A NEW WAY TO FEED YOUR MOOD <span>✳</span></span>
          <h1>{role === "admin" ? "Take the wheel." : register ? "Get in on it." : <>The good stuff<br/><em>starts here.</em></>}</h1>
          <p className="login-sub">{role === "admin" ? "Your operations HQ is ready." : "Sign in, pick a spot, and let the cravings lead."}</p>
          <div className="login-mode" aria-label="Select account type">
            <button className={role === "customer" ? "selected" : ""} type="button" onClick={() => {setRole("customer");setError("");}}>I'M ORDERING <Icon name="bag" size={16}/></button>
            <button className={role === "admin" ? "selected" : ""} type="button" onClick={() => {setRole("admin");setError("");}}>I'M MANAGING <Icon name="grid" size={16}/></button>
          </div>
          {role === "customer" && <div className="login-register-tabs"><button type="button" className={!register ? "selected" : ""} onClick={() => {setRegister(false);setError("");}}>LOG IN</button><button type="button" className={register ? "selected" : ""} onClick={() => {setRegister(true);setError("");}}>CREATE ACCOUNT</button></div>}
          <form className="form-stack login-form" onSubmit={submit} key={`${role}-${register}`}>
            {role === "admin" ? <><Field label="Username"><input name="username" autoComplete="username" placeholder="Admin username" required/></Field><Field label="Password"><input name="password" type="password" autoComplete="current-password" placeholder="Your password" required/></Field></> : <>
              {register && <><Field label="Full name"><input name="fullName" autoComplete="name" maxLength={100} placeholder="Your name" required/></Field><Field label="Username"><input name="username" autoComplete="username" maxLength={50} placeholder="Choose a username" required/></Field></>}
              <Field label="Email address"><input name="email" type="email" autoComplete="email" maxLength={255} placeholder="you@example.com" required/></Field>
              {register && <Field label="Phone (optional)"><input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="+264 …"/></Field>}
            </>}
            {error && <div className="error-notice" role="alert">{error}</div>}
            <button className="button primary login-submit" disabled={busy}>{busy ? "PLEASE WAIT..." : role === "admin" ? "ENTER CONTROL ROOM" : register ? "CREATE YOUR ACCOUNT" : "LET'S GET EATING"}<span>↗</span></button>
          </form>
          <p className="demo-note">{role === "admin" ? <>Demo access: <strong>{DEMO_ADMIN.username} / {DEMO_ADMIN.password}</strong></> : "Demo sign-in uses your registered email only. No password authentication is implemented."}</p>
          <div className="login-shortcuts"><span>ON THE CREW?</span><Link to="/kitchen"><Icon name="chef" size={16}/> KITCHEN ↗</Link><Link to="/delivery"><Icon name="truck" size={17}/> DISPATCH ↗</Link></div>
        </div>
        <div className="login-desk-foot"><span>KEEP IT LOCAL. KEEP IT LOUD.</span><span>© NIGHTSHIFT EATS 2026</span></div>
      </section>
    </main>
  );
}
