import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { read, update } from "./store";
import { claudeKey, cleanNutritionFacts, getSettings, HttpError, nowIso } from "./server";
import { needsNutrition, nutritionBasis } from "./nutrition-shared";
import type { NutritionFacts, Recipe, Settings } from "./types";

/**
 * Server-side calorie/macro estimates by Claude.
 *
 * Automatic analyses (after a recipe is saved, or the admin backfill) share a
 * household-wide daily cap so editing recipes can't run up the bill.
 * Manual "Analyze now" goes through claudeFor() and counts against that
 * person's own allowance instead.
 */

const HOUSEHOLD_DAILY_LIMIT = Math.max(0, parseInt(process.env.NUTRITION_DAILY_LIMIT ?? "60", 10) || 60);

const NutritionSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const SYSTEM = `You are a nutrition estimator for a home-cooking app.
Estimate the nutrition of ONE serving of the recipe from its ingredient list and serving count, using standard nutrition data (e.g. USDA values for raw ingredients).
- Divide the whole recipe's totals by the number of servings.
- Count only the ingredients listed. Assume cooking oil, butter or salt only if they are listed.
- If a quantity has no unit, treat it as a count of typical medium-sized items. If a quantity is 0 or missing, assume a typical small amount for that ingredient.
- kcal: per-serving calories, rounded to the nearest 5.
- protein, carbs, fat: per-serving grams, rounded to whole numbers.
Return realistic values.`;

export type AnalyzeStatus = "saved" | "skipped" | "no-key" | "limit" | "error";

/** One Claude call: per-serving nutrition for this recipe. Throws on refusal, unreadable or unrealistic answers. */
export async function analyzeRecipeNutrition(
  recipe: Pick<Recipe, "name" | "servings" | "ingredients">,
  settings: Settings,
  key: string,
): Promise<NutritionFacts> {
  const client = new Anthropic({ apiKey: key });
  const ingredients = recipe.ingredients.length
    ? recipe.ingredients.map((i) => `- ${[i.quantity || "", i.unit, i.name].filter(Boolean).join(" ")}`).join("\n")
    : "(no ingredients listed)";
  const userText = `Recipe: ${recipe.name}\nServings: ${recipe.servings}\nIngredients (for the whole recipe):\n${ingredients}\n\nEstimate the nutrition per serving.`;

  const response = await client.beta.messages.parse({
    model: settings.claudeModel || "claude-opus-5-5",
    // If a safety classifier declines, the API retries on a suitable fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(NutritionSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });
  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "Claude declined to estimate this recipe's nutrition.");
  }
  if (!response.parsed_output) {
    throw new HttpError(502, "Claude's nutrition estimate couldn't be read. Try again.");
  }
  const facts = cleanNutritionFacts(response.parsed_output);
  if (!facts) throw new HttpError(502, "Claude's nutrition estimate looked unrealistic. Try again.");
  return facts;
}

type HouseholdUsage = { day: string; count: number };

/** Count one automatic analysis against today's household allowance. False when it's used up. */
async function takeHouseholdAllowance(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  return update<HouseholdUsage, boolean>("nutritionUsage", { day: today, count: 0 }, (u) => {
    const used = u.day === today ? u.count : 0;
    if (used >= HOUSEHOLD_DAILY_LIMIT) return { data: u, result: false };
    return { data: { day: today, count: used + 1 }, result: true };
  });
}

/**
 * Store an estimate made for `basis`, but only if the recipe still has that
 * basis (it may have been edited while Claude was thinking).
 * Returns the recipe as stored, and whether it was updated.
 */
export async function saveNutrition(
  recipeId: string,
  facts: NutritionFacts,
  basis: string,
): Promise<{ recipe: Recipe | null; saved: boolean }> {
  return update<Recipe[], { recipe: Recipe | null; saved: boolean }>("recipes", [], (rs) => {
    const cur = rs.find((r) => r.id === recipeId);
    if (!cur) return { data: rs, result: { recipe: null, saved: false } };
    if (nutritionBasis(cur) !== basis) return { data: rs, result: { recipe: cur, saved: false } };
    const next: Recipe = { ...cur, nutrition: { ...facts, source: "claude", basis, analyzedAt: nowIso() } };
    return { data: rs.map((r) => (r.id === recipeId ? next : r)), result: { recipe: next, saved: true } };
  });
}

/**
 * Automatic analysis (runs after a save, or from the admin backfill).
 * Never throws: failures are logged and reported as a status.
 */
export async function analyzeAndSave(recipeId: string): Promise<AnalyzeStatus> {
  try {
    const settings = await getSettings();
    const { key } = claudeKey(settings);
    if (!key) return "no-key";

    const recipe = (await read<Recipe[]>("recipes", [])).find((r) => r.id === recipeId);
    if (!recipe || !needsNutrition(recipe)) return "skipped";

    if (!(await takeHouseholdAllowance())) {
      console.warn(`Nutrition: household daily limit (${HOUSEHOLD_DAILY_LIMIT}) reached; skipping ${recipeId}.`);
      return "limit";
    }

    const basis = nutritionBasis(recipe);
    const facts = await analyzeRecipeNutrition(recipe, settings, key);
    const { saved } = await saveNutrition(recipeId, facts, basis);
    return saved ? "saved" : "skipped";
  } catch (err) {
    console.error(`Nutrition analysis failed for recipe ${recipeId}:`, err);
    return "error";
  }
}
