import { NextResponse } from "next/server";
import { dbJson } from "../../../lib/supabase";

// Public list of admin notices: broadcasts and app-update announcements.
// Stored as fs_events rows of type "notice" written by the admin route
// (title in formula_name, kind in category, message in path, target
// version in referrer, admin email on the row so analytics exclude it).

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await dbJson(
    "fs_events?type=eq.notice&select=id,formula_name,category,path,referrer,created_at&order=created_at.desc&limit=20",
  );
  const notices = (rows || []).map((r) => ({
    id: r.id,
    title: r.formula_name || "",
    body: r.path || "",
    kind: r.category === "update" ? "update" : "broadcast",
    version: r.referrer || "",
    created_at: r.created_at,
  }));
  return NextResponse.json({ ok: true, notices });
}
