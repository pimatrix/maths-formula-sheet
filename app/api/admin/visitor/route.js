import { NextResponse } from "next/server";
import { requireUser, isAdmin, isAdminEmail, dbJson } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

// One visitor's full story: identity/device summary + their event
// timeline (newest first). Identify by email, visitor_id, or ip.
export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const email = sp.get("email");
  const vid = sp.get("visitor_id");
  const ip = sp.get("ip");
  let filter = null;
  if (email) filter = `user_email=eq.${encodeURIComponent(email)}`;
  else if (vid) filter = `visitor_id=eq.${encodeURIComponent(vid)}`;
  else if (ip) filter = `ip=eq.${encodeURIComponent(ip)}`;
  if (!filter)
    return NextResponse.json({ error: "Missing visitor identity." }, { status: 400 });

  const rows = await dbJson(`fs_events?${filter}&select=*&order=created_at.desc&limit=300`);
  let profName = null;
  if (email) {
    const profs = await dbJson(
      `profiles?email=eq.${encodeURIComponent(email)}&select=name`
    );
    if (profs && profs[0] && profs[0].name) profName = profs[0].name;
  }
  const ev = (rows || []).filter((e) => !isAdminEmail(e.user_email));
  if (ev.length === 0)
    return NextResponse.json({ error: "No activity found." }, { status: 404 });
  const latest = ev[0];
  const first = ev[ev.length - 1];
  const t = new Date(latest.created_at || 0).getTime();
  return NextResponse.json({
    info: {
      user_name: profName,
      user_email: latest.user_email || null,
      visitor_id: latest.visitor_id || null,
      ip: latest.ip || null,
      device: latest.device, model: latest.model, os: latest.os,
      browser: latest.browser, city: latest.city, country: latest.country,
      network: latest.network, battery_level: latest.battery_level,
      first_seen: first.created_at,
      last_seen: latest.created_at,
      active_now: t >= Date.now() - 15 * 60000,
      minutes_ago: Math.max(0, Math.round((Date.now() - t) / 60000)),
      total: ev.length,
    },
    events: ev.map((e) => ({
      type: e.type,
      path: e.path,
      formula_name: e.formula_name,
      category: e.category,
      referrer: e.referrer,
      duration_sec: e.duration_sec,
      created_at: e.created_at,
    })),
  });
}
