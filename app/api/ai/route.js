import { NextResponse } from "next/server";
import { requireUser, isAdmin, dbJson } from "../../../lib/supabase";

// Free use of the house Gemini key: a per-user daily question limit,
// resetting at midnight IST. The limit VALUE is set by the admin from
// the app's Admin Dashboard (POST /api/admin/ai-limit writes an
// 'ai_limit' row; the latest one wins; default 10) — it is NOT fixed in
// code. Usage is counted from fs_events rows of type 'ai_question'
// (written below on every successful answer), so there is no extra
// table to keep in sync. Users with their own Gemini key call Google
// directly from the app and never touch this limit.
const DEFAULT_DAILY_LIMIT = 10;
let _limitCache = { value: DEFAULT_DAILY_LIMIT, at: 0 };

async function aiDailyLimit() {
  const now = Date.now();
  if (now - _limitCache.at < 60000) return _limitCache.value;
  let value = DEFAULT_DAILY_LIMIT;
  try {
    const rows = await dbJson(
      "fs_events?type=eq.ai_limit&select=formula_name,created_at&order=created_at.desc&limit=1"
    );
    const n = parseInt(rows?.[0]?.formula_name, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 1000) value = n;
  } catch {
    // keep the default when the setting cannot be read
  }
  _limitCache = { value, at: now };
  return value;
}

function istDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((x) => x.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}T00:00:00+05:30`;
}

async function todaysAiCount(userId) {
  const since = new Date(istDayStartIso()).toISOString();
  const rows = await dbJson(
    `fs_events?user_id=eq.${userId}&type=eq.ai_question&created_at=gte.${since}&select=id&limit=60`
  );
  return (rows || []).length;
}

async function logAiQuestion(user) {
  await dbJson("fs_events", {
    method: "POST",
    body: JSON.stringify({
      type: "ai_question",
      user_id: user.id,
      user_email: user.email,
      path: "/ai-tutor",
    }),
  });
}

export async function GET(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Please log in to use the AI Tutor." },
      { status: 401 }
    );
  const admin = isAdmin(profile, user);
  const limit = await aiDailyLimit();
  const used = admin ? 0 : await todaysAiCount(user.id);
  return NextResponse.json({
    limit,
    used,
    remaining: admin ? null : Math.max(0, limit - used),
    unlimited: admin,
  });
}

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";
export const maxDuration = 60;

// Same Gemini lineup as the photo scan: fast lite model first, then the
// stronger flash model as fallback.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
const TIMEOUTS = [30000, 35000];

async function callGemini(model, key, payload, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      }
    );
    const d = await r.json().catch(() => null);
    return { r, d };
  } finally {
    clearTimeout(t);
  }
}

const SYSTEM = `You are a friendly maths tutor for a first-year engineering student (Maths-I level: matrices, differential and integral calculus, ordinary differential equations, complex numbers, plus school basics like algebra, trigonometry, indices and logarithms).
Rules for every answer:
- Use simple, clear English. Explain step by step, like a good teacher.
- When solving, show each step briefly and give the final answer clearly at the end.
- Write formulas in FormulaText markup so the app can render them nicely: fraction \\frac{num}{den}; power x^{2} (always braces); subscript a_{n}; root \\sqrt{...}; commands \\pi \\theta \\alpha \\beta \\lambda \\Delta \\int \\sum \\partial \\infty \\pm \\leq \\geq \\neq \\approx \\to \\times \\cdot; functions as plain words (sin, cos, tan, log, ln, lim, det); matrix as MAT(a, b; c, d).
- Plain text only: no markdown headings, no **bold**, no code fences. Short lines and numbered steps are welcome.
- Keep the answer under 350 words unless the question truly needs more.
- If the question is not about maths, politely say you only help with maths.`;

export async function POST(req) {
  const { user, profile } = await requireUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Please log in to use the AI Tutor." },
      { status: 401 }
    );
  const admin = isAdmin(profile, user);
  const limit = await aiDailyLimit();
  let usedBefore = 0;
  if (!admin) {
    usedBefore = await todaysAiCount(user.id);
    if (usedBefore >= limit)
      return NextResponse.json(
        {
          error:
            `You have used all ${limit} of today's free AI questions. They reset at midnight (IST). To keep asking now, add your own free Gemini API key — the AI Tutor page has a key button with the steps.`,
          limit_reached: true,
          limit,
          used: usedBefore,
          remaining: 0,
        },
        { status: 429 }
      );
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "AI is not set up on the server yet." },
      { status: 503 }
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const question = String(body?.question || "").trim().slice(0, 1200);
  const context = String(body?.context || "").trim().slice(0, 2500);
  if (question.length < 2)
    return NextResponse.json(
      { error: "Please type a maths question." },
      { status: 400 }
    );

  const userText = context
    ? `The student is viewing this formula in the app:\n${context}\n\nStudent's question: ${question}`
    : `Student's question: ${question}`;

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
  };

  const attempts = [];
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const { r, d } = await callGemini(model, key, payload, TIMEOUTS[i]);
      if (!r.ok) {
        attempts.push(
          `${model}: HTTP ${r.status} ${d?.error?.message || ""}`.slice(0, 180)
        );
        continue;
      }
      const text = (d?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (!text) {
        attempts.push(`${model}: empty reply`);
        continue;
      }
      if (!admin) await logAiQuestion(user);
      return NextResponse.json({
        ok: true,
        answer: text.slice(0, 8000),
        usage: admin
          ? { unlimited: true }
          : {
              limit,
              used: usedBefore + 1,
              remaining: Math.max(0, limit - usedBefore - 1),
            },
      });
    } catch (e) {
      attempts.push(
        `${model}: ${e && e.name === "AbortError" ? "timeout" : "fetch error"}`
      );
    }
  }
  return NextResponse.json(
    { error: "The AI Tutor is busy right now — please try again in a moment. (" + attempts.join(" | ").slice(0, 300) + ")" },
    { status: 502 }
  );
}
