"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BP, apiFetch, getSession } from "../../lib/client";

export default function AddClassPage() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [title, setTitle] = useState("");
  const [grp, setGrp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  useEffect(() => {
    setLoggedIn(Boolean(getSession()));
    setReady(true);
  }, []);

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Please give your class a name, e.g. Semester 2 Maths.");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), grp: grp.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not create the class.");
        setBusy(false);
        return;
      }
      setCreated(d.category);
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  if (!ready)
    return (
      <div className="fs-auth-wrap">
        <p className="fs-loading"><span className="fs-spinner dark" /> Loading…</p>
      </div>
    );

  if (!loggedIn)
    return (
      <div className="fs-auth-wrap">
        <div className="fs-auth-card">
          <h2>Add a Class</h2>
          <p className="sub">Please login first — a class is created in your name so everyone knows who started it.</p>
          <Link href="/login" style={{ color: "#143a66", fontWeight: 700 }}>Go to login / sign up</Link>
        </div>
      </div>
    );

  if (created)
    return (
      <div className="fs-auth-wrap">
        <div className="fs-auth-card">
          <h2>Class created</h2>
          <div className="fs-notice">
            <b>{created.title}</b> is ready. Ab is class ke andar tum formulas, theory aur syllabus add kar sakte ho —
            side wale menu me ye apni jagah par dikhega.
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <button className="fs-btn-primary big" onClick={() => (window.location.href = `${BP}/add?category=${created.slug}`)}>
              Add formulas in this class
            </button>
            <button className="fs-btn-ghost" onClick={() => (window.location.href = `${BP}/?cat=${created.slug}`)}>
              View this class
            </button>
            <button
              className="fs-btn-ghost"
              onClick={() => {
                setCreated(null);
                setTitle("");
                setGrp("");
              }}
            >
              Create another class
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <h2>Add a Class</h2>
        <p className="sub">
          A <b>class</b> is your own new book on this site — for a new semester or a new subject. Inside a class you
          add formulas, theory and syllabus, arranged in sections (topics).
        </p>
        <div className="fs-notice">
          <b>Example:</b> Next semester you start Semester 2 — create a class named <b>“Semester 2 Maths”</b>, then add
          its formulas inside it. Isi tarah school ke students apni class bhi bana sakte hain, jaise “Class 10 Maths”.
        </div>
        <form onSubmit={submit}>
          <label className="fs-field">Class name *
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Semester 2 Maths" />
          </label>
          <label className="fs-field">Group / semester label (optional)
            <input value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="e.g. Semester 2 — side menu me is heading ke neeche dikhega" />
          </label>
          {error && <p className="fs-form-error">{error}</p>}
          <button className="fs-btn-primary big" disabled={busy}>
            {busy ? <><span className="fs-spinner" /> Creating…</> : "Create Class"}
          </button>
        </form>
      </div>
    </div>
  );
}
