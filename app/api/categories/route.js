import { NextResponse } from "next/server";
import { requireUser, isAdmin, db, dbJson } from "../../../lib/supabase";
import { getAllCategories } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ categories: await getAllCategories() });
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "category";
}

export async function POST(req) {
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login to add a category." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const title = String(body?.title || "").trim();
  const grp = String(body?.grp || "").trim();
  if (!title || title.length > 80 || grp.length > 40)
    return NextResponse.json({ error: "Please give a valid category name." }, { status: 400 });
  const existing = await getAllCategories();
  let slug = slugify(title);
  if (existing.some((c) => c.slug === slug)) {
    slug = slug + "-" + Math.random().toString(36).slice(2, 6);
  }
  const rows = await dbJson("fs_categories", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ slug, title, grp, created_by: user.id, author_email: user.email }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not create the category." }, { status: 502 });
  const row = rows[0];
  return NextResponse.json({
    ok: true,
    category: { slug: row.slug, title: row.title, group: row.grp || "More", custom: true, id: row.id },
  });
}

export async function DELETE(req) {
  const { user, profile } = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please login first." }, { status: 401 });
  if (!isAdmin(profile, user))
    return NextResponse.json({ error: "Only an admin can delete a category." }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = String(body?.id || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(id))
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  const r = await db(`fs_categories?id=eq.${id}`, { method: "DELETE" });
  if (!r.ok) return NextResponse.json({ error: "Could not delete." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
