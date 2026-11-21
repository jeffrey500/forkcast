import { read, update } from "@/lib/store";
import { assignChores } from "@/lib/chores";
import { addDays, weekStart as weekStartOf } from "@/lib/dates";
import { repeatCandidates } from "@/lib/inventory";
import { body, getSettings, handle, isoDate, newId, nowIso, requireMember } from "@/lib/server";
import type { Meal, Recipe, User } from "@/lib/types";

/** Fill a week's empty slots with what was eaten the same day/slot the week before. */
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const weekStart = isoDate(b.weekStart);
  const [recipes, users, settings] = await Promise.all([
    read<Recipe[]>("recipes", []),
    read<User[]>("users", []),
    getSettings(),
  ]);
  const recipeIds = new Set(recipes.map((r) => r.id));
  const memberIds = users.filter((u) => u.status === "approved").map((u) => u.id);
  const auto = settings.cookAssignment !== "manual" || settings.dishesAssignment !== "manual";

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
      dishesId: from.dishesId ?? null,
      notes: from.notes,
      createdAt: nowIso(),
    }));
    let data = [...meals, ...copies];
    if (auto && copies.length) {
      data = assignChores({
        allMeals: data,
        targetIds: copies.map((c) => c.id),
        memberIds,
        rules: settings,
        weekAnchor: weekStartOf(weekStart, settings.weekStartDay),
      }).meals;
    }
    return { data, result: copies.length };
  });
  return { added };
});
