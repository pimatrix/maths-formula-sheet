import { NextResponse } from "next/server";
import { requireUser, isAdmin, dbJson } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

// The admin sets the AI Tutor daily free-question limit for ALL users.
// The value is stored as the formula_name of the latest fs_events row of
// type 'ai_limit' (no extra table); /api/ai reads it with a 60 s cache,
// so a change applies within about a minute.

async function currentLimit() {
  try {
    const rows = await dbJson(
      "fs_events?type=eq.ai_limit&select=formula_name,created_at&order=created_at.desc&limit=1"
    );
    const n = parseInt(rows?.[0]?.formula_name, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 1000) return n;
  } catch {
    // fall through to the default
  }
  return 10;
}

export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user || !isAdmin(profile, user))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ limit: await currentLimit() });
}

export async function POST(req) {
  const { user, profile } = await requireUser(req);
  if (!user || !isAdmin(profile, user))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const limit = Math.floor(Number(body?.limit));
  if (!Number.isFinite(limit) || limit < 1 || limit > 1000)
    return NextResponse.json(
      { error: "Limit must be a whole number between 1 and 1000." },
      { status: 400 }
    );
  await dbJson("fs_events", {
    method: "POST",
    body: JSON.stringify({
      type: "ai_limit",
      user_id: user.id,
      user_email: user.email,
      path: "/admin/ai-limit",
      formula_name: String(limit),
    }),
  });
  return NextResponse.json({ ok: true, limit });
}
