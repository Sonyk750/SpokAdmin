// Normalizează numele unui articol de factură pentru cheia de memorie a distribuirii
// (lowercase, fără diacritice românești, spații colapsate).
const DIACRITICE: Record<string, string> = {
  "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t",
};

export function articolKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, c => DIACRITICE[c] ?? c)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
