import { NextResponse } from "next/server";
import { requireUser, isAdmin, db, dbJson } from "../../../lib/supabase";
import { getAllCategories, getAllEntries, getAllSyllabus } from "../../../lib/data";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";
export const maxDuration = 60;

// When a formula is added with the detail fields (about / symbols / example)
// left empty, the AI fills them once, at add time — so no entry is ever
// left without its explanation. Best-effort: any failure just saves the
// entry as submitted.
async function autofillDetails(v) {
  if (v.about && v.symbols && v.example) return;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;
  const prompt = `A student added this entry to a maths formula sheet.
Name: ${v.name}
${v.kind === "theory" ? "Theory text" : "Formula"} (FormulaText markup): ${v.formula}
Topic/section: ${v.section || "(general)"}

Reply with ONLY a JSON object (no markdown fences) with these string fields:
- "about": 1-2 simple sentences — what this is used for / what it means.
- "symbols": the meaning of each symbol, one per line as "x = meaning" (empty string if there are no symbols worth explaining).
- "example": one short, fully solved numeric example showing it in use.
Write formulas inside these fields in FormulaText markup (\\frac{a}{b}, x^{2}, \\sqrt{...}, \\pi). Simple English.
IMPORTANT: valid JSON — escape every backslash as \\\\ (write \\\\frac, \\\\sqrt).`;
  const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
  for (const model of models) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              maxOutputTokens: 900,
            },
          }),
          signal: ctrl.signal,
        }
      ).finally(() => clearTimeout(t));
      if (!r.ok) continue;
      const d = await r.json().catch(() => null);
      const text = (d?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      if (!text) continue;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      if (!v.about && parsed.about) v.about = String(parsed.about).slice(0, 2000);
      if (!v.symbols && parsed.symbols) v.symbols = String(parsed.symbols).slice(0, 2000);
      if (!v.example && parsed.example) v.example = String(parsed.example).slice(0, 4000);
      return;
    } catch {
      // try the next model
    }
  }
}

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
  const about = String(body?.about || "").trim();
  const symbols = String(body?.symbols || "").trim();
  const example = String(body?.example || "").trim();
  return { name, formula, section, kind, about, symbols, example, category: String(body?.category || "") };
}

function validate(v, categories) {
  if (!categories.some((c) => c.slug === v.category))
    return "Please choose a valid category.";
  if (!v.name || !v.formula) return "Name and formula/theory text are both required.";
  if (v.name.length > 200 || v.formula.length > 6000 || v.section.length > 120)
    return "Input is too long.";
  if (v.about.length > 2000 || v.symbols.length > 2000 || v.example.length > 4000)
    return "Detail fields are too long.";
  return null;
}

function entryFromRow(row) {
  return {
    id: "u" + row.id,
    rowId: row.id,
    category: row.category,
    section: row.section || "",
    name: row.name,
    body: row.body,
    kind: row.kind,
    about: row.about || "",
    symbols: row.symbols || "",
    example: row.example || "",
    userAdded: true,
    user_id: row.user_id,
    author_name: row.author_name || "",
    author_email: row.author_email || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
  await autofillDetails(v).catch(() => {});
  const rows = await dbJson("fs_formulas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category: v.category,
      section: v.section,
      name: v.name,
      body: v.formula,
      kind: v.kind,
      about: v.about || null,
      symbols: v.symbols || null,
      example: v.example || null,
      user_id: user.id,
      author_name: user.user_metadata?.name || "",
      author_email: user.email,
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true, entry: entryFromRow(rows[0]) });
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
      about: v.about || null,
      symbols: v.symbols || null,
      example: v.example || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!rows || !rows[0])
    return NextResponse.json({ error: "Could not update. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true, entry: entryFromRow(rows[0]) });
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
