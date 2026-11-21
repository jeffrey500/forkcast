import { after } from "next/server";
import { read, update } from "@/lib/store";
import { body, cleanRecipe, handle, HttpError, nowIso, requireMember } from "@/lib/server";
import { analyzeAndSave } from "@/lib/nutrition";
import { needsNutrition } from "@/lib/nutrition-shared";
import type { Meal, Recipe } from "@/lib/types";

// Leaves time for the nutrition analysis that runs after the response is sent.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  const fields = cleanRecipe(await body(req));
  const recipe = await update<Recipe[], Recipe>("recipes", [], (rs) => {
    const cur = rs.find((r) => r.id === id);
    if (!cur) throw new HttpError(404, "Recipe not found.");
    // Without a new estimate from the client, the existing one is kept (it shows as stale if the ingredients changed).
    const next: Recipe = { ...cur, ...fields, updatedAt: nowIso() };
    return { data: rs.map((r) => (r.id === id ? next : r)), result: next };
  });
  // Keep planned meal titles in sync with the recipe name.
  await update<Meal[]>("meals", [], (ms) => ({
    data: ms.map((m) => (m.recipeId === id && m.status === "planned" ? { ...m, title: recipe.name } : m)),
  }));
  // Re-estimate calories in the background if the ingredients or servings changed.
  if (needsNutrition(recipe)) after(() => analyzeAndSave(recipe.id));
  return { recipe };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  const meals = (await read<Meal[]>("meals", [])).filter(
    (m) => m.recipeId === id && m.status === "planned",
  ).length;
  if (meals > 0) {
    throw new HttpError(409, `This recipe is on the plan ${meals} time(s). Remove those meals first.`);
  }
  await update<Recipe[]>("recipes", [], (rs) => ({ data: rs.filter((r) => r.id !== id) }));
  return { ok: true };
});
