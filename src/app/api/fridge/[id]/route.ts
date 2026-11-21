import { update } from "@/lib/store";
import { body, handle, HttpError, nowIso, num, requireMember, str } from "@/lib/server";
import type { FridgeItem } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireMember();
  const { id } = await ctx.params;
  const b = await body(req);
  return update<FridgeItem[], { fridge: FridgeItem[] }>("fridge", [], (f) => {
    const cur = f.find((x) => x.id === id);
    if (!cur) throw new HttpError(404, "Item not found.");
    const quantity = Math.max(0, num(b.quantity, cur.quantity));
    const next: FridgeItem = {
      ...cur,
      name: str(b.name, 100) || cur.name,
      unit: typeof b.unit === "string" ? str(b.unit, 20) : cur.unit,
      quantity,
      updatedAt: nowIso(),
      updatedBy: me.id,
    };
    const data = quantity > 0 ? f.map((x) => (x.id === id ? next : x)) : f.filter((x) => x.id !== id);
    return { data, result: { fridge: data } };
  });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireMember();
  const { id } = await ctx.params;
  await update<FridgeItem[]>("fridge", [], (f) => ({ data: f.filter((x) => x.id !== id) }));
  return { ok: true };
});
