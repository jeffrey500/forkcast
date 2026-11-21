import { read, update } from "@/lib/store";
import { assignChores } from "@/lib/chores";
import { addDays } from "@/lib/dates";
import { body, getSettings, handle, isoDate, requireMember } from "@/lib/server";
import type { Meal, User } from "@/lib/types";

/** The planner's "Assign chores" button: fairly fill cooks/dishwashers for a week's planned meals. */
export const POST = handle(async (req: Request) => {
  await requireMember();
  const b = await body(req);
  const weekStart = isoDate(b.weekStart);
  const weekEnd = addDays(weekStart, 6);
  const reassign = b.reassign === true;
  const [users, settings] = await Promise.all([read<User[]>("users", []), getSettings()]);
  const memberIds = users.filter((u) => u.status === "approved").map((u) => u.id);

  const filled = await update<Meal[], number>("meals", [], (meals) => {
    const targetIds = meals
      .filter((m) => m.status === "planned" && m.date >= weekStart && m.date <= weekEnd)
      .map((m) => m.id);
    if (!targetIds.length) return { data: meals, result: 0 };
    const out = assignChores({
      allMeals: meals,
      targetIds,
      memberIds,
      rules: settings,
      weekAnchor: weekStart,
      forceRotate: true,
      reassign,
    });
    return { data: out.meals, result: out.filled };
  });
  return { filled };
});
