import { read } from "@/lib/store";
import { handle, publicUser, requireAdmin } from "@/lib/server";
import type { User } from "@/lib/types";

export const GET = handle(async () => {
  await requireAdmin();
  const users = await read<User[]>("users", []);
  return { users: users.map(publicUser) };
});
