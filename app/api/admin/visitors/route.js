import { NextResponse } from "next/server";
import { requireUser, isAdmin, isAdminEmail, dbJson } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

// Visitors grouped from fs_events: one row per person (signed-in email
// when known, else the anonymous visitor id, else IP). Powers the Admin
// Dashboard's Visitors section: green = active in the last 15 minutes,
// amber = last active earlier.
export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });

  const events = await dbJson("fs_events?select=*&order=created_at.desc&limit=6000");
  const ev = (events || []).filter((e) => !isAdminEmail(e.user_email));
  const cutoff = Date.now() - 15 * 60000;
  const map = new Map();
  for (const e of ev) {
    const key = e.user_email || e.visitor_id || e.ip;
    if (!key) continue;
    let v = map.get(key);
    if (!v) {
      v = {
        key,
        user_email: e.user_email || null,
        visitor_id: e.visitor_id || null,
        ip: e.ip || null,
        first_seen: e.created_at,
        last_seen: e.created_at,
        pageviews: 0,
        formula_views: 0,
        shares: 0,
        questions: 0,
        total: 0,
        device: e.device, model: e.model, os: e.os, browser: e.browser,
        city: e.city, country: e.country, network: e.network,
        battery_level: e.battery_level,
      };
      map.set(key, v);
    }
    v.total++;
    if (e.type === "pageview") v.pageviews++;
    else if (e.type === "formula_view") v.formula_views++;
    else if (e.type === "share") v.shares++;
    else if (e.type === "ai_question") v.questions++;
    if (e.created_at && e.created_at < v.first_seen) v.first_seen = e.created_at;
    // rows arrive newest-first, so the first row seen for a visitor is
    // their latest — its device/place fields are already the freshest.
  }
  const visitors = [...map.values()].map((v) => {
    const t = new Date(v.last_seen || 0).getTime();
    return {
      ...v,
      active_now: t >= cutoff,
      minutes_ago: Math.max(0, Math.round((Date.now() - t) / 60000)),
    };
  });
  visitors.sort((a, b) => {
    if (a.active_now !== b.active_now) return a.active_now ? -1 : 1;
    return (b.last_seen || "") < (a.last_seen || "") ? -1 : 1;
  });
  return NextResponse.json({ visitors: visitors.slice(0, 200) });
}
