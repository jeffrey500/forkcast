import { update } from "@/lib/store";
import { body, handle, HttpError, publicUser, requireMember, str } from "@/lib/server";
import type { User } from "@/lib/types";

/** Change your own profile (name, reminder preferences). Only ever touches the signed-in user. */
export const PUT = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const patch: Partial<User> = {};
  if (b.name !== undefined) {
    const name = str(b.name, 60);
    if (!name) throw new HttpError(400, "Enter a name.");
    patch.name = name;
  }
  if (typeof b.emailReminders === "boolean") patch.emailReminders = b.emailReminders;
  if (b.discordId !== undefined) {
    const id = str(b.discordId, 30);
    if (id && !/^\d{17,20}$/.test(id)) {
      throw new HttpError(400, "A Discord user ID is 17–20 digits. In Discord: Settings → Advanced → Developer Mode, then right-click your name → Copy User ID.");
    }
    patch.discordId = id || undefined;
  }
  const user = await update<User[], User>("users", [], (users) => {
    const cur = users.find((u) => u.id === me.id);
    if (!cur) throw new HttpError(404, "Account not found.");
    const next = { ...cur, ...patch };
    return { data: users.map((u) => (u.id === me.id ? next : u)), result: next };
  });
  return { user: publicUser(user) };
});
