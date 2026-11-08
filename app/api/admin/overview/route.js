import { NextResponse } from "next/server";
import { requireUser, isAdmin, isAdminEmail, dbJson } from "../../../../lib/supabase";
import seed from "../../../../lib/formulas-seed.json";

export const dynamic = "force-dynamic";

function topCounts(items, keyFn, limit = 10) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 60);
  }
}

export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });

  const [profiles, formulas, categories, syllabus, events] = await Promise.all([
    dbJson("profiles?select=*"),
    dbJson("fs_formulas?select=*&order=created_at.desc"),
    dbJson("fs_categories?select=*"),
    dbJson("fs_syllabus?select=id"),
    dbJson("fs_events?select=*&order=created_at.desc&limit=6000"),
  ]);
  // The admin's own activity never appears in analytics.
  const ev = (events || []).filter((e) => !isAdminEmail(e.user_email));
  const pageviews = ev.filter((e) => e.type === "pageview");
  const views = ev.filter((e) => e.type === "formula_view");
  const shares = ev.filter((e) => e.type === "share");
  const todayStr = new Date().toISOString().slice(0, 10);
  const pvToday = pageviews.filter((e) => (e.created_at || "").slice(0, 10) === todayStr);
  const uniq = (list) => new Set(list.map((e) => e.visitor_id || e.ip || "?")).size;

  // Last 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayPv = pageviews.filter((e) => (e.created_at || "").slice(0, 10) === key);
    days.push({ date: key, pageviews: dayPv.length, visitors: uniq(dayPv) });
  }

  return NextResponse.json({
    totals: {
      users: (profiles || []).length,
      seedFormulas: seed.entries.length,
      addedFormulas: (formulas || []).length,
      categories: seed.categories.length + (categories || []).length,
      syllabus: (syllabus || []).length,
      pageviews: pageviews.length,
      pageviewsToday: pvToday.length,
      visitors: uniq(pageviews),
      visitorsToday: uniq(pvToday),
      formulaViews: views.length,
      shares: shares.length,
    },
    days,
    topFormulas: topCounts(views, (e) => e.formula_name, 12),
    topCategories: topCounts(pageviews, (e) => e.category, 10),
    topReferrers: topCounts(pageviews, (e) => hostOf(e.referrer) || "Direct / none", 10),
    topCountries: topCounts(ev, (e) => e.country, 10),
    topDevices: topCounts(ev, (e) => e.device, 6),
    topOS: topCounts(ev, (e) => e.os, 8),
    topBrowsers: topCounts(ev, (e) => e.browser, 8),
    recentShares: shares.slice(0, 25).map((e) => ({
      formula_name: e.formula_name,
      user_email: e.user_email,
      country: e.country,
      city: e.city,
      created_at: e.created_at,
    })),
    recentActivity: (formulas || []).slice(0, 30).map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      kind: f.kind,
      author_name: f.author_name,
      author_email: f.author_email,
      created_at: f.created_at,
      updated_at: f.updated_at,
    })),
    recentVisitors: pageviews.slice(0, 40).map((e) => ({
      created_at: e.created_at,
      path: e.path,
      user_email: e.user_email,
      ip: e.ip,
      country: e.country,
      city: e.city,
      device: e.device,
      model: e.model,
      os: e.os,
      browser: e.browser,
      battery_level: e.battery_level,
      battery_charging: e.battery_charging,
      network: e.network,
      referrer: e.referrer,
      duration_sec: e.duration_sec,
    })),
  });
}
