"use client";

import { useEffect, useState } from "react";
import { apiFetch, fetchMe, formatDateTime } from "../../lib/client";

function Bars({ items, label }) {
  if (!items || items.length === 0) return <p style={{ color: "#71808f", fontSize: 14 }}>No data yet.</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div aria-label={label}>
      {items.map((i) => (
        <div className="fs-bar-row" key={i.name}>
          <span className="name" title={i.name}>{i.name}</span>
          <span className="bar"><span className="fill" style={{ width: `${Math.round((i.count / max) * 100)}%`, display: "block" }} /></span>
          <span className="val">{i.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState("loading"); // loading | denied | ok
  const [ov, setOv] = useState(null);
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState("");

  async function load() {
    const me = await fetchMe();
    if (!me || me.role !== "admin") {
      setState("denied");
      return;
    }
    const [o, u] = await Promise.all([
      apiFetch("/api/admin/overview").then((r) => (r.ok ? r.json() : null)),
      apiFetch("/api/admin/users").then((r) => (r.ok ? r.json() : null)),
    ]);
    setOv(o);
    setUsers(u?.users || []);
    setState("ok");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRole(userId, role) {
    setBusyId(userId);
    const r = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ userId, role }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) alert(d.error || "Could not update.");
    await load();
    setBusyId("");
  }

  if (state === "loading") return <div className="fs-page"><p>Loading dashboard…</p></div>;
  if (state === "denied")
    return (
      <div className="fs-page">
        <h2 style={{ color: "#143a66" }}>Admin Dashboard</h2>
        <p>This page is only for admins. Please login with an admin account.</p>
      </div>
    );
  if (!ov) return <div className="fs-page"><p>Could not load analytics.</p></div>;

  const t = ov.totals;
  const stats = [
    ["Registered users", t.users],
    ["Visitors (unique, all time)", t.visitors],
    ["Visitors today", t.visitorsToday],
    ["Page views (all time)", t.pageviews],
    ["Page views today", t.pageviewsToday],
    ["Formula views", t.formulaViews],
    ["Shares", t.shares],
    ["Built-in formulas", t.seedFormulas],
    ["Student-added formulas", t.addedFormulas],
    ["Categories", t.categories],
    ["Syllabus items", t.syllabus],
  ];

  return (
    <div className="fs-page">
      <h2 style={{ color: "#143a66", margin: "4px 0 0" }}>Admin Dashboard</h2>
      <p style={{ color: "#5a6b7f", margin: "4px 0 0" }}>Everything happening on the formula site — users, contributions and analytics. Times are IST.</p>

      <div className="fs-stat-grid">
        {stats.map(([lbl, num]) => (
          <div className="fs-stat" key={lbl}>
            <div className="num">{num}</div>
            <div className="lbl">{lbl}</div>
          </div>
        ))}
      </div>

      <h3 className="fs-dash-h">Visitors — last 14 days</h3>
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead><tr><th>Date</th><th>Page views</th><th>Unique visitors</th></tr></thead>
          <tbody>
            {[...ov.days].reverse().map((d) => (
              <tr key={d.date}><td>{d.date}</td><td>{d.pageviews}</td><td>{d.visitors}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="fs-dash-h">Most viewed formulas</h3>
      <Bars items={ov.topFormulas} label="Top formulas" />
      <h3 className="fs-dash-h">Where visitors came from (referrers)</h3>
      <Bars items={ov.topReferrers} label="Referrers" />
      <h3 className="fs-dash-h">Countries</h3>
      <Bars items={ov.topCountries} label="Countries" />
      <h3 className="fs-dash-h">Devices · OS · Browsers</h3>
      <Bars items={ov.topDevices} label="Devices" />
      <Bars items={ov.topOS} label="OS" />
      <Bars items={ov.topBrowsers} label="Browsers" />

      <h3 className="fs-dash-h">Who added what (latest contributions)</h3>
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead><tr><th>Formula / Theory</th><th>Category</th><th>Added by</th><th>Date & time (IST)</th></tr></thead>
          <tbody>
            {ov.recentActivity.map((a) => (
              <tr key={a.id}>
                <td>{a.name} <span style={{ color: "#b45309" }}>({a.kind})</span></td>
                <td>{a.category}</td>
                <td>{a.author_name || "—"}<br /><span style={{ color: "#71808f" }}>{a.author_email}</span></td>
                <td>{formatDateTime(a.created_at)}</td>
              </tr>
            ))}
            {ov.recentActivity.length === 0 && <tr><td colSpan={4}>No contributions yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="fs-dash-h">Recent shares</h3>
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead><tr><th>Formula</th><th>Shared by</th><th>Place</th><th>Date & time (IST)</th></tr></thead>
          <tbody>
            {ov.recentShares.map((s, i) => (
              <tr key={i}>
                <td>{s.formula_name || "—"}</td>
                <td>{s.user_email || "Guest visitor"}</td>
                <td>{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                <td>{formatDateTime(s.created_at)}</td>
              </tr>
            ))}
            {ov.recentShares.length === 0 && <tr><td colSpan={4}>No shares yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="fs-dash-h">Recent visitors (detail)</h3>
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead>
            <tr><th>When (IST)</th><th>Page</th><th>User</th><th>IP</th><th>Place</th><th>Device</th><th>OS / Browser</th><th>Battery</th><th>Network</th><th>Came from</th><th>Time</th></tr>
          </thead>
          <tbody>
            {ov.recentVisitors.map((v, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(v.created_at)}</td>
                <td>{v.path}</td>
                <td>{v.user_email || "Guest"}</td>
                <td>{v.ip || "—"}</td>
                <td>{[v.city, v.country].filter(Boolean).join(", ") || "—"}</td>
                <td>{[v.device, v.model].filter(Boolean).join(" · ") || "—"}</td>
                <td>{[v.os, v.browser].filter(Boolean).join(" / ") || "—"}</td>
                <td>{v.battery_level != null ? `${v.battery_level}%${v.battery_charging ? " ⚡" : ""}` : "—"}</td>
                <td>{v.network || "—"}</td>
                <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.referrer || ""}>{v.referrer || "Direct"}</td>
                <td>{v.duration_sec ? `${v.duration_sec}s` : "—"}</td>
              </tr>
            ))}
            {ov.recentVisitors.length === 0 && <tr><td colSpan={11}>No visitors yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="fs-dash-h">Users & admins</h3>
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead><tr><th>Email</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}{u.lockedAdmin ? " (permanent)" : ""}</td>
                <td>{formatDateTime(u.created_at)}</td>
                <td>
                  {u.role !== "admin" ? (
                    <button className="fs-mini-btn" disabled={busyId === u.id} onClick={() => setRole(u.id, "admin")}>Make Admin</button>
                  ) : u.lockedAdmin ? (
                    <span style={{ color: "#71808f" }}>—</span>
                  ) : (
                    <button className="fs-mini-btn fs-mini-danger" disabled={busyId === u.id} onClick={() => setRole(u.id, "user")}>Remove Admin</button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4}>No registered users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#71808f", fontSize: 13, marginTop: 14 }}>
        Note: device model and battery are shown only when the visitor's browser provides them (most Chrome/Android
        browsers do; iPhone/Safari usually does not share model or battery). Admins can edit or delete any
        student-added formula from the main formulas page.
      </p>
    </div>
  );
}
