import seed from "./formulas-seed.json";
import { SB_URL, SB_SERVICE } from "./supabase";

export const SEED_CATEGORIES = seed.categories;

// Cached read for server-rendered pages (ISR): fresh data is served by the
// dynamic /api/formulas route and picked up by the client refresh.
async function dbCached(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
      next: { revalidate: 30 },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function getAllCategories() {
  const rows = (await dbCached("fs_categories?select=*&order=created_at.asc")) || [];
  const extra = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    group: r.grp || "More",
    custom: true,
    id: r.id,
    author_email: r.author_email,
    created_at: r.created_at,
  }));
  return [...seed.categories, ...extra];
}

export async function getAllEntries() {
  const rows =
    (await dbCached("fs_formulas?select=*&order=created_at.asc")) || [];
  const added = rows.map((row) => ({
    id: "u" + row.id,
    rowId: row.id,
    category: row.category,
    section: row.section || "",
    name: row.name,
    body: row.body,
    kind: row.kind || "formula",
    userAdded: true,
    user_id: row.user_id,
    author_name: row.author_name || "",
    author_email: row.author_email || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  return [...seed.entries, ...added];
}

export async function getAllSyllabus() {
  const rows =
    (await dbCached("fs_syllabus?select=*&order=created_at.desc")) || [];
  return rows.map((row) => ({
    id: row.id,
    category: row.category || "",
    title: row.title,
    content: row.content || "",
    file_url: row.file_url || "",
    file_name: row.file_name || "",
    user_id: row.user_id,
    author_email: row.author_email || "",
    created_at: row.created_at,
  }));
}
