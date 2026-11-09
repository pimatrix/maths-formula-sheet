export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";
export const maxDuration = 60;

// Streams the latest MathMitra APK from the GitHub release through this
// origin, so the download page (same origin) can show real download
// progress in the browser. If this route is unavailable, the page falls
// back to the direct GitHub link.
const APK_URL =
  "https://github.com/pimatrix/maths-formula-flutter/releases/download/apk-latest/app-release.apk";

export async function GET() {
  let up;
  try {
    up = await fetch(APK_URL, { redirect: "follow" });
  } catch {
    return new Response("Download unavailable.", { status: 502 });
  }
  if (!up.ok || !up.body)
    return new Response("Download unavailable.", { status: 502 });
  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.android.package-archive");
  const len = up.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", 'attachment; filename="MathMitra.apk"');
  headers.set("Cache-Control", "no-store");
  return new Response(up.body, { status: 200, headers });
}
