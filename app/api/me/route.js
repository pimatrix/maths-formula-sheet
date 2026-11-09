import { NextResponse } from "next/server";
import { requireUser, isAdmin, db, SB_URL, SB_SERVICE } from "../../../lib/supabase";

// Writes auth user_metadata through the Supabase Admin API (service key).
async function setUserMetadata(user, patch) {
  const meta = { ...(user.user_metadata || {}), ...patch };
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_metadata: meta }),
  });
  return r.ok;
}

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
    analytics_opt_out: user.user_metadata?.analytics_opt_out === true,
    terms_accepted_at: user.user_metadata?.terms_accepted_at || null,
  });
}

export async function PUT(req) {
  const { user } = await requireUser(req);
  // Analytics opt-out lives in auth user_metadata (no extra table needed).
  let peek = null;
  try {
    peek = await req.clone().json();
  } catch {}
  if (peek && typeof peek.analytics_opt_out === "boolean") {
    const okMeta = await setUserMetadata(user, {
      analytics_opt_out: peek.analytics_opt_out,
    });
    if (!okMeta)
      return NextResponse.json({ error: "Could not save your privacy choice." }, { status: 502 });
    return NextResponse.json({ ok: true, analytics_opt_out: peek.analytics_opt_out });
  }
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

export async function DELETE(req) {
  const { user } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  // Delete the user's own data first, then the auth account itself.
  await db(`fs_formulas?user_id=eq.${user.id}`, { method: "DELETE" });
  await db(`fs_events?user_id=eq.${user.id}`, { method: "DELETE" });
  await db(`profiles?id=eq.${user.id}`, { method: "DELETE" });
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  if (!r.ok)
    return NextResponse.json(
      { error: "Your data was removed but the account itself could not be deleted. Please contact us." },
      { status: 502 }
    );
  return NextResponse.json({ ok: true });
}
