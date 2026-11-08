"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BP, apiFetch, getSession } from "../../lib/client";

export default function AddClassPage() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [mode, setMode] = useState("class"); // class | category
  const [title, setTitle] = useState("");
  const [grp, setGrp] = useState("");
  const [groups, setGroups] = useState([]);
  const [inside, setInside] = useState("Units");
  const [newGroup, setNewGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  useEffect(() => {
    setLoggedIn(Boolean(getSession()));
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "category") setMode("category");
    fetch(`${BP}/api/categories`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const cats = d?.categories || [];
        const custom = [...new Set(cats.map((c) => c.group).filter((g) => g && g !== "Basics" && g !== "Units" && g !== "More"))];
        setGroups([
          { value: "Units", label: "M1 — Engineering Mathematics-I" },
          { value: "Basics", label: "Foundation — Class 11–12 Basics" },
          ...custom.map((g) => ({ value: g, label: g })),
          { value: "__new__", label: "Create a new group…" },
        ]);
      })
      .catch(() => {});
    setReady(true);
  }, []);

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    if (!title.trim()) {
      setError(mode === "class" ? "Please give your class a name, e.g. Semester 2 Maths." : "Please give the category a name.");
      return;
    }
    let finalGrp = grp.trim();
    if (mode === "category") {
      finalGrp = inside === "__new__" ? newGroup.trim() : inside;
      if (inside === "__new__" && !finalGrp) {
        setError("Please name the new group, or choose an existing one.");
        return;
      }
    }
    setBusy(true);
    try {
      const r = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), grp: finalGrp }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not create it.");
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
          <h2>{mode === "class" ? "Add a Class" : "Add a Category"}</h2>
          <p className="sub">Please login first — it is created in your name so everyone knows who started it.</p>
          <Link href="/login" style={{ color: "#4338ca", fontWeight: 700 }}>Go to login / sign up</Link>
        </div>
      </div>
    );

  if (created)
    return (
      <div className="fs-auth-wrap">
        <div className="fs-auth-card">
          <h2>{mode === "class" ? "Class created" : "Category created"}</h2>
          <div className="fs-notice">
            <b>{created.title}</b> is ready. Ab iske andar tum formulas, theory aur syllabus add kar sakte ho —
            side wale menu me ye apni jagah par dikhega.
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <button className="fs-btn-primary big" onClick={() => (window.location.href = `${BP}/add?category=${created.slug}`)}>
              Add formulas in this {mode === "class" ? "class" : "category"}
            </button>
            <button className="fs-btn-ghost" onClick={() => (window.location.href = `${BP}/?cat=${created.slug}`)}>
              View it
            </button>
            <button
              className="fs-btn-ghost"
              onClick={() => {
                setCreated(null);
                setTitle("");
                setGrp("");
                setNewGroup("");
              }}
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="fs-auth-wrap">
      <div className="fs-auth-card">
        <div className="fs-mode-tabs">
          <button className={mode === "class" ? "active" : ""} onClick={() => setMode("class")}>Add Class</button>
          <button className={mode === "category" ? "active" : ""} onClick={() => setMode("category")}>Add Category</button>
        </div>
        {mode === "class" ? (
          <>
            <h2>Add a Class</h2>
            <p className="sub">
              A <b>class</b> is your own new book on this site — for a new semester or a new subject. Inside a class
              you add formulas, theory and syllabus, arranged in sections (topics).
            </p>
            <div className="fs-notice">
              <b>Example:</b> Next semester you start Semester 2 — create a class named <b>“Semester 2 Maths”</b>, then
              add its formulas inside it. Isi tarah school ke students apni class bhi bana sakte hain, jaise “Class 10 Maths”.
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
          </>
        ) : (
          <>
            <h2>Add a Category</h2>
            <p className="sub">
              A <b>category</b> is a new topic-book <b>inside</b> an existing class or group — for example a new
              “Unit 6 · Fourier Series” category inside M1, or “Probability” inside your Semester 2 group.
            </p>
            <div className="fs-notice">
              <b>Class vs Category:</b> Naya semester/subject shuru karna hai to <b>Class</b> banao. Kisi existing
              class ke andar naya hissa jodna hai to <b>Category</b> banao — wo usi class ke neeche side menu me dikhegi.
            </div>
            <form onSubmit={submit}>
              <label className="fs-field">Category name *
                <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 6 · Fourier Series" />
              </label>
              <label className="fs-field">Add inside *
                <select value={inside} onChange={(e) => setInside(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </label>
              {inside === "__new__" && (
                <label className="fs-field">New group name *
                  <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="e.g. Semester 2" />
                </label>
              )}
              {error && <p className="fs-form-error">{error}</p>}
              <button className="fs-btn-primary big" disabled={busy}>
                {busy ? <><span className="fs-spinner" /> Creating…</> : "Create Category"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
