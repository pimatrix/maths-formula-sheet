// Server-side Supabase REST helpers (no SDK — plain fetch).
export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email) {
  return Boolean(email) && ADMIN_EMAILS.includes(String(email).toLowerCase());
}

function svcHeaders(extra = {}) {
  return {
    apikey: SB_SERVICE,
    Authorization: `Bearer ${SB_SERVICE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Generic PostgREST call with the service key (server only).
export async function db(path, options = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: svcHeaders(options.headers || {}),
    cache: "no-store",
  });
  return r;
}

export async function dbJson(path, options = {}) {
  const r = await db(path, options);
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

// Verify a user's access token; returns the Supabase auth user or null.
export async function getUserFromToken(token) {
  if (!token || !SB_URL || !SB_ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Upsert the profile row for a user and resolve their role.
export async function getProfile(user) {
  if (!user) return null;
  const adminByEmail = isAdminEmail(user.email);
  const rows = await dbJson(`profiles?id=eq.${user.id}&select=*`);
  let profile = rows && rows[0];
  if (!profile) {
    const created = await dbJson("profiles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        role: adminByEmail ? "admin" : "user",
      }),
    });
    profile = created && created[0];
  } else if (adminByEmail && profile.role !== "admin") {
    await db(`profiles?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    });
    profile = { ...profile, role: "admin" };
  }
  if (!profile) {
    profile = { id: user.id, email: user.email, role: adminByEmail ? "admin" : "user" };
  }
  return profile;
}

export async function requireUser(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const user = await getUserFromToken(token);
  if (!user) return { user: null, profile: null };
  const profile = await getProfile(user);
  return { user, profile };
}

export function isAdmin(profile, user) {
  return Boolean(profile && profile.role === "admin") || isAdminEmail(user?.email);
}
