/**
 * Small, forgiving unit handling so "2 cups milk" can be checked against
 * "1 l milk" in the fridge. Units in the same family convert; anything else
 * only matches the exact same unit word.
 */

type Family = "mass" | "volume" | "count" | `other:${string}`;

const UNIT_TABLE: Record<string, { family: Family; factor: number }> = {
  // mass, base = gram
  g: { family: "mass", factor: 1 },
  gram: { family: "mass", factor: 1 },
  kg: { family: "mass", factor: 1000 },
  kilogram: { family: "mass", factor: 1000 },
  oz: { family: "mass", factor: 28.3495 },
  ounce: { family: "mass", factor: 28.3495 },
  lb: { family: "mass", factor: 453.592 },
  pound: { family: "mass", factor: 453.592 },
  // volume, base = millilitre
  ml: { family: "volume", factor: 1 },
  milliliter: { family: "volume", factor: 1 },
  millilitre: { family: "volume", factor: 1 },
  l: { family: "volume", factor: 1000 },
  liter: { family: "volume", factor: 1000 },
  litre: { family: "volume", factor: 1000 },
  tsp: { family: "volume", factor: 4.929 },
  teaspoon: { family: "volume", factor: 4.929 },
  tbsp: { family: "volume", factor: 14.787 },
  tablespoon: { family: "volume", factor: 14.787 },
  cup: { family: "volume", factor: 240 },
  "fl oz": { family: "volume", factor: 29.574 },
  pint: { family: "volume", factor: 473.176 },
  quart: { family: "volume", factor: 946.353 },
  gallon: { family: "volume", factor: 3785.41 },
  // count, base = 1
  "": { family: "count", factor: 1 },
  pc: { family: "count", factor: 1 },
  piece: { family: "count", factor: 1 },
  each: { family: "count", factor: 1 },
  whole: { family: "count", factor: 1 },
  x: { family: "count", factor: 1 },
  dozen: { family: "count", factor: 12 },
};

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("ches") || word.endsWith("shes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (u in UNIT_TABLE) return u;
  if (u === "lbs") return "lb";
  if (u === "pcs") return "pc";
  const s = singular(u);
  return s;
}

/** Lowercase, trimmed, singular — "Tomatoes " and "tomato" match. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w, i, arr) => (i === arr.length - 1 ? singular(w) : w))
    .join(" ");
}

function lookup(unit: string) {
  const u = normalizeUnit(unit);
  return UNIT_TABLE[u] ?? { family: `other:${u}` as Family, factor: 1 };
}

export function unitFamily(unit: string): Family {
  return lookup(unit).family;
}

/** Convert an amount between units. Returns null if the units don't mix. */
export function convert(amount: number, from: string, to: string): number | null {
  const a = lookup(from);
  const b = lookup(to);
  if (a.family !== b.family) return null;
  return (amount * a.factor) / b.factor;
}

export function formatQty(q: number): string {
  if (!isFinite(q)) return "?";
  const r = Math.round(q * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatAmount(q: number, unit: string): string {
  return unit ? `${formatQty(q)} ${unit}` : formatQty(q);
}

/** Round up to 2 decimals, ignoring float noise (300.0000001 → 300). */
export function roundUpQty(q: number): number {
  return Math.ceil(q * 100 - 1e-6) / 100;
}
