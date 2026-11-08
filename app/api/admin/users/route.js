import { NextResponse } from "next/server";
import { requireUser, isAdmin, isAdminEmail, db, dbJson } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

async function guard(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return { err: NextResponse.json({ error: "Please login first." }, { status: 401 }) };
  if (!isAdmin(profile, user))
    return { err: NextResponse.json({ error: "Admin access only." }, { status: 403 }) };
  return { user, profile };
}

export async function GET(req) {
  const g = await guard(req);
  if (g.err) return g.err;
  const profiles = (await dbJson("profiles?select=*&order=created_at.asc")) || [];
  return NextResponse.json({
    users: profiles.map((p) => ({
      id: p.id,
      email: p.email,
      role: isAdminEmail(p.email) ? "admin" : p.role,
      lockedAdmin: isAdminEmail(p.email),
      institution: p.institution || "",
      study_level: p.study_level || "",
      created_at: p.created_at,
    })),
  });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.err) return g.err;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const userId = String(body?.userId || "");
  const role = body?.role === "admin" ? "admin" : "user";
  if (!/^[0-9a-fA-F-]{36}$/.test(userId))
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  const rows = await dbJson(`profiles?id=eq.${userId}&select=*`);
  const target = rows && rows[0];
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (isAdminEmail(target.email) && role !== "admin")
    return NextResponse.json(
      { error: "This account is a permanent admin (admin email) and cannot be demoted." },
      { status: 400 }
    );
  const r = await db(`profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  if (!r.ok) return NextResponse.json({ error: "Could not update the role." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
