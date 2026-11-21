import { update } from "@/lib/store";
import { body, handle, HttpError, requireAdmin } from "@/lib/server";
import type { User } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function ensureAnotherAdmin(users: User[], exceptId: string) {
  const admins = users.filter((u) => u.role === "admin" && u.status === "approved" && u.id !== exceptId);
  if (!admins.length) throw new HttpError(409, "There must always be at least one approved admin.");
}

/** Approve / reject / change role. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const b = await body(req);
  await update<User[]>("users", [], (users) => {
    const cur = users.find((u) => u.id === id);
    if (!cur) throw new HttpError(404, "User not found.");
    const next = { ...cur };
    if (b.status === "approved" || b.status === "rejected" || b.status === "pending") next.status = b.status;
    if (b.role === "admin" || b.role === "member") next.role = b.role;
    const losingAdmin =
      cur.role === "admin" && cur.status === "approved" && (next.role !== "admin" || next.status !== "approved");
    if (losingAdmin) ensureAnotherAdmin(users, id);
    return { data: users.map((u) => (u.id === id ? next : u)) };
  });
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await update<User[]>("users", [], (users) => {
    const cur = users.find((u) => u.id === id);
    if (!cur) throw new HttpError(404, "User not found.");
    if (cur.role === "admin" && cur.status === "approved") ensureAnotherAdmin(users, id);
    return { data: users.filter((u) => u.id !== id) };
  });
  return { ok: true };
});
