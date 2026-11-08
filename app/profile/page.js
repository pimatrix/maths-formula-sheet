"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, fetchMe, getSession } from "../../lib/client";

const CLASS_OPTIONS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

export default function ProfilePage() {
  const [me, setMe] = useState(undefined);
  const [institution, setInstitution] = useState("");
  const [learnerType, setLearnerType] = useState("college");
  const [level, setLevel] = useState("1st Year");
  const [levelText, setLevelText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getSession()) {
      setMe(null);
      return;
    }
    fetchMe().then((m) => {
      setMe(m);
      const inst = m?.profile?.institution || "";
      const sl = m?.profile?.study_level || "";
      setInstitution(inst);
      if (sl.startsWith("School · ")) {
        setLearnerType("school");
        setLevel(sl.replace("School · ", "") || "Class 10");
      } else if (sl.startsWith("College · ")) {
        setLearnerType("college");
        setLevel(sl.replace("College · ", "") || "1st Year");
      } else if (sl) {
        setLearnerType("other");
        setLevelText(sl.replace("Other · ", ""));
      }
    });
  }, []);

  function composedStudyLevel() {
    if (learnerType === "school") return `School · ${level}`;
    if (learnerType === "college") return `College · ${level}`;
    return levelText.trim() ? `Other · ${levelText.trim()}` : "Other";
  }

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const r = await apiFetch("/api/me", {
        method: "PUT",
        body: JSON.stringify({ institution: institution.trim(), study_level: composedStudyLevel() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "Could not save.");
      else setMsg("Your details are saved.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  if (me === undefined)
    return (
      <div className="fs-auth-wrap">
        <p className="fs-loading"><span className="fs-spinner dark" /> Loading your profile…</p>
      </div>
    );
  if (!me)
    return (
      <div className="fs-auth-wrap">
        <div className="fs-auth-card">
          <h2>My Profile</h2>
          <p className="sub">Please login to see and update your details.</p>
          <Link href="/login" style={{ color: "#143a66", fontWeight: 700 }}>Go to login</Link>
        </div>
      </div>
    );

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <h2>My Profile</h2>
        <p className="sub">
          {me.user.name ? <><b>{me.user.name}</b> · </> : null}{me.user.email}
          {me.role === "admin" ? <> · <b>Admin</b></> : null}
        </p>
        <form onSubmit={submit}>
          <label className="fs-field">Where do you study? (school / college name)
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Medicaps University, Indore" />
          </label>
          <label className="fs-field">You are a
            <select value={learnerType} onChange={(e) => { setLearnerType(e.target.value); setLevel(e.target.value === "school" ? "Class 10" : "1st Year"); }}>
              <option value="school">School student</option>
              <option value="college">College student</option>
              <option value="other">Other</option>
            </select>
          </label>
          {learnerType !== "other" ? (
            <label className="fs-field">{learnerType === "school" ? "Your class" : "Your year"}
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {(learnerType === "school" ? CLASS_OPTIONS : YEAR_OPTIONS).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="fs-field">Your class / year
              <input value={levelText} onChange={(e) => setLevelText(e.target.value)} placeholder="e.g. Preparing for JEE" />
            </label>
          )}
          {error && <p className="fs-form-error">{error}</p>}
          {msg && <p style={{ color: "#1e7b34", fontSize: 14 }}>{msg}</p>}
          <button className="fs-btn-primary big" disabled={busy}>
            {busy ? <><span className="fs-spinner" /> Saving…</> : "Save Details"}
          </button>
        </form>
        <p className="fs-auth-switch">
          <Link href="/forgot-password" style={{ color: "#143a66", fontWeight: 700 }}>Change password by email reset</Link>
        </p>
      </div>
    </div>
  );
}
