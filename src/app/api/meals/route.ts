import { read, update } from "@/lib/store";
import { body, handle, HttpError, isoDate, newId, nowIso, num, requireMember, str } from "@/lib/server";
import type { Meal, Recipe } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const date = isoDate(b.date);
  const slot = str(b.slot, 40);
  if (!slot) throw new HttpError(400, "Pick a meal slot.");
  const recipeId = str(b.recipeId, 60) || null;
  let title = str(b.title, 120);
  let servings = Math.max(1, Math.round(num(b.servings, 0)));
  if (recipeId) {
    const recipe = (await read<Recipe[]>("recipes", [])).find((r) => r.id === recipeId);
    if (!recipe) throw new HttpError(404, "Recipe not found.");
    title = recipe.name;
    if (!num(b.servings, 0)) servings = recipe.servings;
  }
  if (!title) throw new HttpError(400, "Pick a recipe or type what you're eating.");

  const meal: Meal = {
    id: newId(),
    date,
    slot,
    recipeId,
    title,
    servings,
    status: "planned",
    proposedBy: me.id,
    agreedBy: [me.id], // proposing counts as agreeing
    cookId: str(b.cookId, 60) || null,
    notes: str(b.notes, 500),
    createdAt: nowIso(),
  };
  await update<Meal[]>("meals", [], (ms) => ({ data: [...ms, meal] }));
  return { meal };
});
