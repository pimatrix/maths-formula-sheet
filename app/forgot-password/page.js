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
        <p className="sub">Password bhool gaye? Koi baat nahi — neeche apna account wala email daalo, hum usi email par ek
          <b> password reset link</b> bhejenge. Us link ko kholkar tum naya password bana loge.</p>
        <ol className="fs-steps">
          <li>Apna wahi email daalo jisse account banaya tha, aur <b>Send Reset Link</b> dabao.</li>
          <li>Apna email inbox kholo — humari taraf se ek email aayega (kabhi-kabhi <b>Spam folder</b> me bhi chala jata hai, wahan bhi dekh lena).</li>
          <li>Email ke andar wale link par click karo — ek page khulega jahan tum <b>naya password</b> bana sakte ho.</li>
          <li>Naya password do baar daalo, save karo, aur fir usi naye password se login karo. Bas!</li>
        </ol>
        {sent ? (
          <>
            <div className="fs-notice">
              <b>Reset link bhej diya gaya hai.</b> Ab apna email inbox (aur Spam folder) check karo aur email ke link
              par click karke naya password bana lo. Dhyaan do: ye link <b>sirf ek baar</b> kaam karta hai aur kuch samay
              baad expire ho jata hai — expire ho jaye to yahi se naya link mangwa lena.
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
