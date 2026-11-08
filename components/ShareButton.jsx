"use client";

import { track } from "../lib/client";

export default function ShareButton({ name, category, text }) {
  async function share() {
    const url = window.location.href;
    track("share", { formula_name: name, category });
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: text || name, url });
        return;
      }
      throw new Error("no native share");
    } catch {
      try {
        await navigator.clipboard.writeText(`${name} — ${url}`);
        alert("Link copied — you can share it anywhere.");
      } catch {}
    }
  }
  return (
    <button className="fs-share-btn" onClick={share} type="button">
      Share
    </button>
  );
}
