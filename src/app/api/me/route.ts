import { update } from "@/lib/store";
import { body, handle, HttpError, publicUser, requireMember, str } from "@/lib/server";
import type { User } from "@/lib/types";

/** Change your own display name. Only ever touches the signed-in user. */
export const PUT = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const name = str(b.name, 60);
  if (!name) throw new HttpError(400, "Enter a name.");
  const user = await update<User[], User>("users", [], (users) => {
    const cur = users.find((u) => u.id === me.id);
    if (!cur) throw new HttpError(404, "Account not found.");
    const next = { ...cur, name };
    return { data: users.map((u) => (u.id === me.id ? next : u)), result: next };
  });
  return { user: publicUser(user) };
});
