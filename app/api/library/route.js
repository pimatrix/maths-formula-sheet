import { NextResponse } from "next/server";
import { requireUser, SB_URL, SB_SERVICE } from "../../../lib/supabase";

// Personal library (favourites + custom folders) for a signed-in user.
// Stored in the user's auth metadata — the same place as the analytics
// opt-out — so it follows the account to every device, needs no extra
// table, and disappears with the account when the user deletes it.
// The client keeps a local cache for instant paint and guest use;
// guests never reach this route (401) and stay device-local.

export const dynamic = "force-dynamic";

const EMPTY = { favorites: [], folders: [], solutions: [] };
const MAX_JSON = 300000;

function cleanLib(v) {
  if (!v || typeof v !== "object") return null;
  const rawFavs = Array.isArray(v.favorites) ? v.favorites : [];
  const favorites = [
    ...new Set(
      rawFavs.filter(
        (x) => typeof x === "string" && x.length > 0 && x.length <= 80,
      ),
    ),
  ].slice(0, 500);
  const folders = [];
  if (Array.isArray(v.folders)) {
    for (const f of v.folders.slice(0, 30)) {
      if (!f || typeof f !== "object") continue;
      const name = String(f.name || "").trim().slice(0, 60);
      if (!name) continue;
      const id = String(f.id || "").slice(0, 40) || `f${folders.length}`;
      const rawItems = Array.isArray(f.items) ? f.items : [];
      const items = [
        ...new Set(
          rawItems.filter(
            (x) => typeof x === "string" && x.length > 0 && x.length <= 80,
          ),
        ),
      ].slice(0, 300);
      folders.push({ id, name, items });
    }
  }
  const solutions = [];
  if (Array.isArray(v.solutions)) {
    for (const sol of v.solutions.slice(0, 50)) {
      if (!sol || typeof sol !== "object") continue;
      const q = String(sol.q || "").trim().slice(0, 1200);
      const a = String(sol.a || "").trim().slice(0, 4000);
      if (!q || !a) continue;
      solutions.push({
        id: String(sol.id || "").slice(0, 40) || `s${solutions.length}`,
        q,
        a,
        at: String(sol.at || "").slice(0, 40),
      });
    }
  }
  const out = { favorites, folders, solutions };
  if (JSON.stringify(out).length > MAX_JSON) return null;
  return out;
}

export async function GET(req) {
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    library: cleanLib(user.user_metadata?.library) || EMPTY,
  });
}

export async function PUT(req) {
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const data = cleanLib(body?.library ?? body);
  if (!data)
    return NextResponse.json(
      { error: "Invalid library data." },
      { status: 400 },
    );
  const meta = { ...(user.user_metadata || {}), library: data };
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_metadata: meta }),
  });
  if (!r.ok)
    return NextResponse.json(
      { error: "Could not save your library." },
      { status: 502 },
    );
  return NextResponse.json({ ok: true, library: data });
}
