import { update } from "@/lib/store";
import { addToFridge } from "@/lib/inventory";
import { body, handle, HttpError, isoDate, newId, num, requireMember, str } from "@/lib/server";
import type { FridgeItem, ShoppingItem } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  const b = await body(req);
  await update<ShoppingItem[]>("shopping", [], (s) => {
    const cur = s.find((x) => x.id === id);
    if (!cur) throw new HttpError(404, "Item not found.");
    const next: ShoppingItem = {
      ...cur,
      name: str(b.name, 100) || cur.name,
      quantity: b.quantity !== undefined ? Math.max(0, num(b.quantity, cur.quantity)) : cur.quantity,
      unit: typeof b.unit === "string" ? str(b.unit, 20) : cur.unit,
      plannedDate: b.plannedDate === null ? null : b.plannedDate ? isoDate(b.plannedDate) : cur.plannedDate,
    };
    return { data: s.map((x) => (x.id === id ? next : x)) };
  });
  return { ok: true };
});

/** DELETE ?bought=1 moves the item into the fridge; plain DELETE just drops it. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const bought = new URL(req.url).searchParams.get("bought") === "1";
  const item = await update<ShoppingItem[], ShoppingItem | undefined>("shopping", [], (s) => ({
    data: s.filter((x) => x.id !== id),
    result: s.find((x) => x.id === id),
  }));
  if (!item) throw new HttpError(404, "Item not found.");
  if (bought) {
    await update<FridgeItem[]>("fridge", [], (f) => ({
      data: addToFridge(f, [{ name: item.name, quantity: item.quantity, unit: item.unit }], me.id, newId),
    }));
  }
  return { ok: true };
});
