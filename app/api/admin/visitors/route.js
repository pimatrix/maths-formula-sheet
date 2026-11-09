import { NextResponse } from "next/server";
import { requireUser, isAdmin, isAdminEmail, dbJson } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

// Identity rule (one device = one count): signed-in email wins; else
// the persistent visitor id; else — for older events that carry no id —
// the device combo (IP + device + model + OS + browser) so one phone
// on one network is never split into many "visitors".
export function identityOf(e) {
  if (e.user_email) return "u:" + e.user_email;
  if (e.visitor_id) return "v:" + e.visitor_id;
  return "d:" + [e.ip, e.device, e.model, e.os, e.browser]
    .map((x) => x || "")
    .join("|");
}

// Visitors grouped from fs_events: one row per person/device, with the
// signed-up user's NAME when known. Green = active in the last
// 15 minutes, amber = last active earlier.
export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });

  const [events, profiles] = await Promise.all([
    dbJson("fs_events?select=*&order=created_at.desc&limit=6000"),
    dbJson("profiles?select=email,name"),
  ]);
  const nameByEmail = new Map(
    (profiles || []).map((p) => [(p.email || "").toLowerCase(), p.name || null])
  );
  const ev = (events || []).filter((e) => !isAdminEmail(e.user_email));
  const cutoff = Date.now() - 15 * 60000;
  const map = new Map();
  for (const e of ev) {
    const key = identityOf(e);
    let v = map.get(key);
    if (!v) {
      v = {
        key,
        user_email: e.user_email || null,
        user_name: e.user_email
          ? nameByEmail.get(e.user_email.toLowerCase()) || null
          : null,
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
    if (e.type !== "presence") v.total++;
    if (e.type === "pageview") v.pageviews++;
    else if (e.type === "formula_view") v.formula_views++;
    else if (e.type === "share") v.shares++;
    else if (e.type === "ai_question") v.questions++;
    if (e.created_at && e.created_at < v.first_seen) v.first_seen = e.created_at;
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
