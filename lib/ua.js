// Tiny user-agent parser: browser, OS, device type, model (when the UA reveals it).
export function parseUA(ua = "") {
  const s = String(ua);
  let browser = "Unknown";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/Chromium/.test(s)) browser = "Chromium";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s)) browser = "Safari";

  let os = "Unknown";
  let model = "";
  let device = "Desktop";
  if (/Android/.test(s)) {
    os = "Android";
    device = /Mobile/.test(s) ? "Mobile" : "Tablet";
    const m = /Android [^;]+; ([^;)]+)/.exec(s);
    if (m) model = m[1].replace(/\s?Build\/.*$/, "").trim();
    const v = /Android ([\d.]+)/.exec(s);
    if (v) os = `Android ${v[1]}`;
  } else if (/iPhone/.test(s)) {
    os = "iOS";
    model = "iPhone";
    device = "Mobile";
    const v = /OS ([\d_]+)/.exec(s);
    if (v) os = `iOS ${v[1].replace(/_/g, ".")}`;
  } else if (/iPad/.test(s)) {
    os = "iOS";
    model = "iPad";
    device = "Tablet";
  } else if (/Windows NT/.test(s)) {
    os = "Windows";
  } else if (/Mac OS X/.test(s)) {
    os = "macOS";
  } else if (/Linux/.test(s)) {
    os = "Linux";
  }
  if (/Mobile|Android.*Mobile|iPhone/.test(s) && device === "Desktop") device = "Mobile";
  return { browser, os, device, model };
}
