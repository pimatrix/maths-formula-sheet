import { NextResponse } from "next/server";
import { dbJson, isAdminEmail, SB_URL, SB_SERVICE } from "../../../lib/supabase";
import { getOptOut, setOptOut } from "../../../lib/optout";
import { parseUA } from "../../../lib/ua";

// Opt-out check with a small shared cache (lib/optout.js), so the
// Auth API is not hit for every event — and so /api/me can apply a
// toggle instantly by writing the fresh value into the same cache.
async function userOptedOut(userId) {
  if (!userId) return false;
  const hit = getOptOut(userId);
  if (hit !== undefined) return hit;
  let out = false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
      cache: "no-store",
    });
    if (r.ok) {
      const u = await r.json();
      out = u?.user_metadata?.analytics_opt_out === true;
    }
  } catch {}
  setOptOut(userId, out);
  return out;
}

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

function header(req, name) {
  return req.headers.get(name) || "";
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }
  // Admins' own activity is excluded from analytics.
  if (isAdminEmail(body.user_email)) return NextResponse.json({ ok: true, skipped: "admin" });
  // A signed-in user who opted out of analytics is never recorded.
  if (body.user_id && (await userOptedOut(body.user_id)))
    return NextResponse.json({ ok: true, skipped: "opt_out" });
  const ua = String(body.ua || header(req, "user-agent") || "");
  const parsed = parseUA(ua);
  const ip = (header(req, "x-forwarded-for") || "").split(",")[0].trim();
  let city = header(req, "x-vercel-ip-city") || "";
  try {
    city = decodeURIComponent(city);
  } catch {}
  const row = {
    visitor_id: String(body.visitor_id || "").slice(0, 80) || null,
    user_id: body.user_id || null,
    user_email: body.user_email || null,
    type: String(body.type || "pageview").slice(0, 40),
    path: String(body.path || "").slice(0, 300) || null,
    formula_name: body.formula_name ? String(body.formula_name).slice(0, 200) : null,
    category: body.category ? String(body.category).slice(0, 80) : null,
    referrer: body.referrer ? String(body.referrer).slice(0, 500) : null,
    utm: body.utm ? String(body.utm).slice(0, 200) : null,
    ip: ip || null,
    country: header(req, "x-vercel-ip-country") || null,
    city: city || null,
    ua: ua.slice(0, 400) || null,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    model: String(body.model || parsed.model || "").slice(0, 120) || null,
    screen: body.screen ? String(body.screen).slice(0, 30) : null,
    language: body.language ? String(body.language).slice(0, 20) : null,
    timezone: body.timezone ? String(body.timezone).slice(0, 60) : null,
    battery_level: Number.isInteger(body.battery_level) ? body.battery_level : null,
    battery_charging: typeof body.battery_charging === "boolean" ? body.battery_charging : null,
    network: body.network ? String(body.network).slice(0, 20) : null,
    duration_sec: Number.isInteger(body.duration_sec) ? body.duration_sec : null,
  };
  await dbJson("fs_events", { method: "POST", body: JSON.stringify(row) });
  return NextResponse.json({ ok: true });
}
