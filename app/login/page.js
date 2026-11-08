"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BP, fetchMe, getSession, login, signup } from "../../lib/client";

const CLASS_OPTIONS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [institution, setInstitution] = useState("");
  const [learnerType, setLearnerType] = useState("college"); // school | college | other
  const [level, setLevel] = useState("1st Year");
  const [levelText, setLevelText] = useState("");
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

  function composedStudyLevel() {
    if (learnerType === "school") return `School · ${level}`;
    if (learnerType === "college") return `College · ${level}`;
    return levelText.trim() ? `Other · ${levelText.trim()}` : "Other";
  }

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    setInfo("");
    if (mode === "signup") {
      if (password !== confirm) {
        setError("Passwords do not match. Please type the same password in both fields.");
        return;
      }
      if (!institution.trim()) {
        setError("Please tell us where you study (your school or college name).");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const s = await signup(email.trim(), password, name.trim(), {
          institution: institution.trim(),
          study_level: composedStudyLevel(),
        });
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
        <p className="sub">Viewing formulas is free for everyone — school and college students alike. An account is needed only to add or manage formulas.</p>
        <div className="fs-notice">
          <b>Why an account?</b> You are {mode === "signup" ? "creating this account" : "logging into this account"} so
          that it is known <b>who added each formula</b>. This keeps spam away and makes every formula traceable to its
          contributor.
          <br />
          <span>Aap ye account isliye bana/login kar rahe hain taaki pata chal sake ki formula kisne add kiya hai — koi spam na kar sake isliye.</span>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label className="fs-field">Your name *
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yash Sharma" />
              </label>
              <label className="fs-field">Where do you study? (school / college name) *
                <input required value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Medicaps University, Indore" />
              </label>
              <label className="fs-field">You are a *
                <select value={learnerType} onChange={(e) => { setLearnerType(e.target.value); setLevel(e.target.value === "school" ? "Class 10" : "1st Year"); }}>
                  <option value="school">School student</option>
                  <option value="college">College student</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {learnerType !== "other" ? (
                <label className="fs-field">{learnerType === "school" ? "Your class *" : "Your year *"}
                  <select value={level} onChange={(e) => setLevel(e.target.value)}>
                    {(learnerType === "school" ? CLASS_OPTIONS : YEAR_OPTIONS).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="fs-field">Your class / year
                  <input value={levelText} onChange={(e) => setLevelText(e.target.value)} placeholder="e.g. Preparing for JEE, Class 12 pass" />
                </label>
              )}
            </>
          )}
          <label className="fs-field">Email *
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="fs-field">Password *
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Choose a password (min 6 characters)" : "Your password"} minLength={6} />
          </label>
          {mode === "signup" && (
            <label className="fs-field">Confirm password *
              <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type the same password again" minLength={6} />
            </label>
          )}
          {error && <p className="fs-form-error">{error}</p>}
          {info && <p style={{ color: "#1e7b34", fontSize: 14 }}>{info}</p>}
          <button className="fs-btn-primary big" disabled={busy}>
            {busy ? <><span className="fs-spinner" /> Please wait…</> : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>
        {mode === "login" && (
          <p className="fs-auth-switch" style={{ marginTop: 10 }}>
            <Link href="/forgot-password" style={{ color: "#143a66", fontWeight: 700 }}>Forgot your password?</Link>
          </p>
        )}
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
