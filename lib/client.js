"use client";

// Client-side helpers: auth session (Supabase Auth REST), API calls, analytics.
export const BP = "/math-formula-sheet-m1";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SESSION_KEY = "fs_session";
const VISITOR_KEY = "fs_visitor";

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(s) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event("fs-auth"));
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event("fs-auth"));
  } catch {}
}

function sessionFromAuthResponse(d) {
  if (!d || !d.access_token) return null;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    user: { id: d.user.id, email: d.user.email, name: d.user.user_metadata?.name || "" },
  };
}

export async function signup(email, password, name) {
  const r = await fetch(`${SB_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { name } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || d.error || "Signup failed.");
  const s = sessionFromAuthResponse(d);
  if (s) saveSession(s);
  return s; // null when email confirmation is required
}

export async function login(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.error || "Login failed. Check email and password.");
  const s = sessionFromAuthResponse(d);
  if (s) saveSession(s);
  return s;
}

export async function logout() {
  const s = getSession();
  if (s) {
    try {
      await fetch(`${SB_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${s.access_token}` },
      });
    } catch {}
  }
  clearSession();
}

async function refreshSession() {
  const s = getSession();
  if (!s?.refresh_token) return null;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!r.ok) {
    clearSession();
    return null;
  }
  const d = await r.json();
  const ns = sessionFromAuthResponse(d);
  if (ns) saveSession(ns);
  return ns;
}

export async function validSession() {
  const s = getSession();
  if (!s) return null;
  if (s.expires_at && s.expires_at - Date.now() < 60_000) {
    return (await refreshSession()) || null;
  }
  return s;
}

export async function apiFetch(path, options = {}) {
  const s = await validSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (s) headers.Authorization = `Bearer ${s.access_token}`;
  return fetch(`${BP}${path}`, { ...options, headers });
}

export async function fetchMe() {
  const s = await validSession();
  if (!s) return null;
  try {
    const r = await apiFetch("/api/me");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ---------- Analytics ----------
export function visitorId() {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

let envCache = null;
async function collectEnv() {
  if (envCache) return envCache;
  const nav = navigator;
  const env = {
    ua: nav.userAgent || "",
    screen: `${window.screen.width}x${window.screen.height}`,
    language: nav.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    model: "",
    battery_level: null,
    battery_charging: null,
    network: "",
  };
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const h = await nav.userAgentData.getHighEntropyValues(["model", "platform"]);
      env.model = h.model || "";
    }
  } catch {}
  try {
    if (nav.getBattery) {
      const b = await nav.getBattery();
      env.battery_level = Math.round(b.level * 100);
      env.battery_charging = b.charging;
    }
  } catch {}
  try {
    env.network = nav.connection?.effectiveType || "";
  } catch {}
  envCache = env;
  return env;
}

export async function track(type, data = {}) {
  try {
    const env = await collectEnv();
    const s = getSession();
    const params = new URLSearchParams(window.location.search);
    const payload = {
      ...env,
      type,
      visitor_id: visitorId(),
      user_id: s?.user?.id || null,
      user_email: s?.user?.email || null,
      path: window.location.pathname,
      referrer: document.referrer || "",
      utm: ["utm_source", "utm_medium", "utm_campaign"]
        .map((k) => (params.get(k) ? `${k.replace("utm_", "")}=${params.get(k)}` : ""))
        .filter(Boolean)
        .join(" "),
      ...data,
    };
    await fetch(`${BP}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

export function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16).replace("T", " ");
  }
}
