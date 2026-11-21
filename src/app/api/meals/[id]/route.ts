import { read, update } from "@/lib/store";
import { body, handle, HttpError, isoDate, num, requireMember, str } from "@/lib/server";
import type { Meal, Recipe } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Move / edit a meal. Changing the recipe resets agreement. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const b = await body(req);
  const recipes = await read<Recipe[]>("recipes", []);
  const meal = await update<Meal[], Meal>("meals", [], (ms) => {
    const cur = ms.find((m) => m.id === id);
    if (!cur) throw new HttpError(404, "Meal not found.");
    const next: Meal = { ...cur };
    if (b.date !== undefined) next.date = isoDate(b.date);
    if (b.slot !== undefined) next.slot = str(b.slot, 40) || cur.slot;
    if (b.servings !== undefined) next.servings = Math.max(1, Math.round(num(b.servings, cur.servings)));
    if (b.notes !== undefined) next.notes = str(b.notes, 500);
    if (b.cookId !== undefined) next.cookId = str(b.cookId, 60) || null;
    if (b.status === "skipped" || (b.status === "planned" && cur.status === "skipped")) {
      next.status = b.status;
    }
    if (b.recipeId !== undefined || b.title !== undefined) {
      const recipeId = str(b.recipeId, 60) || null;
      if (recipeId) {
        const r = recipes.find((x) => x.id === recipeId);
        if (!r) throw new HttpError(404, "Recipe not found.");
        next.title = r.name;
      } else {
        next.title = str(b.title, 120) || cur.title;
      }
      if (recipeId !== cur.recipeId || next.title !== cur.title) {
        next.recipeId = recipeId;
        next.agreedBy = [me.id];
      }
    }
    return { data: ms.map((m) => (m.id === id ? next : m)), result: next };
  });
  return { meal };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  await update<Meal[]>("meals", [], (ms) => {
    const cur = ms.find((m) => m.id === id);
    if (cur?.status === "cooked") throw new HttpError(409, "Undo 'cooked' first so the fridge is restored.");
    return { data: ms.filter((m) => m.id !== id) };
  });
  return { ok: true };
});
