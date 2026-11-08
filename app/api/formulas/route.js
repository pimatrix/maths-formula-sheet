import { NextResponse } from "next/server";
import { requireUser, isAdmin, db, dbJson } from "../../../lib/supabase";
import { getAllCategories, getAllEntries, getAllSyllabus } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, entries, syllabus] = await Promise.all([
    getAllCategories(),
    getAllEntries(),
    getAllSyllabus(),
  ]);
  return NextResponse.json({ categories, entries, syllabus });
}

function clean(body) {
  const name = String(body?.name || "").trim();
  const formula = String(body?.formula ?? body?.body ?? "").trim();
  const section = String(body?.section || "").trim();
  const kind = body?.kind === "theory" ? "theory" : "formula";
  return { name, formula, section, kind, category: String(body?.category || "") };
}

function validate(v, categories) {
  if (!categories.some((c) => c.slug === v.category))
    return "Please choose a valid category.";
  if (!v.name || !v.formula) return "Name and formula/theory text are both required.";
  if (v.name.length > 200 || v.formula.length > 6000 || v.section.length > 120)
    return "Input is too long.";
  return null;
}

export async function POST(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login to add a formula." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const categories = await getAllCategories();
  const v = clean(body);
  const err = validate(v, categories);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const rows = await dbJson("fs_formulas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category: v.category,
      section: v.section,
      name: v.name,
      body: v.formula,
      kind: v.kind,
      user_id: user.id,
      author_name: user.user_metadata?.name || "",
      author_email: user.email,
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  const row = rows[0];
  return NextResponse.json({
    ok: true,
    entry: {
      id: "u" + row.id,
      rowId: row.id,
      category: row.category,
      section: row.section || "",
      name: row.name,
      body: row.body,
      kind: row.kind,
      userAdded: true,
      user_id: row.user_id,
      author_name: row.author_name || "",
      author_email: row.author_email || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
}

async function loadOwnedRow(req, rowId) {
  const { user, profile } = await requireUser(req);
  if (!user) return { error: NextResponse.json({ error: "Please login first." }, { status: 401 }) };
  const rows = await dbJson(`fs_formulas?id=eq.${encodeURIComponent(rowId)}&select=*`);
  const row = rows && rows[0];
  if (!row) return { error: NextResponse.json({ error: "Entry not found." }, { status: 404 }) };
  const admin = isAdmin(profile, user);
  if (!admin && row.user_id !== user.id)
    return {
      error: NextResponse.json(
        { error: "You can only change entries that you added yourself." },
        { status: 403 }
      ),
    };
  return { user, profile, row, admin };
}

function rowIdFrom(id) {
  const raw = String(id || "").replace(/^u/, "");
  return /^[0-9a-fA-F-]{36}$/.test(raw) ? raw : null;
}

export async function PUT(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const rowId = rowIdFrom(body?.id);
  if (!rowId) return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  const owned = await loadOwnedRow(req, rowId);
  if (owned.error) return owned.error;
  const categories = await getAllCategories();
  const v = clean(body);
  const err = validate(v, categories);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const rows = await dbJson(`fs_formulas?id=eq.${rowId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category: v.category,
      section: v.section,
      name: v.name,
      body: v.formula,
      kind: v.kind,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not update. Please try again." }, { status: 502 });
  const row = rows[0];
  return NextResponse.json({
    ok: true,
    entry: {
      id: "u" + row.id,
      rowId: row.id,
      category: row.category,
      section: row.section || "",
      name: row.name,
      body: row.body,
      kind: row.kind,
      userAdded: true,
      user_id: row.user_id,
      author_name: row.author_name || "",
      author_email: row.author_email || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
}

export async function DELETE(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const rowId = rowIdFrom(body?.id);
  if (!rowId) return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  const owned = await loadOwnedRow(req, rowId);
  if (owned.error) return owned.error;
  const r = await db(`fs_formulas?id=eq.${rowId}`, { method: "DELETE" });
  if (!r.ok)
    return NextResponse.json({ error: "Could not delete. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
