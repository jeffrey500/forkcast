import { update } from "@/lib/store";
import { handle, HttpError, requireMember } from "@/lib/server";
import type { Meal } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Toggle the current user's agreement on a meal. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const meal = await update<Meal[], Meal>("meals", [], (ms) => {
    const cur = ms.find((m) => m.id === id);
    if (!cur) throw new HttpError(404, "Meal not found.");
    const agreed = cur.agreedBy.includes(me.id);
    const next = {
      ...cur,
      agreedBy: agreed ? cur.agreedBy.filter((u) => u !== me.id) : [...cur.agreedBy, me.id],
    };
    return { data: ms.map((m) => (m.id === id ? next : m)), result: next };
  });
  return { meal };
});
