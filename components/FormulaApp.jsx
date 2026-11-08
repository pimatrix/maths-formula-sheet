"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, fetchMe, formatDateTime, getSession, track } from "../lib/client";
import { detailsFor } from "../lib/details";
import { formulaTextToHtml } from "../lib/render";
import ShareButton from "./ShareButton";

const ORDER = ["basics-algebra", "basics-trigonometry", "basics-differentiation", "basics-integration", "unit1", "unit2", "unit3", "unit4", "unit5"];
const BASICS = ORDER.slice(0, 4);

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").toLowerCase();
}

export default function FormulaApp({ initialData }) {
  const [data, setData] = useState(initialData);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 120);
    return () => clearTimeout(t);
  }, [q]);
  const searchIndex = useMemo(() => {
    const m = {};
    (data?.entries || []).forEach((e) => {
      m[e.id] = `${e.name} ${e.section || ""} ${stripHtml(e.body)}`;
    });
    return m;
  }, [data]);
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [me, setMe] = useState(null);
  const [modal, setModal] = useState(null); // {type:'edit'|'delete', entry, form}
  const [viewEntry, setViewEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [highlightId, setHighlightId] = useState("");
  const [sylForm, setSylForm] = useState({ title: "", category: "", content: "" });
  const [sylFile, setSylFile] = useState(null);
  const [sylBusy, setSylBusy] = useState(false);
  const cardRefs = useRef({});
  const viewedRef = useRef(new Set());

  const categories = data?.categories || [];
  const catTitle = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.slug] = c.title));
    return m;
  }, [categories]);

  useEffect(() => {
    fetchMe().then(setMe);
    const catParam = new URLSearchParams(window.location.search).get("cat");
    if (catParam) setFilter(catParam);
    const added = new URLSearchParams(window.location.search).get("added");
    if (added) {
      setHighlightId(added);
      setTimeout(() => {
        const el = cardRefs.current[added];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      setTimeout(() => setHighlightId(""), 5000);
    }
    // refresh data (picks up anything new)
    apiFetch("/api/formulas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  // Track formula views (card visible on screen)
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        es.forEach((en) => {
          if (en.isIntersecting) {
            const id = en.target.getAttribute("data-fid");
            const name = en.target.getAttribute("data-fname");
            const cat = en.target.getAttribute("data-fcat");
            if (id && !viewedRef.current.has(id)) {
              viewedRef.current.add(id);
              track("formula_view", { formula_name: name, category: cat });
            }
          }
        });
      },
      { threshold: 0.6 }
    );
    Object.values(cardRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [data, filter, q, section]);

  const sectionsByCat = useMemo(() => {
    const map = {};
    (data?.entries || []).forEach((e) => {
      const s = e.section || "General";
      if (!map[e.category]) map[e.category] = [];
      if (!map[e.category].includes(s)) map[e.category].push(s);
    });
    return map;
  }, [data]);

  const sideGroups = useMemo(() => {
    const groups = [];
    const basics = categories.filter((c) => BASICS.includes(c.slug) || c.group === "Basics");
    const units = categories.filter(
      (c) => ["unit1", "unit2", "unit3", "unit4", "unit5"].includes(c.slug) || c.group === "Units" || (c.group || "").startsWith("M1")
    );
    const rest = categories.filter((c) => !basics.includes(c) && !units.includes(c));
    if (basics.length) groups.push({ label: "Foundation — Class 11–12 Basics", cats: basics });
    if (units.length) groups.push({ label: "M1 — Engineering Mathematics-I", cats: units });
    const byGroup = {};
    rest.forEach((c) => {
      const g = c.group || "More";
      (byGroup[g] = byGroup[g] || []).push(c);
    });
    Object.entries(byGroup).forEach(([label, cats]) => groups.push({ label, cats }));
    return groups;
  }, [categories]);

  function pickCategory(f) {
    setFilter(f);
    setSection("");
    setSideOpen(false);
  }
  function pickSection(slug, sec) {
    setFilter(slug);
    setSection(sec);
    setSideOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visible = useMemo(() => {
    if (!data) return [];
    let list = data.entries;
    if (filter === "basics") list = list.filter((e) => BASICS.includes(e.category));
    else if (filter !== "all") list = list.filter((e) => e.category === filter);
    if (section) list = list.filter((e) => (e.section || "General") === section);
    const rawNeedle = dq.trim().toLowerCase();
    if (rawNeedle) {
      const tokens = rawNeedle
        .split(/\s+/)
        .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
        .filter((t) => t.length >= 2);
      if (tokens.length) {
        const scored = list.map((e) => {
          const text = searchIndex[e.id] || "";
          const hits = tokens.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
          return { e, hits };
        });
        const all = scored.filter((s) => s.hits === tokens.length);
        if (all.length) list = all.map((s) => s.e);
        else
          list = scored
            .filter((s) => s.hits > 0)
            .sort((a, b) => b.hits - a.hits)
            .map((s) => s.e);
      }
    }
    return list;
  }, [data, filter, dq, section, searchIndex]);

  const grouped = useMemo(() => {
    const order = [...ORDER, ...categories.map((c) => c.slug).filter((s) => !ORDER.includes(s))];
    const byCat = {};
    visible.forEach((e) => {
      (byCat[e.category] = byCat[e.category] || []).push(e);
    });
    const out = [];
    order.forEach((slug) => {
      if (!byCat[slug]) return;
      const sections = [];
      const secMap = {};
      byCat[slug].forEach((e) => {
        const s = e.section || "General";
        if (!secMap[s]) {
          secMap[s] = [];
          sections.push({ name: s, items: secMap[s] });
        }
        secMap[s].push(e);
      });
      out.push({ slug, title: catTitle[slug] || slug, sections });
    });
    return out;
  }, [visible, catTitle, categories]);

  const visibleSyllabus = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.syllabus;
    if (filter === "basics") return []; // syllabus belongs to Engineering Mathematics (M1)
    // global syllabus (no category) shows with every class/unit view
    return data.syllabus.filter((s) => s.category === filter || !s.category);
  }, [data, filter]);

  const canModify = (e) =>
    Boolean(me && e.userAdded && (me.role === "admin" || e.user_id === me.user.id));

  function openEdit(entry) {
    setFormError("");
    setModal({
      type: "edit",
      entry,
      form: {
        name: entry.name,
        category: entry.category,
        section: entry.section || "",
        kind: entry.kind || "formula",
        formula: entry.body,
        about: entry.about || "",
        symbols: entry.symbols || "",
        example: entry.example || "",
      },
    });
  }
  function openDelete(entry) {
    setFormError("");
    setModal({ type: "delete", entry, form: null });
  }

  async function submitModal() {
    if (!modal) return;
    setSaving(true);
    setFormError("");
    try {
      let r;
      if (modal.type === "delete") {
        r = await apiFetch("/api/formulas", { method: "DELETE", body: JSON.stringify({ id: modal.entry.id }) });
      } else {
        r = await apiFetch("/api/formulas", { method: "PUT", body: JSON.stringify({ id: modal.entry.id, ...modal.form }) });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFormError(d.error || "Something went wrong.");
        setSaving(false);
        return;
      }
      if (modal.type === "delete") {
        setData((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== modal.entry.id) }));
        setToast("Entry deleted.");
      } else {
        setData((p) => ({ ...p, entries: p.entries.map((e) => (e.id === d.entry.id ? d.entry : e)) }));
        setToast("Entry updated.");
      }
      setModal(null);
      setSaving(false);
      setTimeout(() => setToast(""), 3000);
    } catch {
      setFormError("Network error. Please try again.");
      setSaving(false);
    }
  }

  async function submitSyllabus(ev) {
    ev.preventDefault();
    if (!getSession()) {
      window.location.href = "login";
      return;
    }
    setSylBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", sylForm.title);
      fd.append("category", sylForm.category);
      fd.append("content", sylForm.content);
      if (sylFile) fd.append("file", sylFile);
      const s = getSession();
      const r = await fetch("/math-formula-sheet-m1/api/syllabus", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.access_token}` },
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(d.error || "Could not save syllabus.");
        setSylBusy(false);
        return;
      }
      setSylForm({ title: "", category: "", content: "" });
      setSylFile(null);
      const fresh = await apiFetch("/api/formulas").then((x) => x.json());
      setData(fresh);
      setToast("Syllabus saved.");
      setTimeout(() => setToast(""), 3000);
    } catch {
      alert("Network error.");
    }
    setSylBusy(false);
  }

  async function deleteSyllabus(item) {
    if (!confirm(`Delete syllabus "${item.title}"?`)) return;
    const r = await apiFetch("/api/syllabus", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
    if (r.ok) setData((p) => ({ ...p, syllabus: p.syllabus.filter((s) => s.id !== item.id) }));
    else alert("Could not delete.");
  }

  function renderCard(e) {
    const inner =
      e.kind === "theory" ? (
        <article
          key={e.id}
          ref={(el) => (cardRefs.current[e.id] = el)}
          data-fid={e.id} data-fname={e.name} data-fcat={e.category}
          className={"fs-card fs-theory" + (highlightId === e.id ? " fs-highlight" : "")}
        >
          <h4>{e.name}</h4>
          {e.userAdded ? (
            <div className="fs-body" dangerouslySetInnerHTML={{ __html: formulaTextToHtml(e.body) }} />
          ) : (
            <div className="fs-body" dangerouslySetInnerHTML={{ __html: e.body }} />
          )}
          {cardFooter(e)}
        </article>
      ) : e.kind === "table" ? (
        <article
          key={e.id}
          ref={(el) => (cardRefs.current[e.id] = el)}
          data-fid={e.id} data-fname={e.name} data-fcat={e.category}
          className={"fs-card fs-table-card" + (highlightId === e.id ? " fs-highlight" : "")}
        >
          <h4>{e.name}</h4>
          <div className="fs-body" dangerouslySetInnerHTML={{ __html: e.body }} />
          {cardFooter(e)}
        </article>
      ) : (
        <article
          key={e.id}
          ref={(el) => (cardRefs.current[e.id] = el)}
          data-fid={e.id} data-fname={e.name} data-fcat={e.category}
          className={"fs-card" + (highlightId === e.id ? " fs-highlight" : "")}
        >
          <h4>{e.name}{e.userAdded ? <span className="fs-new"> · added</span> : null}</h4>
          {e.userAdded ? (
            <div className="fs-body" dangerouslySetInnerHTML={{ __html: formulaTextToHtml(e.body) }} />
          ) : (
            <div className="fs-body" dangerouslySetInnerHTML={{ __html: e.body }} />
          )}
          {cardFooter(e)}
        </article>
      );
    return inner;
  }

  function cardFooter(e) {
    return (
      <>
        {e.userAdded && (
          <div className="fs-card-meta">
            Added by {e.author_name || e.author_email || "a user"}
            {e.created_at ? <> · {formatDateTime(e.created_at)} IST</> : null}
            {e.updated_at && e.created_at && e.updated_at !== e.created_at ? (
              <> · edited {formatDateTime(e.updated_at)} IST</>
            ) : null}
          </div>
        )}
        <div className="fs-card-actions">
          <button className="fs-share-btn" onClick={() => setViewEntry(e)}>View</button>
          <ShareButton name={e.name} category={e.category} />
          {canModify(e) && (
            <>
              <button className="fs-mini-btn" onClick={() => openEdit(e)}>Edit</button>
              <button className="fs-mini-btn fs-mini-danger" onClick={() => openDelete(e)}>Delete</button>
            </>
          )}
        </div>
      </>
    );
  }

  const viewDetails = viewEntry ? detailsFor(viewEntry) : null;

  return (
    <div className="fs-root">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <h1>Engineering Mathematics — Formula Sheet</h1>
          <p>Basics (Class 11–12) + M1 Units 1–5, and more added by students. View free — login only to add.</p>
        </div>
      </div>

      <div className="fs-toolbar">
        <div className="fs-toolbar-inner">
          <div className="fs-search-row">
            <input
              className="fs-search"
              type="text"
              placeholder="Search any formula… e.g. Euler, Wallis, cos 2A, Integrating Factor"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Link className="fs-add-btn" href="/add" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>+ Add Formula</Link>
            <button className="fs-print-btn" onClick={() => window.print()}>Print</button>
          </div>
        </div>
      </div>

      <div className="fs-nav">
        <div className="fs-nav-inner">
          <button className="fs-browse-btn" onClick={() => setSideOpen((v) => !v)}>☰ Browse Categories &amp; Sections</button>
          <div className="fs-chips">
            <button className={filter === "all" && !section ? "fs-chip active" : "fs-chip"} onClick={() => pickCategory("all")}>All Formulas</button>
            <button className={filter === "basics" && !section ? "fs-chip active" : "fs-chip"} onClick={() => pickCategory("basics")}>All Basics</button>
            {categories.map((c) => (
              <button key={c.slug} className={filter === c.slug && !section ? "fs-chip active" : "fs-chip"} onClick={() => pickCategory(c.slug)}>
                {c.group && c.custom ? `${c.group} · ` : ""}{c.title}
              </button>
            ))}
          </div>
          {data && (
            <p className="fs-count">
              Showing <b>{visible.length}</b> of {data.entries.length} entries
              {q.trim() ? <> for “{q.trim()}”</> : null}
              {section ? <> · Section: <b>{section}</b> (<button className="fs-clear-sec" onClick={() => setSection("")}>show all sections</button>)</> : null}
            </p>
          )}
        </div>
      </div>

      <div className="fs-layout">
        <aside className={"fs-side" + (sideOpen ? " open" : "")}>
          <div className="fs-side-inner">
            <p className="fs-side-head">Browse — All or Specific</p>
            <button className={"fs-side-item" + (filter === "all" && !section ? " active" : "")} onClick={() => pickCategory("all")}>
              All Formulas <span className="fs-side-count">{data?.entries.length || 0}</span>
            </button>
            <button className={"fs-side-item" + (filter === "basics" && !section ? " active" : "")} onClick={() => pickCategory("basics")}>
              All Basics
            </button>
            {sideGroups.map((g) => (
              <div key={g.label}>
                <p className="fs-side-group">{g.label}</p>
                {g.label.startsWith("M1") && (
                  <button
                    className="fs-side-item fs-side-syllabus"
                    onClick={() => {
                      pickCategory("all");
                      setTimeout(() => document.getElementById("syllabus")?.scrollIntoView({ behavior: "smooth" }), 60);
                    }}
                  >
                    Syllabus — Engineering Mathematics
                  </button>
                )}
                {g.cats.map((c) => (
                  <div key={c.slug} className="fs-side-cat">
                    <div className="fs-side-cat-row">
                      <button
                        className={"fs-side-cat-btn" + (filter === c.slug && !section ? " active" : "")}
                        onClick={() => pickCategory(c.slug)}
                      >
                        {c.title}
                      </button>
                      <button
                        className="fs-side-toggle"
                        aria-label="Show sections"
                        onClick={() => setExpanded((p) => ({ ...p, [c.slug]: !p[c.slug] }))}
                      >
                        {expanded[c.slug] ? "▾" : "▸"}
                      </button>
                    </div>
                    {expanded[c.slug] && (
                      <div className="fs-side-secs">
                        {(sectionsByCat[c.slug] || []).map((s) => (
                          <button
                            key={s}
                            className={"fs-side-sec" + (filter === c.slug && section === s ? " active" : "")}
                            onClick={() => pickSection(c.slug, s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {me && (
              <>
                <p className="fs-side-group">Create New</p>
                <Link className="fs-side-item fs-side-create" href="/add-class" onClick={() => setSideOpen(false)}>+ Add Class</Link>
                <Link className="fs-side-item fs-side-create" href="/add-class?mode=category" onClick={() => setSideOpen(false)}>+ Add Category</Link>
              </>
            )}
          </div>
        </aside>
        {sideOpen && <div className="fs-side-backdrop" onClick={() => setSideOpen(false)} />}

      <main className="fs-main fs-main-side">
        {data && visible.length === 0 && <p className="fs-loading">No formula matched. Try a shorter search word.</p>}
        {grouped.map((g) => (
          <section key={g.slug} className="fs-cat">
            <h2 className="fs-cat-title">{g.title}</h2>
            {g.sections.map((s) => (
              <div key={s.name} className="fs-section">
                {s.name !== "General" && <h3 className="fs-sec-title">{s.name}</h3>}
                <div className="fs-grid">{s.items.map((e) => renderCard(e))}</div>
              </div>
            ))}
          </section>
        ))}

        {!dq.trim() && (
        <section className="fs-cat" id="syllabus">
          <h2 className="fs-cat-title">Syllabus — Engineering Mathematics (BTech 1st Year · 1st Semester)</h2>
          {visibleSyllabus.length === 0 ? (
            <p className="fs-count">No syllabus added yet for this view.</p>
          ) : (
            <div className="fs-syllabus-list">
              {visibleSyllabus.map((s) => (
                <div key={s.id} className="fs-syllabus-item">
                  <h4>{s.title}{s.category ? <span style={{ color: "#71808f", fontWeight: 500 }}> · {catTitle[s.category] || s.category}</span> : null}</h4>
                  {s.content && <div className="content">{s.content}</div>}
                  {s.file_url && (
                    <p style={{ margin: "6px 0 0" }}>
                      <a href={s.file_url} target="_blank" rel="noreferrer">Open / download file: {s.file_name || "syllabus file"}</a>
                    </p>
                  )}
                  <div className="fs-card-meta" style={{ borderTop: "none", paddingTop: 4 }}>
                    Uploaded by {s.author_email || "a user"} · {formatDateTime(s.created_at)} IST
                  </div>
                  {me && (me.role === "admin" || s.user_id === me.user.id) && (
                    <div className="fs-card-actions">
                      <button className="fs-mini-btn fs-mini-danger" onClick={() => deleteSyllabus(s)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {me ? (
            <form className="fs-form-card" style={{ marginTop: 14 }} onSubmit={submitSyllabus}>
              <h3 style={{ margin: "0 0 8px", color: "#143a66" }}>Add syllabus (text or file)</h3>
              <label className="fs-field">Title *
                <input required value={sylForm.title} onChange={(e) => setSylForm({ ...sylForm, title: e.target.value })} placeholder="e.g. Mathematics-II — Full Syllabus" />
              </label>
              <label className="fs-field">Category
                <select value={sylForm.category} onChange={(e) => setSylForm({ ...sylForm, category: e.target.value })}>
                  <option value="">General / all</option>
                  {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.title}</option>))}
                </select>
              </label>
              <label className="fs-field">Syllabus text (paste here)
                <textarea rows={4} value={sylForm.content} onChange={(e) => setSylForm({ ...sylForm, content: e.target.value })} placeholder="Paste the syllabus text…" />
              </label>
              <label className="fs-field">Or upload a file (PDF/image/text, max 4 MB)
                <input type="file" onChange={(e) => setSylFile(e.target.files?.[0] || null)} />
              </label>
              <button className="fs-btn-primary" disabled={sylBusy}>{sylBusy ? "Saving…" : "Save Syllabus"}</button>
            </form>
          ) : (
            <p className="fs-count" style={{ marginTop: 12 }}>
              <Link href="/login">Login</Link> to add syllabus material.
            </p>
          )}
        </section>
        )}

        <footer className="fs-footer">
          <p>Anyone can view. To add, edit or delete your own formulas, please login — this keeps spam away and shows who added what. This site uses analytics to understand which formulas students use most.</p>
        </footer>
      </main>
      </div>

      {modal && (
        <div className="fs-modal-backdrop" onClick={() => !saving && setModal(null)}>
          <div className="fs-modal" onClick={(e) => e.stopPropagation()}>
            {modal.type === "delete" ? (
              <>
                <h3>Delete this entry?</h3>
                <p className="fs-key-note">
                  <b>{modal.entry.name}</b> will be permanently deleted. This cannot be undone.
                </p>
                {formError && <p className="fs-form-error">{formError}</p>}
                <div className="fs-modal-actions">
                  <button className="fs-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button className="fs-btn-primary fs-btn-danger" onClick={submitModal} disabled={saving}>
                    {saving ? "Deleting…" : "Yes, Delete"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Edit entry</h3>
                <label>Type
                  <select value={modal.form.kind} onChange={(e) => setModal({ ...modal, form: { ...modal.form, kind: e.target.value } })}>
                    <option value="formula">Formula</option>
                    <option value="theory">Theory / Properties</option>
                  </select>
                </label>
                <label>Name *
                  <input value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} />
                </label>
                <label>Category *
                  <select value={modal.form.category} onChange={(e) => setModal({ ...modal, form: { ...modal.form, category: e.target.value } })}>
                    {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.title}</option>))}
                  </select>
                </label>
                <label>Section
                  <input value={modal.form.section} onChange={(e) => setModal({ ...modal, form: { ...modal.form, section: e.target.value } })} />
                </label>
                <label>{modal.form.kind === "theory" ? "Theory / properties text *" : "Formula (FormulaText) *"}
                  <textarea rows={3} value={modal.form.formula} onChange={(e) => setModal({ ...modal, form: { ...modal.form, formula: e.target.value } })} />
                </label>
                <div className="fs-preview" dangerouslySetInnerHTML={{ __html: formulaTextToHtml(modal.form.formula) }} />
                <label>What is this formula for? (optional)
                  <textarea rows={2} value={modal.form.about} onChange={(e) => setModal({ ...modal, form: { ...modal.form, about: e.target.value } })} placeholder="e.g. Gives both roots of a quadratic equation directly" />
                </label>
                <label>What do the symbols mean? (optional, one per line)
                  <textarea rows={3} value={modal.form.symbols} onChange={(e) => setModal({ ...modal, form: { ...modal.form, symbols: e.target.value } })} placeholder={"a = coefficient of x^2\nb = coefficient of x"} />
                </label>
                <label>Example / use case (optional)
                  <textarea rows={3} value={modal.form.example} onChange={(e) => setModal({ ...modal, form: { ...modal.form, example: e.target.value } })} placeholder="e.g. For x^2 - 5x + 6 = 0: x = (5 ± 1)/2, so x = 3 or 2" />
                </label>
                {formError && <p className="fs-form-error">{formError}</p>}
                <div className="fs-modal-actions">
                  <button className="fs-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button className="fs-btn-primary" onClick={submitModal} disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewEntry && (
        <div className="fs-modal-backdrop" onClick={() => setViewEntry(null)}>
          <div className="fs-modal fs-view-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>{viewEntry.name}</h3>
            <p className="fs-view-cat">
              {catBySlug[viewEntry.category]?.title || viewEntry.category}
              {viewEntry.section ? " · " + viewEntry.section : ""}
            </p>
            <div
              className={"fs-view-formula" + (viewEntry.kind === "theory" ? " fs-theory" : "")}
              dangerouslySetInnerHTML={{
                __html: viewEntry.userAdded ? formulaTextToHtml(viewEntry.body) : viewEntry.body,
              }}
            />
            {viewDetails ? (
              <>
                {viewDetails.about ? (
                  <div className="fs-view-block">
                    <h4>What is this formula for?</h4>
                    <p>{viewDetails.about}</p>
                  </div>
                ) : null}
                {viewDetails.symbols ? (
                  <div className="fs-view-block">
                    <h4>What the symbols mean</h4>
                    {viewDetails.symbols.split("\n").filter(Boolean).map((line, i) => {
                      const idx = line.indexOf(" = ");
                      return idx > 0 ? (
                        <div className="fs-sym-row" key={i}><b>{line.slice(0, idx)}</b><span>{line.slice(idx + 3)}</span></div>
                      ) : (
                        <p key={i} style={{ margin: "2px 0" }}>{line}</p>
                      );
                    })}
                  </div>
                ) : null}
                {viewDetails.example ? (
                  <div className="fs-view-block fs-view-example">
                    <h4>Example — how to use it</h4>
                    <p style={{ whiteSpace: "pre-wrap" }}>{viewDetails.example}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="fs-view-soon">Is formula ki detail (matlab, symbols aur example) abhi jodi ja rahi hai — jald milegi.</p>
            )}
            <div className="fs-modal-actions">
              <button className="fs-btn-ghost" onClick={() => setViewEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fs-toast">{toast}</div>}
    </div>
  );
}
