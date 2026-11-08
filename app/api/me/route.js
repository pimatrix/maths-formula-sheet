import { NextResponse } from "next/server";
import { requireUser, isAdmin, db } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.user_metadata?.name || "" },
    role: isAdmin(profile, user) ? "admin" : "user",
    profile: {
      institution: profile?.institution || "",
      study_level: profile?.study_level || "",
    },
  });
}

export async function PUT(req) {
  const { user } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const institution = String(body?.institution || "").trim().slice(0, 160);
  const study_level = String(body?.study_level || "").trim().slice(0, 80);
  const r = await db(`profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ institution: institution || null, study_level: study_level || null }),
  });
  if (!r.ok) return NextResponse.json({ error: "Could not save your details." }, { status: 502 });
  return NextResponse.json({ ok: true, profile: { institution, study_level } });
}
