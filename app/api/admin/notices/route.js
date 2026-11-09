import { NextResponse } from "next/server";
import { requireUser, isAdmin, db, dbJson } from "../../../../lib/supabase";

// Admin-only: post or retract a notice (broadcast or app update).

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const title = String(body?.title || "").trim().slice(0, 120);
  const text = String(body?.body || "").trim().slice(0, 1000);
  const kind = body?.kind === "update" ? "update" : "broadcast";
  const version = String(body?.version || "").trim().slice(0, 20);
  if (!title || !text)
    return NextResponse.json(
      { error: "Title and message are both required." },
      { status: 400 },
    );
  if (kind === "update" && !version)
    return NextResponse.json(
      { error: "An update notice needs the new version number." },
      { status: 400 },
    );
  const rows = await dbJson("fs_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      type: "notice",
      user_id: user.id,
      user_email: user.email,
      formula_name: title,
      category: kind,
      path: text,
      referrer: version || null,
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json(
      { error: "Could not post the notice." },
      { status: 502 },
    );
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function DELETE(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db(`fs_events?id=eq.${encodeURIComponent(id)}&type=eq.notice`, {
    method: "DELETE",
  });
  return NextResponse.json({ ok: true });
}
