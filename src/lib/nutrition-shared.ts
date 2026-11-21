import type { Meal, Nutrition, Recipe } from "./types";
import { normalizeName, normalizeUnit } from "./units";

/**
 * Client-safe nutrition helpers (used by the server and the browser).
 * Calorie numbers are per serving and always estimates.
 */

/** Fingerprint of what a nutrition estimate was based on; changes when ingredients or servings change. */
export function nutritionBasis(r: Pick<Recipe, "servings" | "ingredients">): string {
  const parts = r.ingredients
    .map((i) => `${normalizeName(i.name)}:${Math.round(i.quantity * 1000) / 1000}:${normalizeUnit(i.unit)}`)
    .sort();
  return `${r.servings}|${parts.join(",")}`;
}

/** True when the recipe has no estimate, or the estimate was made for different ingredients/servings. */
export function needsNutrition(r: Recipe): boolean {
  return !r.nutrition || r.nutrition.basis !== nutritionBasis(r);
}

/** The recipe's per-serving estimate, if it's current. */
export function currentNutrition(r: Recipe | undefined): Nutrition | null {
  if (!r?.nutrition || r.nutrition.basis !== nutritionBasis(r)) return null;
  return r.nutrition;
}

/** Per-serving kcal for a planned meal (null for free-form meals or recipes without an estimate). */
export function mealKcal(meal: Meal, recipes: Recipe[] | Map<string, Recipe>): number | null {
  if (!meal.recipeId) return null;
  const r = Array.isArray(recipes) ? recipes.find((x) => x.id === meal.recipeId) : recipes.get(meal.recipeId);
  return currentNutrition(r)?.kcal ?? null;
}

/**
 * Rough per-person total for one day: one serving of each non-skipped meal that has an estimate.
 * `known` counts meals with an estimate, `unknown` meals without (so the UI can say "+ 1 meal not estimated").
 */
export function dayKcalPerPerson(meals: Meal[], recipes: Recipe[]): { kcal: number; known: number; unknown: number } {
  const map = new Map(recipes.map((r) => [r.id, r]));
  let kcal = 0;
  let known = 0;
  let unknown = 0;
  for (const m of meals) {
    if (m.status === "skipped") continue;
    const k = mealKcal(m, map);
    if (k === null) unknown++;
    else {
      kcal += k;
      known++;
    }
  }
  return { kcal: Math.round(kcal), known, unknown };
}

/** "~520 kcal" */
export function formatKcal(kcal: number): string {
  return `~${Math.round(kcal).toLocaleString()} kcal`;
}
