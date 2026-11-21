import type { FridgeItem, Ingredient, Meal, Recipe, Settings, ShoppingItem } from "./types";
import { convert, normalizeName, titleCase, unitFamily } from "./units";

/** Ingredients a meal needs, scaled from the recipe's servings to the meal's. */
export function mealIngredients(meal: Meal, recipes: Map<string, Recipe> | Recipe[]): Ingredient[] {
  if (!meal.recipeId) return [];
  const recipe = Array.isArray(recipes)
    ? recipes.find((r) => r.id === meal.recipeId)
    : recipes.get(meal.recipeId);
  if (!recipe) return [];
  const scale = recipe.servings > 0 ? meal.servings / recipe.servings : 1;
  return recipe.ingredients.map((i) => ({ ...i, quantity: i.quantity * scale }));
}

export function isStaple(name: string, staples: string[]): boolean {
  const n = normalizeName(name);
  return staples.some((s) => normalizeName(s) === n);
}

/** Running stock keyed by ingredient name + unit family. */
class Stock {
  private items = new Map<string, { amount: number; unit: string }>();

  private key(name: string, unit: string) {
    return `${normalizeName(name)}|${unitFamily(unit)}`;
  }

  add(name: string, qty: number, unit: string) {
    const k = this.key(name, unit);
    const cur = this.items.get(k);
    if (!cur) {
      this.items.set(k, { amount: qty, unit });
    } else {
      cur.amount += convert(qty, unit, cur.unit) ?? 0;
    }
  }

  /** Take `qty` and return how much of it was NOT available (in the asked unit). */
  take(name: string, qty: number, unit: string): number {
    const k = this.key(name, unit);
    const cur = this.items.get(k);
    if (!cur) return qty;
    const want = convert(qty, unit, cur.unit) ?? qty;
    const have = Math.max(cur.amount, 0);
    cur.amount -= want;
    const missing = Math.max(want - have, 0);
    return convert(missing, cur.unit, unit) ?? missing;
  }

  has(name: string, unit: string) {
    return this.items.has(this.key(name, unit));
  }
}

export type MealReadiness = "ok" | "after-shopping" | "short" | "no-recipe" | "done";

export interface MealForecast {
  meal: Meal;
  readiness: MealReadiness;
  /** What's still missing even after planned shopping trips. */
  missing: Ingredient[];
  /** Covered only because something is on the shopping list before this day. */
  coveredByShopping: Ingredient[];
}

export interface Shortfall {
  name: string;
  quantity: number;
  unit: string;
  /** Earliest meal date that needs it */
  neededBy: string;
  meals: string[];
}

const EPS = 1e-6;

/**
 * Walk every planned meal in date order, drawing ingredients from the fridge
 * (and from shopping trips planned on or before that day), and report which
 * meals can actually be made.
 */
export function forecast(opts: {
  meals: Meal[];
  recipes: Recipe[];
  fridge: FridgeItem[];
  shopping: ShoppingItem[];
  settings: Pick<Settings, "mealSlots" | "staples">;
  today: string;
}): { byMeal: Map<string, MealForecast>; shortfalls: Shortfall[] } {
  const { meals, recipes, fridge, shopping, settings, today } = opts;
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const slotIndex = (s: string) => {
    const i = settings.mealSlots.indexOf(s);
    return i === -1 ? settings.mealSlots.length : i;
  };

  const fridgeOnly = new Stock();
  const withShopping = new Stock();
  for (const f of fridge) {
    fridgeOnly.add(f.name, f.quantity, f.unit);
    withShopping.add(f.name, f.quantity, f.unit);
  }

  // Shopping with no date counts as "today"; past dates also land today.
  const trips = shopping
    .map((s) => ({ ...s, day: s.plannedDate && s.plannedDate > today ? s.plannedDate : today }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const upcoming = meals
    .filter((m) => m.status === "planned")
    .map((m) => ({ m, day: m.date < today ? today : m.date }))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.m.date.localeCompare(b.m.date) ||
        slotIndex(a.m.slot) - slotIndex(b.m.slot) ||
        a.m.createdAt.localeCompare(b.m.createdAt),
    );

  const byMeal = new Map<string, MealForecast>();
  const shortMap = new Map<string, Shortfall>();
  let tripIdx = 0;

  for (const { m, day } of upcoming) {
    while (tripIdx < trips.length && trips[tripIdx].day <= day) {
      const t = trips[tripIdx++];
      withShopping.add(t.name, t.quantity, t.unit);
    }
    const recipe = m.recipeId ? recipeMap.get(m.recipeId) : undefined;
    if (!recipe) {
      byMeal.set(m.id, { meal: m, readiness: "no-recipe", missing: [], coveredByShopping: [] });
      continue;
    }
    const missing: Ingredient[] = [];
    const covered: Ingredient[] = [];
    for (const ing of mealIngredients(m, recipeMap)) {
      if (ing.quantity <= 0 || isStaple(ing.name, settings.staples)) continue;
      const lackFridge = fridgeOnly.take(ing.name, ing.quantity, ing.unit);
      const lackAll = withShopping.take(ing.name, ing.quantity, ing.unit);
      if (lackAll > EPS) {
        missing.push({ ...ing, quantity: lackAll });
        const k = `${normalizeName(ing.name)}|${unitFamily(ing.unit)}`;
        const s = shortMap.get(k);
        if (s) {
          s.quantity += convert(lackAll, ing.unit, s.unit) ?? lackAll;
          if (!s.meals.includes(m.title)) s.meals.push(m.title);
        } else {
          shortMap.set(k, {
            name: ing.name,
            quantity: lackAll,
            unit: ing.unit,
            neededBy: m.date < today ? today : m.date,
            meals: [m.title],
          });
        }
      }
      if (lackFridge > EPS && lackFridge - lackAll > EPS) {
        covered.push({ ...ing, quantity: lackFridge - lackAll });
      }
    }
    byMeal.set(m.id, {
      meal: m,
      readiness: missing.length ? "short" : covered.length ? "after-shopping" : "ok",
      missing,
      coveredByShopping: covered,
    });
  }

  for (const m of meals) {
    if (m.status !== "planned" && !byMeal.has(m.id)) {
      byMeal.set(m.id, { meal: m, readiness: "done", missing: [], coveredByShopping: [] });
    }
  }

  const shortfalls = [...shortMap.values()].sort((a, b) => a.neededBy.localeCompare(b.neededBy));
  return { byMeal, shortfalls };
}

/**
 * Remove a cooked meal's ingredients from the fridge. Returns the new fridge,
 * what was actually removed (for undo), and what wasn't there.
 */
export function consumeFromFridge(
  fridge: FridgeItem[],
  needs: Ingredient[],
  staples: string[],
  by: string,
): { fridge: FridgeItem[]; consumed: Ingredient[]; missing: Ingredient[] } {
  const next = fridge.map((f) => ({ ...f }));
  const consumed: Ingredient[] = [];
  const missing: Ingredient[] = [];
  const now = new Date().toISOString();

  for (const need of needs) {
    if (need.quantity <= 0 || isStaple(need.name, staples)) continue;
    let remaining = need.quantity; // in need.unit
    const matches = next.filter(
      (f) =>
        normalizeName(f.name) === normalizeName(need.name) &&
        convert(1, need.unit, f.unit) !== null &&
        f.quantity > 0,
    );
    for (const f of matches) {
      if (remaining <= EPS) break;
      const wantInF = convert(remaining, need.unit, f.unit)!;
      const takeInF = Math.min(wantInF, f.quantity);
      f.quantity -= takeInF;
      f.updatedAt = now;
      f.updatedBy = by;
      consumed.push({ name: f.name, quantity: takeInF, unit: f.unit });
      remaining -= convert(takeInF, f.unit, need.unit)!;
    }
    if (remaining > EPS) missing.push({ ...need, quantity: remaining });
  }

  return {
    fridge: next.filter((f) => f.quantity > EPS),
    consumed,
    missing,
  };
}

/** Add ingredients into the fridge, merging with matching items. */
export function addToFridge(
  fridge: FridgeItem[],
  items: Ingredient[],
  by: string,
  newId: () => string,
): FridgeItem[] {
  const next = fridge.map((f) => ({ ...f }));
  const now = new Date().toISOString();
  for (const it of items) {
    if (!(it.quantity > 0)) continue;
    const match = next.find(
      (f) => normalizeName(f.name) === normalizeName(it.name) && convert(1, it.unit, f.unit) !== null,
    );
    if (match) {
      match.quantity += convert(it.quantity, it.unit, match.unit)!;
      match.updatedAt = now;
      match.updatedBy = by;
    } else {
      next.push({
        id: newId(),
        name: titleCase(it.name),
        quantity: it.quantity,
        unit: it.unit.trim(),
        updatedAt: now,
        updatedBy: by,
      });
    }
  }
  return next;
}

export function requiredAgreements(rule: Settings["agreementRule"], members: number): number {
  if (members <= 0) return 1;
  if (rule === "any") return 1;
  if (rule === "all") return members;
  return Math.floor(members / 2) + 1;
}

/**
 * Meals from the week before `targetStart` that can be copied into the target
 * week: same weekday and slot, only where that slot is still empty, skipping
 * meals that were skipped last time.
 */
export function repeatCandidates(meals: Meal[], targetStart: string, addDays: (iso: string, n: number) => string) {
  const prevStart = addDays(targetStart, -7);
  const prevEnd = addDays(targetStart, -1);
  const filled = new Set(
    meals
      .filter((m) => m.date >= targetStart && m.date <= addDays(targetStart, 6))
      .map((m) => `${m.date}|${m.slot}`),
  );
  const out: { from: Meal; date: string }[] = [];
  for (const m of meals) {
    if (m.date < prevStart || m.date > prevEnd || m.status === "skipped") continue;
    const date = addDays(m.date, 7);
    if (filled.has(`${date}|${m.slot}`)) continue;
    out.push({ from: m, date });
  }
  return out;
}
