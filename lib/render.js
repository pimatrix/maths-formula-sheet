// "FormulaText" — the raw-text markup that AI tools return and this site renders
// book-style. Supported: \frac{a}{b}, \sqrt{...}, x^{...}, a_{...}, Greek commands
// (\pi \theta \alpha ...), \int \sum \partial \infty \pm \mp \leq \geq \neq \to
// \times \cdot \div \approx \in \notin \subset \cup \cap \forall \exists \angle
// \degree, MAT(a, b; c, d) for matrices, and plain Unicode symbols as-is.

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", Gamma: "Γ", delta: "δ", Delta: "Δ",
  epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", Theta: "Θ", iota: "ι",
  kappa: "κ", lambda: "λ", Lambda: "Λ", mu: "μ", nu: "ν", xi: "ξ",
  pi: "π", Pi: "Π", rho: "ρ", sigma: "σ", Sigma: "Σ", tau: "τ",
  phi: "φ", Phi: "Φ", chi: "χ", psi: "ψ", omega: "ω", Omega: "Ω",
  int: "∫", oint: "∮", sum: "∑", prod: "∏", infty: "∞", partial: "∂",
  pm: "±", mp: "∓", leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡",
  to: "→", rightarrow: "→", leftarrow: "←", times: "×", cdot: "·", div: "÷",
  in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", forall: "∀",
  exists: "∃", angle: "∠", degree: "°", prime: "′", nabla: "∇",
  sin: "sin", cos: "cos", tan: "tan", cot: "cot", sec: "sec", cosec: "cosec",
  sinh: "sinh", cosh: "cosh", tanh: "tanh", log: "log", ln: "ln", lim: "lim",
  det: "det", adj: "adj", mod: "mod", arg: "arg", max: "max", min: "min",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Read a balanced {...} group starting at index i (s[i] must be '{').
// Returns {inner, next} or null.
function readGroup(s, i) {
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return { inner: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return null;
}

export function formulaTextToHtml(input) {
  const s = String(input || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        const cmd = m[1];
        let j = i + m[0].length;
        if (cmd === "frac") {
          const a = readGroup(s, j);
          const b = a && readGroup(s, a.next);
          if (a && b) {
            out += `<span class="frac"><span class="t">${formulaTextToHtml(a.inner)}</span><span class="b">${formulaTextToHtml(b.inner)}</span></span>`;
            i = b.next;
            continue;
          }
        }
        if (cmd === "sqrt") {
          const a = readGroup(s, j);
          if (a) {
            out += `√<span class="sqrt">${formulaTextToHtml(a.inner)}</span>`;
            i = a.next;
            continue;
          }
        }
        if (GREEK[cmd] !== undefined) {
          out += escapeHtml(GREEK[cmd]);
          i = j;
          continue;
        }
        // Unknown command: print the word itself.
        out += escapeHtml(cmd);
        i = j;
        continue;
      }
      out += escapeHtml(ch);
      i++;
      continue;
    }
    if (ch === "^" || ch === "_") {
      const tag = ch === "^" ? "sup" : "sub";
      if (s[i + 1] === "{") {
        const g = readGroup(s, i + 1);
        if (g) {
          out += `<${tag}>${formulaTextToHtml(g.inner)}</${tag}>`;
          i = g.next;
          continue;
        }
      }
      if (i + 1 < s.length) {
        out += `<${tag}>${escapeHtml(s[i + 1])}</${tag}>`;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (s.startsWith("MAT(", i) || s.startsWith("MAT (", i)) {
      const open = s.indexOf("(", i);
      const close = s.indexOf(")", open);
      if (close > open) {
        const inner = s.slice(open + 1, close);
        const rows = inner
          .split(";")
          .map((row) =>
            row
              .split(",")
              .map((c) => formulaTextToHtml(c.trim()))
              .join(" &nbsp; ")
          )
          .join("<br/>");
        out += `<span class="mat">${rows}</span>`;
        i = close + 1;
        continue;
      }
    }
    if (ch === "\n") {
      out += "<br/>";
      i++;
      continue;
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

// The ready-made prompt users copy (one click) and give to any AI.
export const AI_FORMULA_PROMPT = `Convert the maths formula I give you into FormulaText markup. Reply with ONLY the converted markup — no explanation, no code block, no extra words.

FORMULATEXT RULES:
1. Fraction: \\frac{numerator}{denominator}  — example: \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}
2. Power: x^{2}, e^{x}, 10^{-3}  (always use braces)
3. Subscript: a_{n}, C_{1}, T_{n}  (always use braces)
4. Square root: \\sqrt{...} ; nth root: \\sqrt[n]{...} is NOT supported — write it as (... )^{1/n}
5. Symbols as commands: \\pi \\theta \\alpha \\beta \\lambda \\Delta \\int \\oint \\sum \\partial \\infty \\pm \\leq \\geq \\neq \\approx \\to \\times \\cdot \\div \\in \\angle \\degree
6. Functions stay as plain words: sin, cos, tan, log, ln, lim, det
7. Matrix: MAT(a, b; c, d) — entries separated by commas, rows separated by semicolons
8. If there are several formulas, put each on its own line.
9. Keep Greek letters as commands (\\theta), NOT as Unicode characters.

THE FORMULA IS: `;
