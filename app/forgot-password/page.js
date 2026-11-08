"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordReset } from "../../lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e.message || "Could not send the reset email.");
    }
    setBusy(false);
  }

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <h2>Forgot password</h2>
        <p className="sub">Enter the email of your account. We will email you a link to set a new password.</p>
        {sent ? (
          <>
            <div className="fs-notice">
              <b>Reset link sent.</b> Please check your email inbox (and the spam folder) for a message from us, and
              open the link in it to set a new password. The link works once and expires after some time.
            </div>
            <p className="fs-auth-switch">
              <Link href="/login" style={{ color: "#143a66", fontWeight: 700 }}>Back to login</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="fs-field">Email *
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {error && <p className="fs-form-error">{error}</p>}
            <button className="fs-btn-primary big" disabled={busy}>
              {busy ? <><span className="fs-spinner" /> Sending…</> : "Send Reset Link"}
            </button>
            <p className="fs-auth-switch">
              Remembered it? <Link href="/login" style={{ color: "#143a66", fontWeight: 700 }}>Login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
