import { read, update } from "@/lib/store";
import { addToFridge, consumeFromFridge, mealIngredients } from "@/lib/inventory";
import { getSettings, handle, HttpError, newId, nowIso, requireMember } from "@/lib/server";
import type { FridgeItem, Ingredient, Meal, Recipe } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Mark a meal cooked: its ingredients come out of the fridge. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const [meals, recipes, settings] = await Promise.all([
    read<Meal[]>("meals", []),
    read<Recipe[]>("recipes", []),
    getSettings(),
  ]);
  const meal = meals.find((m) => m.id === id);
  if (!meal) throw new HttpError(404, "Meal not found.");
  if (meal.status === "cooked") throw new HttpError(409, "Already marked as cooked.");

  // Claim the meal first so a double-click can't subtract twice.
  await update<Meal[]>("meals", [], (ms) => {
    const cur = ms.find((m) => m.id === id);
    if (!cur) throw new HttpError(404, "Meal not found.");
    if (cur.status === "cooked") throw new HttpError(409, "Already marked as cooked.");
    return {
      data: ms.map((m) =>
        m.id === id ? { ...m, status: "cooked" as const, cookedAt: nowIso(), cookedBy: me.id } : m,
      ),
    };
  });

  const needs = mealIngredients(meal, recipes);
  const { consumed, missing } = await update<FridgeItem[], { consumed: Ingredient[]; missing: Ingredient[] }>(
    "fridge",
    [],
    (f) => {
      const r = consumeFromFridge(f, needs, settings.staples, me.id);
      return { data: r.fridge, result: { consumed: r.consumed, missing: r.missing } };
    },
  );

  const updated = await update<Meal[], Meal>("meals", [], (ms) => {
    const next = ms.map((m) => (m.id === id ? { ...m, consumed, missingAtCook: missing } : m));
    return { data: next, result: next.find((m) => m.id === id)! };
  });
  return { meal: updated, missing };
});

/** Undo "cooked": put what was taken back into the fridge. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const meal = await update<Meal[], Meal>("meals", [], (ms) => {
    const cur = ms.find((m) => m.id === id);
    if (!cur) throw new HttpError(404, "Meal not found.");
    if (cur.status !== "cooked") throw new HttpError(409, "This meal isn't marked as cooked.");
    const next: Meal = { ...cur, status: "planned" };
    delete next.cookedAt;
    delete next.cookedBy;
    delete next.consumed;
    delete next.missingAtCook;
    return { data: ms.map((m) => (m.id === id ? next : m)), result: cur };
  });
  if (meal.consumed?.length) {
    await update<FridgeItem[]>("fridge", [], (f) => ({
      data: addToFridge(f, meal.consumed!, me.id, newId),
    }));
  }
  return { ok: true };
});
