import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { read } from "@/lib/store";
import { body, handle, HttpError, publicUser, str } from "@/lib/server";
import { signSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import type { User } from "@/lib/types";

// Compared against when the email is unknown so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const users = await read<User[]>("users", []);
  const user = users.find((u) => u.email === email);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Wrong email or password.");
  if (user.status === "rejected") throw new HttpError(403, "This account was not approved.");

  const res = NextResponse.json({ user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
});
