import { read } from "@/lib/store";
import { claudeError, claudeFor } from "@/lib/claude";
import { claudeKey, handle, HttpError, requireMember } from "@/lib/server";
import { analyzeRecipeNutrition, saveNutrition } from "@/lib/nutrition";
import { nutritionBasis } from "@/lib/nutrition-shared";
import type { Recipe } from "@/lib/types";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** "Analyze now": re-estimate this recipe's nutrition with Claude, even if the current estimate is fresh. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const recipe = (await read<Recipe[]>("recipes", [])).find((r) => r.id === id);
  if (!recipe) throw new HttpError(404, "Recipe not found.");

  // Key check, rate limit, and this person's daily Claude allowance.
  const { settings } = await claudeFor(me);
  const basis = nutritionBasis(recipe);
  try {
    const facts = await analyzeRecipeNutrition(recipe, settings, claudeKey(settings).key);
    const { recipe: saved } = await saveNutrition(id, facts, basis);
    if (!saved) throw new HttpError(404, "Recipe not found.");
    // If someone edited the ingredients meanwhile, this returns their version (its estimate will show as stale).
    return { recipe: saved };
  } catch (err) {
    claudeError(err);
  }
});
