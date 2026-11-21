import { read, update } from "@/lib/store";
import { body, cleanRecipe, handle, HttpError, nowIso, requireMember } from "@/lib/server";
import type { Meal, Recipe } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  const fields = cleanRecipe(await body(req));
  const recipe = await update<Recipe[], Recipe>("recipes", [], (rs) => {
    const cur = rs.find((r) => r.id === id);
    if (!cur) throw new HttpError(404, "Recipe not found.");
    const next = { ...cur, ...fields, updatedAt: nowIso() };
    return { data: rs.map((r) => (r.id === id ? next : r)), result: next };
  });
  // Keep planned meal titles in sync with the recipe name.
  await update<Meal[]>("meals", [], (ms) => ({
    data: ms.map((m) => (m.recipeId === id && m.status === "planned" ? { ...m, title: recipe.name } : m)),
  }));
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
