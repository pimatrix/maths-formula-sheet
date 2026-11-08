import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";
export const maxDuration = 60;

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
const TIMEOUTS = [25000, 30000];

const LATEX_CMDS = new Set([
  "frac", "sqrt", "alpha", "beta", "gamma", "Gamma", "delta", "Delta",
  "epsilon", "zeta", "eta", "theta", "Theta", "iota", "kappa", "lambda",
  "Lambda", "mu", "nu", "xi", "pi", "Pi", "rho", "sigma", "Sigma", "tau",
  "phi", "Phi", "chi", "psi", "omega", "Omega", "int", "oint", "sum",
  "prod", "infty", "partial", "pm", "mp", "leq", "geq", "neq", "approx",
  "equiv", "to", "rightarrow", "leftarrow", "times", "cdot", "div", "in",
  "notin", "subset", "cup", "cap", "forall", "exists", "angle", "degree",
  "prime", "nabla", "sin", "cos", "tan", "cot", "sec", "cosec", "sinh",
  "cosh", "tanh", "log", "ln", "lim", "det", "adj", "mod", "arg", "max",
  "min",
]);

// Models often emit LaTeX inside JSON strings without escaping the
// backslashes, which breaks JSON.parse. Walk the text and double any
// backslash that starts a known LaTeX command, then parse.
function parseAiJson(text) {
  try {
    return JSON.parse(text);
  } catch {}
  let out = "";
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inStr) {
      out += ch;
      if (ch === '"') inStr = true;
      continue;
    }
    if (ch === '"') {
      inStr = false;
      out += ch;
      continue;
    }
    if (ch === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(text.slice(i));
      if (m && LATEX_CMDS.has(m[1])) {
        out += "\\\\" + m[1];
        i += m[0].length - 1;
        continue;
      }
      out += ch;
      if (i + 1 < text.length) {
        out += text[i + 1];
        i++;
      }
      continue;
    }
    out += ch;
  }
  return JSON.parse(out);
}

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

const PROMPT = `You are reading a photo of a maths formula (from a textbook or a notebook). Extract the formula and explain it for a student.
Reply with ONLY a JSON object (no markdown fences, no extra text) with these string fields:
- "name": a short clear name for the formula, e.g. "Quadratic Formula" or "d/dx (sin x)".
- "formula": the formula converted to FormulaText markup. Rules: fraction \\frac{num}{den}; power x^{2} (always use braces); subscript a_{n}; root \\sqrt{...}; symbol commands \\pi \\theta \\alpha \\beta \\lambda \\Delta \\int \\oint \\sum \\partial \\infty \\pm \\leq \\geq \\neq \\approx \\to \\times \\cdot; functions stay as plain words (sin, cos, tan, log, ln, lim, det); matrix as MAT(a, b; c, d). Keep Greek letters as commands, NOT as Unicode characters.
- "section": the topic it belongs to, e.g. "Quadratic Equations" or "Integration".
- "about": 1-2 simple sentences — what this formula is used for.
- "symbols": the meaning of each symbol, one per line, in the format "x = meaning".
- "example": one short, fully solved numeric example showing how the formula is used.
If the image contains no maths formula, reply with {"error": "No formula found in this photo."}.
IMPORTANT: the reply must be valid JSON — escape every backslash as \\\\ (write \\\\frac, \\\\sqrt, \\\\pm and so on).
Use simple English.`;

export async function POST(req) {
  const { user } = await requireUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Photo scan ke liye pehle login karo." },
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
  const image = String(body?.image || "");
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m)
    return NextResponse.json(
      { error: "Please choose a photo (JPG or PNG)." },
      { status: 400 }
    );
  if (m[2].length > 7000000)
    return NextResponse.json(
      { error: "Photo is too large. Please use a smaller, clearer photo." },
      { status: 413 }
    );

  const payload = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: m[1], data: m[2] } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 1500,
    },
  };

  const attempts = [];
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const { r, d } = await callGemini(model, key, payload, TIMEOUTS[i] || 20000);
      if (!r.ok) {
        attempts.push(
          `${model}: HTTP ${r.status} ${d?.error?.message || ""}`.slice(0, 180)
        );
        continue;
      }
      const text = (d?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      if (!text) {
        attempts.push(
          `${model}: empty (finish=${d?.candidates?.[0]?.finishReason || "?"}, block=${d?.promptFeedback?.blockReason || "-"})`
        );
        continue;
      }
      let parsed;
      try {
        parsed = parseAiJson(text);
      } catch {
        attempts.push(`${model}: bad JSON "${text.slice(0, 60)}"`);
        continue;
      }
      if (parsed.error)
        return NextResponse.json({ error: String(parsed.error) }, { status: 422 });
      return NextResponse.json({
        ok: true,
        name: String(parsed.name || "").slice(0, 200),
        formula: String(parsed.formula || "").slice(0, 6000),
        section: String(parsed.section || "").slice(0, 120),
        about: String(parsed.about || "").slice(0, 2000),
        symbols: String(parsed.symbols || "").slice(0, 2000),
        example: String(parsed.example || "").slice(0, 4000),
      });
    } catch (e) {
      attempts.push(
        `${model}: ${e && e.name === "AbortError" ? "timeout" : "fetch error"}`
      );
    }
  }
  return NextResponse.json(
    { error: "AI scan failed — " + attempts.join(" | ").slice(0, 600) },
    { status: 502 }
  );
}
