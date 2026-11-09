import { NextResponse } from "next/server";
import {
  requireUser,
  isAdmin,
  db,
  dbJson,
  SB_URL,
  SB_SERVICE,
} from "../../../../lib/supabase";

// Admin analytics-data management. The fs_events table doubles as the
// app's config store: rows of type 'notice' (broadcasts) and 'ai_limit'
// (the AI Tutor daily limit) are SETTINGS, not analytics, and are
// protected here — no delete mode below can ever touch them.
const PROTECTED = ["notice", "ai_limit"];
const NOT_PROTECTED = `type=not.in.(${PROTECTED.join(",")})`;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function gate(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return {
      error: NextResponse.json(
        { error: "Please log in." },
        { status: 401 }
      ),
    };
  if (!isAdmin(profile, user))
    return {
      error: NextResponse.json(
        { error: "Admins only." },
        { status: 403 }
      ),
    };
  return { user };
}

async function countOf(table) {
  try {
    const r = await db(`${table}?select=id`, {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    const cr = r.headers.get("content-range") || "";
    const n = parseInt((cr.split("/")[1] || "").trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function GET(req) {
  const g = await gate(req);
  if (g.error) return g.error;

  const rows =
    (await dbJson(
      `fs_events?${NOT_PROTECTED}&select=type&limit=10000`
    )) || [];
  const byType = {};
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + 1;
  const total = rows.length;

  // Rough size of the analytics data: average JSON row size from a
  // recent sample, times the row count. An estimate, labelled as such.
  const sample =
    (await dbJson(
      `fs_events?${NOT_PROTECTED}&select=*&order=created_at.desc&limit=100`
    )) || [];
  const avg = sample.length
    ? sample.reduce((a, r) => a + JSON.stringify(r).length, 0) /
      sample.length
    : 0;
  const eventsEstBytes = Math.round(avg * total);

  const recent =
    (await dbJson(
      `fs_events?${NOT_PROTECTED}&select=id,type,path,formula_name,user_email,created_at&order=created_at.desc&limit=100`
    )) || [];

  const tables = {};
  for (const t of [
    "fs_events",
    "fs_formulas",
    "fs_categories",
    "fs_syllabus",
    "profiles",
  ]) {
    tables[t] = await countOf(t);
  }

  // Real file-storage usage: the syllabus bucket's object sizes.
  let storageBytes = 0;
  let storageFiles = 0;
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/syllabus`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: 'Bearer ' + SB_SERVICE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: "", limit: 1000, offset: 0 }),
      cache: "no-store",
    });
    if (r.ok) {
      const files = await r.json();
      for (const f of files || []) {
        storageBytes += Number(f?.metadata?.size || 0);
        storageFiles += 1;
      }
    }
  } catch {
    // storage usage is informational; never fail the whole summary
  }

  return NextResponse.json({
    ok: true,
    total,
    byType,
    recent,
    tables,
    eventsEstBytes,
    storage: { bytes: storageBytes, files: storageFiles },
    // Supabase Free plan limits for this project.
    limits: { dbBytes: 500 * 1024 * 1024, storageBytes: 1024 * 1024 * 1024 },
  });
}

export async function DELETE(req) {
  const g = await gate(req);
  if (g.error) return g.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const mode = String(body?.mode || "");
  let filter = "";
  if (mode === "ids") {
    const ids = (Array.isArray(body?.ids) ? body.ids : [])
      .map((x) => String(x))
      .filter((x) => /^[0-9a-fA-F-]{36}$/.test(x))
      .slice(0, 200);
    if (!ids.length)
      return NextResponse.json(
        { error: "No valid rows selected." },
        { status: 400 }
      );
    filter = `id=in.(${ids.join(",")})`;
  } else if (mode === "type") {
    const t = String(body?.type || "");
    if (!/^[a-z_]+$/.test(t) || PROTECTED.includes(t))
      return NextResponse.json(
        { error: "That data type cannot be deleted." },
        { status: 400 }
      );
    filter = `type=eq.${t}`;
  } else if (mode === "older") {
    const days = parseInt(body?.days, 10);
    if (!Number.isFinite(days) || days < 1 || days > 3650)
      return NextResponse.json(
        { error: "Give an age between 1 and 3650 days." },
        { status: 400 }
      );
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    filter = `created_at=lt.${encodeURIComponent(cutoff)}`;
  } else if (mode === "all") {
    if (body?.confirm !== "CLEAR ALL")
      return NextResponse.json(
        { error: "Confirmation missing." },
        { status: 400 }
      );
    filter = "";
  } else {
    return NextResponse.json(
      { error: "Unknown delete mode." },
      { status: 400 }
    );
  }

  const path = `fs_events?${NOT_PROTECTED}${filter ? `&${filter}` : ""}`;
  const r = await db(path, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!r.ok)
    return NextResponse.json(
      { error: "The delete failed on the server." },
      { status: 502 }
    );
  const rows = await r.json().catch(() => []);
  return NextResponse.json({
    ok: true,
    deleted: Array.isArray(rows) ? rows.length : 0,
  });
}
