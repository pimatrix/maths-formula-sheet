import { NextResponse } from "next/server";
import { SB_URL, SB_SERVICE, requireUser, isAdmin, db, dbJson } from "../../../lib/supabase";
import { getAllSyllabus } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ syllabus: await getAllSyllabus() });
}

export async function POST(req) {
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login to add syllabus material." }, { status: 401 });
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const title = String(form.get("title") || "").trim();
  const category = String(form.get("category") || "").trim();
  const content = String(form.get("content") || "").trim();
  const file = form.get("file");
  if (!title || title.length > 160)
    return NextResponse.json({ error: "Please give a title." }, { status: 400 });
  if (content.length > 20000)
    return NextResponse.json({ error: "Text is too long (max 20,000 characters)." }, { status: 400 });

  let file_url = "";
  let file_name = "";
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > 4_000_000)
      return NextResponse.json({ error: "File is too big (max 4 MB)." }, { status: 400 });
    const safe = (file.name || "syllabus-file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
    const path = `${user.id}/${Date.now()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const up = await fetch(`${SB_URL}/storage/v1/object/syllabus/${path}`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    });
    if (!up.ok)
      return NextResponse.json({ error: "File upload failed. Please try again." }, { status: 502 });
    file_url = `${SB_URL}/storage/v1/object/public/syllabus/${path}`;
    file_name = file.name || safe;
  }
  if (!content && !file_url)
    return NextResponse.json({ error: "Add some text or choose a file." }, { status: 400 });

  const rows = await dbJson("fs_syllabus", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category,
      title,
      content: content || null,
      file_url: file_url || null,
      file_name: file_name || null,
      user_id: user.id,
      author_email: user.email,
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function DELETE(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = String(body?.id || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(id))
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const rows = await dbJson(`fs_syllabus?id=eq.${id}&select=*`);
  const row = rows && rows[0];
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isAdmin(profile, user) && row.user_id !== user.id)
    return NextResponse.json({ error: "You can only delete your own uploads." }, { status: 403 });
  const r = await db(`fs_syllabus?id=eq.${id}`, { method: "DELETE" });
  if (!r.ok) return NextResponse.json({ error: "Could not delete." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
