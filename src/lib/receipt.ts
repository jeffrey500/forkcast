import type { Ingredient, ShoppingItem } from "./types";
import { convert, normalizeName, unitFamily } from "./units";

/**
 * Receipt logic shared by both scan options:
 *  - parseReceiptText: turn raw OCR text into item lines (Quick scan only).
 *  - suggestStocking: match items to the shopping list and to ingredient names
 *    the household already uses, so the fridge stays consistent (both scans).
 */

export interface ScannedItem extends Ingredient {
  /** The receipt text this came from, shown for reference. */
  raw: string;
  /** Where Claude suggests keeping it (Claude scan only). */
  storage?: "fridge" | "freezer" | "pantry";
}

// Lines that are never groceries.
const SKIP =
  /\b(SUB\s*TOTAL|TOTAL|TAX|BALANCE|CHANGE|CASH|VISA|MASTERCARD|AMEX|DEBIT|CREDIT|CARD|TEND|PAYMENT|SAVINGS|SAVED|DISCOUNT|COUPON|REWARD|POINTS|MEMBER|THANK|RECEIPT|STORE|CASHIER|REG\b|TRANS|APPROVED|AUTH|ITEMS SOLD|BAG FEE|DEPOSIT|CRV|VOID|REFUND)\b/i;

const PRICE_AT_END = /(-?\$?\d+[.,]\d{2})\s*[A-Z*]{0,2}\s*$/i;
// OCR often reads "lb" as "1b"/"ib" and "oz" as "0z".
const WEIGHT = /(\d+(?:[.,]\d+)?)\s*(LBS?|[1I]BS?|KG|[O0]Z)\b/i;
const COUNT = /(?:^|\s)(\d{1,2})\s*(?:@|X)\s*\$?\d/i;

/** Common grocery-receipt abbreviations. */
const ABBREV: Record<string, string> = {
  CHKN: "chicken", CHK: "chicken", CKN: "chicken", BRST: "breast", BRS: "breast", THGH: "thigh", THG: "thigh",
  BNLS: "boneless", SKNLS: "skinless", GRND: "ground", GRD: "ground", TRKY: "turkey", TKY: "turkey", BF: "beef",
  SLMN: "salmon", SHRMP: "shrimp", TOM: "tomato", TOMS: "tomato", TMTO: "tomato", POT: "potato", POTS: "potato",
  SWT: "sweet", ONN: "onion", ONI: "onion", GRLC: "garlic", BROC: "broccoli", BRCL: "broccoli", SPNCH: "spinach",
  SPIN: "spinach", LTTC: "lettuce", LET: "lettuce", CUC: "cucumber", CUCMBR: "cucumber", AVOC: "avocado", AVO: "avocado",
  BNNA: "banana", BAN: "banana", APL: "apple", LMN: "lemon", PEPR: "pepper", PPR: "pepper", PEP: "pepper",
  GRN: "green", RD: "red", YLW: "yellow", BNS: "beans", BN: "bean", BLK: "black", MLK: "milk", CHS: "cheese",
  CHED: "cheddar", MOZZ: "mozzarella", PARM: "parmesan", YGRT: "yogurt", YOG: "yogurt", GRK: "greek", BTR: "butter",
  BRD: "bread", WHT: "wheat", WW: "whole wheat", TORT: "tortilla", TRTLA: "tortilla", SPAG: "spaghetti", PSTA: "pasta",
  RCE: "rice", QUIN: "quinoa", EGG: "egg", EGGS: "egg", DZ: "", LG: "", MED: "", SM: "", ORG: "", ORGANIC: "",
  FRZN: "frozen", FRZ: "frozen", CHKPEA: "chickpeas", GARB: "chickpeas", CNTRO: "cilantro", CIL: "cilantro",
  ZUCC: "zucchini", ZUCH: "zucchini", MSHRM: "mushroom", MUSH: "mushroom", CRT: "carrot", CARR: "carrot",
};

function cleanName(s: string): string {
  return s
    .replace(PRICE_AT_END, " ")
    .replace(WEIGHT, " ")
    .replace(/@.*$/, " ") // "@ 3.99 /lb" unit-price tails
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase();
      return up in ABBREV ? ABBREV[up] : w.toLowerCase();
    })
    .filter((w) => w && w.length > 1)
    .join(" ")
    .trim();
}

function weightOf(line: string): Pick<Ingredient, "quantity" | "unit"> | null {
  const m = line.match(WEIGHT);
  if (!m) return null;
  const u = m[2].toLowerCase();
  const unit = /^[l1i]b/.test(u) ? "lb" : u === "kg" ? "kg" : "oz";
  return { quantity: parseFloat(m[1].replace(",", ".")), unit };
}

/** Rule-based parsing of OCR text from a grocery receipt. */
export function parseReceiptText(text: string): ScannedItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3);

  const items: ScannedItem[] = [];
  let pendingName: { name: string; raw: string } | null = null;

  for (const line of lines) {
    if (SKIP.test(line)) {
      pendingName = null;
      continue;
    }
    const hasPrice = PRICE_AT_END.test(line);
    const name = cleanName(line);
    const weight = weightOf(line);
    const count = line.match(COUNT);

    if (!hasPrice) {
      // A name on its own line; its weight/price may follow on the next line.
      pendingName = name.length >= 3 ? { name, raw: line } : null;
      continue;
    }
    if (name.length >= 3) {
      items.push({
        name,
        quantity: weight?.quantity ?? (count ? parseInt(count[1], 10) : 1),
        unit: weight?.unit ?? "",
        raw: line,
      });
      pendingName = null;
    } else if (pendingName) {
      // e.g. "BANANAS" then "2.10 lb @ 0.59 /lb 1.24"
      items.push({
        name: pendingName.name,
        quantity: weight?.quantity ?? (count ? parseInt(count[1], 10) : 1),
        unit: weight?.unit ?? "",
        raw: `${pendingName.raw} ${line}`,
      });
      pendingName = null;
    }
  }

  // Same thing scanned twice ("2 x" printed as two lines): merge.
  const merged: ScannedItem[] = [];
  for (const it of items) {
    const same = merged.find((m) => normalizeName(m.name) === normalizeName(it.name) && convert(1, it.unit, m.unit) !== null);
    if (same) same.quantity += convert(it.quantity, it.unit, same.unit) ?? 0;
    else merged.push({ ...it });
  }
  return merged;
}

// ---- matching --------------------------------------------------------------

function bigrams(s: string): string[] {
  const t = ` ${s} `;
  return Array.from({ length: t.length - 1 }, (_, i) => t.slice(i, i + 2));
}

/** 0..1 similarity between two ingredient names. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // "boneless skinless chicken thigh" contains every word of "chicken thigh"
  const xw = new Set(x.split(" "));
  const yw = y.split(" ");
  if (yw.length > 0 && yw.every((w) => xw.has(w))) return 0.92;
  const xb = bigrams(x);
  const yb = bigrams(y);
  const pool = [...yb];
  let hits = 0;
  for (const g of xb) {
    const k = pool.indexOf(g);
    if (k !== -1) {
      hits++;
      pool.splice(k, 1);
    }
  }
  return (2 * hits) / (xb.length + yb.length);
}

export interface Suggestion extends ScannedItem {
  include: boolean;
  /** The receipt gave a count, but the household tracks this in e.g. "kg". */
  checkUnit?: string;
  /** What the logic matched this item to. */
  match:
    | { kind: "shopping"; shoppingId: string; label: string }
    | { kind: "known"; label: string }
    | { kind: "new" };
}

const MATCH_AT = 0.72;

// Household items that end up on grocery receipts but don't go in the fridge.
const NON_FOOD =
  /\b(paper|towel|tissue|napkin|toilet|detergent|soap|shampoo|conditioner|toothpaste|floss|foil|wrap|bag|bags|trash|battery|batteries|bleach|cleaner|sponge|candle|lotion|deodorant|razor|diaper|wipes|pet|litter)\b/i;

/**
 * Decide how each receipt item should be stocked:
 *  1. It's on the shopping list → use that name (and unit if the receipt had none),
 *     and tick that item off when added.
 *  2. It's an ingredient the household already uses → use the household's name.
 *  3. Otherwise → add as a new item.
 */
export function suggestStocking(items: ScannedItem[], shopping: ShoppingItem[], known: Ingredient[]): Suggestion[] {
  const usedShopping = new Set<string>();
  return items.map((it) => {
    let best: ShoppingItem | null = null;
    let bestScore = 0;
    for (const s of shopping) {
      if (usedShopping.has(s.id)) continue;
      const score = similarity(it.name, s.name);
      if (score > bestScore) {
        best = s;
        bestScore = score;
      }
    }
    if (best && bestScore >= MATCH_AT) {
      usedShopping.add(best.id);
      const receiptHadAmount = it.unit !== "" || it.quantity !== 1;
      const unitsMix = convert(1, it.unit, best.unit) !== null;
      return {
        ...it,
        name: best.name,
        ...(receiptHadAmount && unitsMix ? {} : { quantity: best.quantity, unit: best.unit }),
        include: true,
        match: { kind: "shopping", shoppingId: best.id, label: `${best.quantity} ${best.unit} ${best.name}`.replace(/\s+/g, " ") },
      };
    }

    let best2: Ingredient | null = null;
    let knownScore = 0;
    for (const k of known) {
      const score = similarity(it.name, k.name);
      if (score > knownScore) {
        best2 = k;
        knownScore = score;
      }
    }
    if (best2 && knownScore >= MATCH_AT) {
      // A plain count on the receipt ("2 black beans") takes the household's usual
      // unit ("can") so it merges with what's already in the fridge.
      const adoptUnit = it.unit === "" && unitFamily(best2.unit).startsWith("other:");
      // A plain count for something the household tracks by weight/volume needs a human check.
      const check = it.unit === "" && !adoptUnit && convert(1, "", best2.unit) === null ? best2.unit : undefined;
      return {
        ...it,
        name: best2.name,
        ...(adoptUnit ? { unit: best2.unit } : {}),
        include: true,
        match: { kind: "known", label: best2.name },
        ...(check ? { checkUnit: check } : {}),
      };
    }
    // Probably not food: leave it unticked so it isn't added by accident.
    return { ...it, include: !NON_FOOD.test(it.name), match: { kind: "new" } };
  });
}
