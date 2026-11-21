import { update } from "@/lib/store";
import { addToFridge } from "@/lib/inventory";
import { body, cleanIngredients, handle, HttpError, newId, requireMember } from "@/lib/server";
import type { FridgeItem } from "@/lib/types";

/** Add one or more items; merges with matching items already in the fridge. */
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const items = cleanIngredients(Array.isArray(b.items) ? b.items : [b]);
  if (!items.length) throw new HttpError(400, "Nothing to add.");
  const fridge = await update<FridgeItem[], FridgeItem[]>("fridge", [], (f) => {
    const next = addToFridge(f, items, me.id, newId);
    return { data: next, result: next };
  });
  return { fridge };
});
