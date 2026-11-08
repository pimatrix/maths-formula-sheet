"use client";

import { useEffect, useRef, useState } from "react";
import { BP, apiFetch, getSession } from "../../lib/client";
import { AI_FORMULA_PROMPT, formulaTextToHtml } from "../../lib/render";

const PENDING_KEY = "fs_pending_add";

export default function AddPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ kind: "formula", name: "", category: "basics-trigonometry", section: "", formula: "" });
  const [newCat, setNewCat] = useState(false);
  const [catForm, setCatForm] = useState({ title: "", grp: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const autoTried = useRef(false);

  async function loadCategories() {
    try {
      const r = await fetch(`${BP}/api/categories`);
      const d = await r.json();
      setCategories(d.categories || []);
      return d.categories || [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    loadCategories();
    // Restore any pending submission (user filled the form, then logged in)
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.form) setForm(p.form);
        if (p.newCat) {
          setNewCat(true);
          setCatForm(p.catForm || { title: "", grp: "" });
        }
        if (getSession() && !autoTried.current) {
          autoTried.current = true;
          setNote("Welcome back — submitting your formula now…");
          setTimeout(() => doSubmit(p), 400);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSubmit(payload) {
    const { form: f, newCat: nc, catForm: cf } = payload || { form, newCat, catForm };
    setBusy(true);
    setError("");
    try {
      let categorySlug = f.category;
      if (nc) {
        const r = await apiFetch("/api/categories", {
          method: "POST",
          body: JSON.stringify({ title: cf.title, grp: cf.grp }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not create the category.");
        categorySlug = d.category.slug;
        await loadCategories();
      }
      const r = await apiFetch("/api/formulas", {
        method: "POST",
        body: JSON.stringify({ ...f, category: categorySlug }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save the formula.");
      sessionStorage.removeItem(PENDING_KEY);
      window.location.href = `${BP}/?added=${d.entry.id}`;
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setBusy(false);
    }
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (!form.name.trim() || !form.formula.trim()) {
      setError("Please fill the name and the formula/theory text.");
      return;
    }
    if (newCat && !catForm.title.trim()) {
      setError("Please give the new category a name.");
      return;
    }
    if (!getSession()) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ form, newCat, catForm }));
      window.location.href = BP + "/login";
      return;
    }
    doSubmit();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_FORMULA_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Copy failed — please select the text and copy manually.");
    }
  }

  return (
    <div className="fs-page" style={{ maxWidth: 860 }}>
      <div className="fs-form-card">
        <h2>Add a Formula / Theory</h2>
        <p style={{ color: "#5a6b7f", fontSize: 14.5, margin: "0 0 6px" }}>
          Fill the details, check the live preview, then submit. If you are not logged in, you will be asked to
          login or create an account at the last step — so that it is known who added the formula.
        </p>

        <h3 style={{ color: "#143a66", margin: "16px 0 4px" }}>Get a perfectly formatted formula from any AI</h3>
        <ol className="fs-steps">
          <li>Copy the ready-made prompt below (one click).</li>
          <li>Paste it into any AI (ChatGPT, Gemini, Muse…) and add your formula at the end — or even describe it / give a photo of it to that AI.</li>
          <li>The AI will reply with clean <b>FormulaText</b>. Paste that into the Formula box below — it will instantly look exactly like a book, as the live preview shows.</li>
        </ol>
        <div className="fs-prompt-box">{AI_FORMULA_PROMPT}</div>
        <div style={{ margin: "10px 0 18px" }}>
          <button className="fs-copy-btn" onClick={copyPrompt} type="button">
            {copied ? "Copied ✓" : "Copy the Prompt (one click)"}
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <label className="fs-field">Type *
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="formula">Formula</option>
              <option value="theory">Theory / Properties</option>
            </select>
          </label>
          <label className="fs-field">{form.kind === "theory" ? "Theory title *" : "Formula name *"}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "theory" ? "e.g. Properties of Inverse of a Matrix" : "e.g. d/dx (sinh x)"} />
          </label>
          <label className="fs-field">Category *
            <select
              value={newCat ? "__new__" : form.category}
              onChange={(e) => {
                if (e.target.value === "__new__") setNewCat(true);
                else {
                  setNewCat(false);
                  setForm({ ...form, category: e.target.value });
                }
              }}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.group && c.custom ? `${c.group} · ` : ""}{c.title}</option>
              ))}
              <option value="__new__">＋ Create a new category…</option>
            </select>
          </label>
          {newCat && (
            <div style={{ background: "#fdf6e9", border: "1px solid #f0dcae", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <label className="fs-field">New category name *
                <input value={catForm.title} onChange={(e) => setCatForm({ ...catForm, title: e.target.value })} placeholder="e.g. Laplace Transforms" />
              </label>
              <label className="fs-field" style={{ marginBottom: 0 }}>Group (for organising — e.g. M2, M3, M4, Semester 3)
                <input value={catForm.grp} onChange={(e) => setCatForm({ ...catForm, grp: e.target.value })} placeholder="e.g. M2" />
              </label>
            </div>
          )}
          <label className="fs-field">Section (topic inside the category)
            <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. Taylor and Maclaurin Series" />
          </label>
          <label className="fs-field">{form.kind === "theory" ? "Theory / properties text *" : "Formula — FormulaText *"}
            <textarea
              rows={4}
              value={form.formula}
              onChange={(e) => setForm({ ...form, formula: e.target.value })}
              placeholder={"Paste the AI's FormulaText here, e.g.  x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}"}
            />
          </label>
          <p style={{ fontSize: 13, color: "#5a6b7f", margin: "0 0 6px" }}>Live preview — exactly how it will look on the site:</p>
          <div className="fs-preview" dangerouslySetInnerHTML={{ __html: formulaTextToHtml(form.formula) || "<span style='color:#93a3b5'>Preview will appear here…</span>" }} />
          {note && <p style={{ color: "#1e7b34", fontSize: 14 }}>{note}</p>}
          {error && <p className="fs-form-error">{error}</p>}
          <button className="fs-btn-primary big" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? "Please wait…" : "Submit →"}
          </button>
          <p style={{ fontSize: 13, color: "#71808f", marginTop: 8 }}>
            On submit, if you are not logged in, you will first login / create an account — your filled form is
            saved and will be submitted automatically right after login.
          </p>
        </form>
      </div>
    </div>
  );
}
