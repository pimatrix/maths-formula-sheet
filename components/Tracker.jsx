"use client";

import { useEffect } from "react";
import { track } from "../lib/client";

export default function Tracker({ category = "" }) {
  useEffect(() => {
    const start = Date.now();
    track("pageview", { category });
    function sendEnd() {
      const secs = Math.round((Date.now() - start) / 1000);
      if (secs >= 3) track("view_end", { category, duration_sec: secs });
    }
    window.addEventListener("beforeunload", sendEnd);
    return () => {
      window.removeEventListener("beforeunload", sendEnd);
      sendEnd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
