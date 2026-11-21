import { update } from "@/lib/store";
import { body, cleanRecipe, handle, newId, nowIso, requireMember } from "@/lib/server";
import type { Recipe } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const fields = cleanRecipe(await body(req));
  const recipe: Recipe = { id: newId(), ...fields, createdBy: me.id, createdAt: nowIso(), updatedAt: nowIso() };
  await update<Recipe[]>("recipes", [], (rs) => ({ data: [...rs, recipe] }));
  return { recipe };
});
