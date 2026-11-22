import { after } from "next/server";
import { update } from "@/lib/store";
import { body, cleanRecipe, handle, newId, nowIso, requireMember } from "@/lib/server";
import { analyzeAndSave } from "@/lib/nutrition";
import { inDemo } from "@/lib/demo-context";
import { needsNutrition } from "@/lib/nutrition-shared";
import type { Recipe } from "@/lib/types";

// Leaves time for the nutrition analysis that runs after the response is sent.
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const fields = cleanRecipe(await body(req));
  const recipe: Recipe = { id: newId(), ...fields, createdBy: me.id, createdAt: nowIso(), updatedAt: nowIso() };
  await update<Recipe[]>("recipes", [], (rs) => ({ data: [...rs, recipe] }));
  // Estimate calories in the background; the recipe is saved either way.
  if (needsNutrition(recipe) && !inDemo()) after(() => analyzeAndSave(recipe.id));
  return { recipe };
});
