import { read, update } from "@/lib/store";
import { addDays } from "@/lib/dates";
import { repeatCandidates } from "@/lib/inventory";
import { body, handle, isoDate, newId, nowIso, requireMember } from "@/lib/server";
import type { Meal, Recipe } from "@/lib/types";

/** Fill a week's empty slots with what was eaten the same day/slot the week before. */
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const weekStart = isoDate(b.weekStart);
  const recipeIds = new Set((await read<Recipe[]>("recipes", [])).map((r) => r.id));

  const added = await update<Meal[], number>("meals", [], (meals) => {
    // Re-checked inside the write so two people clicking at once can't double-fill.
    const copies: Meal[] = repeatCandidates(meals, weekStart, addDays).map(({ from, date }) => ({
      id: newId(),
      date,
      slot: from.slot,
      recipeId: from.recipeId && recipeIds.has(from.recipeId) ? from.recipeId : null,
      title: from.title,
      servings: from.servings,
      status: "planned",
      proposedBy: me.id,
      agreedBy: [me.id], // everyone else still gets to agree
      cookId: from.cookId,
      notes: from.notes,
      createdAt: nowIso(),
    }));
    return { data: [...meals, ...copies], result: copies.length };
  });
  return { added };
});
