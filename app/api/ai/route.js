import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/supabase";

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
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Please log in to use the AI Tutor." },
      { status: 401 }
    );
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
      return NextResponse.json({ ok: true, answer: text.slice(0, 8000) });
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
