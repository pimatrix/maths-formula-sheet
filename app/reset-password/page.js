"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BP, setPasswordWithRecoveryToken } from "../../lib/client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const t = hash.get("access_token");
    if (t && hash.get("type") === "recovery") setToken(t);
    setReady(true);
  }, []);

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match. Please type the same password in both fields.");
      return;
    }
    setBusy(true);
    try {
      await setPasswordWithRecoveryToken(token, password);
      setDone(true);
    } catch (e) {
      setError(e.message || "Could not set the new password.");
    }
    setBusy(false);
  }

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <h2>Set a new password</h2>
        <p className="sub">Tum email me aaye hue reset link se yaha pahunche ho. Neeche apna <b>naya password</b> do baar
          daalo aur save kar do — uske baad tum usi naye password se login kar sakte ho. Ye link ek hi baar kaam karta hai.</p>
        {!ready ? (
          <p className="sub"><span className="fs-spinner dark" /> Checking your reset link…</p>
        ) : done ? (
          <>
            <div className="fs-notice"><b>Password changed.</b> You can now login with your new password.</div>
            <button className="fs-btn-primary big" onClick={() => (window.location.href = BP + "/login")}>Go to Login</button>
          </>
        ) : !token ? (
          <>
            <p className="sub">This page opens from the password-reset link in your email. The link seems missing or expired.</p>
            <p className="fs-auth-switch">
              <Link href="/forgot-password" style={{ color: "#143a66", fontWeight: 700 }}>Request a new reset link</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="fs-field">New password *
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a new password (min 6 characters)" minLength={6} />
            </label>
            <label className="fs-field">Confirm new password *
              <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type the new password again" minLength={6} />
            </label>
            {error && <p className="fs-form-error">{error}</p>}
            <button className="fs-btn-primary big" disabled={busy}>
              {busy ? <><span className="fs-spinner" /> Saving…</> : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
