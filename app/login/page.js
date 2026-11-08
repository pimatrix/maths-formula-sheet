"use client";

import { useEffect, useState } from "react";
import { BP, fetchMe, getSession, login, signup } from "../../lib/client";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (getSession()) afterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function afterAuth() {
    const pending = sessionStorage.getItem("fs_pending_add");
    if (pending) {
      window.location.href = BP + "/add";
      return;
    }
    const me = await fetchMe();
    if (me && me.role === "admin") window.location.href = BP + "/dashboard";
    else window.location.href = BP + "/";
  }

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "signup") {
        const s = await signup(email.trim(), password, name.trim());
        if (!s) {
          setInfo("Account created. Please check your email to confirm, then login.");
          setMode("login");
          setBusy(false);
          return;
        }
      } else {
        await login(email.trim(), password);
      }
      await afterAuth();
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <h2>{mode === "signup" ? "Create your account" : "Login"}</h2>
        <p className="sub">Viewing formulas is free for everyone. An account is needed only to add or manage formulas.</p>
        <div className="fs-notice">
          <b>Why an account?</b> You are {mode === "signup" ? "creating this account" : "logging into this account"} so
          that it is known <b>who added each formula</b>. This keeps spam away and makes every formula traceable to its
          contributor.
          <br />
          <span>Aap ye account isliye bana/login kar rahe hain taaki pata chal sake ki formula kisne add kiya hai — koi spam na kar sake isliye.</span>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="fs-field">Your name *
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yash Sharma" />
            </label>
          )}
          <label className="fs-field">Email *
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="fs-field">Password *
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Choose a password (min 6 characters)" : "Your password"} minLength={6} />
          </label>
          {error && <p className="fs-form-error">{error}</p>}
          {info && <p style={{ color: "#1e7b34", fontSize: 14 }}>{info}</p>}
          <button className="fs-btn-primary big" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>
        <p className="fs-auth-switch">
          {mode === "signup" ? (
            <>Already have an account? <button onClick={() => setMode("login")}>Login</button></>
          ) : (
            <>New here? <button onClick={() => setMode("signup")}>Create an account</button></>
          )}
        </p>
      </div>
    </div>
  );
}
