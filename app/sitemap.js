import seed from "../lib/formulas-seed.json";

const BASE = "https://yashx.xyz/math-formula-sheet-m1";

export default function sitemap() {
  const now = new Date();
  const urls = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/add`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
  for (const c of seed.categories) {
    urls.push({
      url: `${BASE}/c/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }
  return urls;
}
