import type { CookAssignment, DishesAssignment, Meal } from "./types";

/**
 * Fair chore assignment, used by the server when new meals are added (or a
 * week is repeated) with rotation turned on in Admin → Settings → Chores.
 *
 * Fairness is per week: within the week of each meal, whoever has done the
 * chore the fewest times gets it next. Ties go to whoever's turn is "earliest"
 * in a rotation that shifts every week, so the same person doesn't always win.
 */

export interface ChoreRules {
  cookAssignment: CookAssignment;
  dishesAssignment: DishesAssignment;
}

type Chore = "cookId" | "dishesId";

/** Days since 1970 for a YYYY-MM-DD date (timezone-free). */
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Monday-free week key: groups meals into 7-day blocks starting at weekStart. */
function weekKey(date: string, weekStartIso: string): number {
  return Math.floor((dayNumber(date) - dayNumber(weekStartIso)) / 7);
}

/** Count how many times each member has `chore` among `meals` (skipped meals don't count). */
export function choreCounts(meals: Meal[], memberIds: string[], chore: Chore): Map<string, number> {
  const counts = new Map(memberIds.map((id) => [id, 0]));
  for (const m of meals) {
    if (m.status === "skipped") continue;
    const who = m[chore];
    if (who && counts.has(who)) counts.set(who, counts.get(who)! + 1);
  }
  return counts;
}

function pick(candidates: string[], counts: Map<string, number>, memberIds: string[], rotation: number): string | null {
  if (!candidates.length) return null;
  const order = (id: string) => (memberIds.indexOf(id) - rotation + memberIds.length * 1000) % memberIds.length;
  return [...candidates].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || order(a) - order(b))[0];
}

/**
 * Fill in missing cooks/dishwashers on the meals listed in `targetIds`,
 * following `rules`. Existing assignments are always kept.
 * `allMeals` is the whole plan so counts include meals already assigned.
 * `weekAnchor` is any week-start date (aligns the 7-day fairness windows).
 * Returns the updated full meal list and how many chores were filled.
 */
export function assignChores(opts: {
  allMeals: Meal[];
  targetIds: string[];
  memberIds: string[];
  rules: ChoreRules;
  weekAnchor: string;
}): { meals: Meal[]; filled: number } {
  const { memberIds, weekAnchor } = opts;
  const cookMode: CookAssignment = opts.rules.cookAssignment;
  const dishesMode: DishesAssignment = opts.rules.dishesAssignment;
  if (!memberIds.length) return { meals: opts.allMeals, filled: 0 };

  const meals = opts.allMeals.map((m) => ({ ...m, dishesId: m.dishesId ?? null }));
  const targets = new Set(opts.targetIds);
  const members = new Set(memberIds);
  let filled = 0;

  // Process targets in date order so the rotation reads naturally through the week.
  const queue = meals
    .filter((m) => targets.has(m.id) && m.status === "planned")
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) || a.createdAt.localeCompare(b.createdAt));

  for (const meal of queue) {
    const week = weekKey(meal.date, weekAnchor);
    const sameWeek = meals.filter((m) => m.id !== meal.id && weekKey(m.date, weekAnchor) === week);
    const rotation = ((week % memberIds.length) + memberIds.length) % memberIds.length;

    const hasCook = meal.cookId && members.has(meal.cookId);
    if (!hasCook && cookMode === "rotate") {
      // "Never the cook" works both ways: if the dishwasher was picked by hand, don't make them cook too.
      const cookPool =
        dishesMode === "not-cook" && meal.dishesId && members.has(meal.dishesId) && memberIds.length > 1
          ? memberIds.filter((id) => id !== meal.dishesId)
          : memberIds;
      meal.cookId = pick(cookPool, choreCounts(sameWeek, memberIds, "cookId"), memberIds, rotation);
      if (meal.cookId) filled++;
    }
    const hasDishes = meal.dishesId && members.has(meal.dishesId);
    if (!hasDishes && dishesMode !== "manual") {
      const pool =
        dishesMode === "not-cook" && meal.cookId && memberIds.length > 1 ? memberIds.filter((id) => id !== meal.cookId) : memberIds;
      // Offset the dishes rotation so it doesn't mirror the cook rotation.
      meal.dishesId = pick(pool, choreCounts(sameWeek, memberIds, "dishesId"), memberIds, rotation + 1);
      if (meal.dishesId) filled++;
    }
  }
  return { meals, filled };
}
