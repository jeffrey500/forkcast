import { update } from "@/lib/store";
import { body, cleanIngredients, handle, HttpError, isoDate, newId, nowIso, requireMember } from "@/lib/server";
import type { ShoppingItem } from "@/lib/types";

/** Add items to the shopping list, optionally for a planned shopping day. */
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const items = cleanIngredients(Array.isArray(b.items) ? b.items : [b]);
  if (!items.length) throw new HttpError(400, "Nothing to add.");
  const plannedDate = b.plannedDate ? isoDate(b.plannedDate) : null;
  const added: ShoppingItem[] = items.map((i) => ({
    id: newId(),
    ...i,
    plannedDate,
    addedBy: me.id,
    createdAt: nowIso(),
  }));
  await update<ShoppingItem[]>("shopping", [], (s) => ({ data: [...s, ...added] }));
  return { added };
});
