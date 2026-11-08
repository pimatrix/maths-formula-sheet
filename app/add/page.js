"use client";

import { useEffect, useRef, useState } from "react";
import { BP, apiFetch, getSession } from "../../lib/client";
import { AI_FORMULA_PROMPT, formulaTextToHtml } from "../../lib/render";

const PENDING_KEY = "fs_pending_add";

export default function AddPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ kind: "formula", name: "", category: "basics-trigonometry", section: "", formula: "", about: "", symbols: "", example: "" });
  const [newCat, setNewCat] = useState(false);
  const [catForm, setCatForm] = useState({ title: "", grp: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const autoTried = useRef(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanNote, setScanNote] = useState("");

  function downscaleImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Photo load nahi ho payi."));
      };
      img.src = url;
    });
  }

  async function onScanFile(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!getSession()) {
      setScanNote("Photo scan ke liye pehle login zaruri hai (AI ke galat istemal ko rokne ke liye). Pehle neeche wala form Submit karke login kar lo — phir photo dobara choose kar lena, AI sab bhar dega.");
      return;
    }
    setScanBusy(true);
    setScanNote("");
    try {
      const dataUrl = await downscaleImage(file);
      const r = await apiFetch("/api/scan", { method: "POST", body: JSON.stringify({ image: dataUrl }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Scan failed");
      setForm((f) => ({
        ...f,
        name: d.name || f.name,
        formula: d.formula || f.formula,
        section: d.section || f.section,
        about: d.about || f.about,
        symbols: d.symbols || f.symbols,
        example: d.example || f.example,
      }));
      setScanNote("AI ne sab bhar diya hai — ek baar check kar lo (kuchh galat lage to theek kar do), phir neeche Submit kar do.");
    } catch (e) {
      setScanNote(e.message || "Photo scan nahi ho paya. Dobara try karo, ya form haath se bhar do.");
    } finally {
      setScanBusy(false);
    }
  }

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
    loadCategories().then((cats) => {
      // Preselect a class/category when arriving from "Add Class" (?category=slug)
      try {
        if (!sessionStorage.getItem(PENDING_KEY)) {
          const want = new URLSearchParams(window.location.search).get("category");
          if (want && cats.some((c) => c.slug === want)) {
            setForm((f) => ({ ...f, category: want }));
          }
        }
      } catch {}
    });
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

        <div className="fs-scan-card">
          <h3 style={{ color: "#4338ca", margin: "0 0 4px" }}>Photo se formula add karo (AI) — sabse aasan tareeka</h3>
          <p style={{ color: "#44536a", fontSize: 14.5, margin: "0 0 10px" }}>
            Book ya copy se formula ki photo lo — AI khud uska <b>naam, formula, matlab, symbols ka arth aur example</b> bhar dega.
            Tumhe bas check karke Submit karna hai. (Photo scan ke liye login zaruri hai.)
          </p>
          <label className="fs-scan-btn">
            {scanBusy ? "AI photo padh raha hai…" : "Photo choose karo / camera se lo"}
            <input type="file" accept="image/*" onChange={onScanFile} disabled={scanBusy} style={{ display: "none" }} />
          </label>
          {scanBusy && <p style={{ fontSize: 13.5, color: "#5a6b7f", margin: "8px 0 0" }}>Thoda samay lagega (lagbhag 10–20 second)…</p>}
          {scanNote && <p style={{ fontSize: 14, color: "#2c3644", margin: "10px 0 0" }}>{scanNote}</p>}
        </div>

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
          <p style={{ fontSize: 13.5, color: "#44536a", margin: "14px 0 4px" }}><b>Detail (optional, lekin bahut kaam ki)</b> — ye teen cheezein "View" button me dikhengi, taaki padhne wale ko formula samajh aaye:</p>
          <label className="fs-field">Ye formula kis cheez ke liye hai?
            <textarea rows={2} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="e.g. Gives both roots of a quadratic equation directly, without factorising" />
          </label>
          <label className="fs-field">Symbols ka matlab (ek line me ek symbol)
            <textarea rows={3} value={form.symbols} onChange={(e) => setForm({ ...form, symbols: e.target.value })} placeholder={"a = coefficient of x^2\nb = coefficient of x\nc = constant term"} />
          </label>
          <label className="fs-field">Example / use case (ek chhota sa solved example)
            <textarea rows={3} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} placeholder="e.g. For x^2 - 5x + 6 = 0: x = (5 ± 1)/2, so x = 3 or 2" />
          </label>
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
