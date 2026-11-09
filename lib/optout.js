// Shared analytics opt-out cache.
// The /api/track route checks this before storing an event; the
// /api/me route writes the fresh value the moment a user toggles
// opt-out, so the change takes effect immediately instead of after
// the cache TTL. The TTL is only a backstop for other instances.
const cache = new Map();
const TTL_MS = 10000;

export function getOptOut(userId) {
  const h = cache.get(userId);
  if (h && Date.now() - h.at < TTL_MS) return h.out;
  return undefined;
}

export function setOptOut(userId, out) {
  cache.set(userId, { at: Date.now(), out });
}
