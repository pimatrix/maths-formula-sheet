import seedDetails from "./formula-details.json";

// Returns { about, symbols, example } for an entry, or null when no
// handcrafted detail exists yet.
export function detailsFor(entry) {
  if (!entry) return null;
  if (entry.userAdded) {
    const d = {
      about: entry.about || "",
      symbols: entry.symbols || "",
      example: entry.example || "",
    };
    return d.about || d.symbols || d.example ? d : null;
  }
  return seedDetails[entry.id] || null;
}
