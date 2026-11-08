import { NextResponse } from "next/server";
import { requireUser, isAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.user_metadata?.name || "" },
    role: isAdmin(profile, user) ? "admin" : "user",
  });
}
