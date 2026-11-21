import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { read, update } from "@/lib/store";
import { body, handle, HttpError, publicUser, str } from "@/lib/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { assertSessionSecret, signSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import type { User } from "@/lib/types";

// Compared against when the email is unknown so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

export const POST = handle(async (req: Request) => {
  assertSessionSecret();
  rateLimit(`login:${clientIp(req)}`, 20, 10 * 60_000, "Too many sign-in attempts. Wait a few minutes.");
  const b = await body(req);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const users = await read<User[]>("users", []);
  const user = users.find((u) => u.email === email);

  if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new HttpError(429, `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.`);
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (user && !ok) {
    // Count the failure; lock the account for a while after too many in a row.
    await update<User[]>("users", [], (us) => ({
      data: us.map((u) => {
        if (u.id !== user.id) return u;
        const failedLogins = (u.failedLogins ?? 0) + 1;
        return failedLogins >= MAX_FAILURES
          ? { ...u, failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }
          : { ...u, failedLogins };
      }),
    }));
  }
  if (!user || !ok) throw new HttpError(401, "Wrong email or password.");
  if (user.status === "rejected") throw new HttpError(403, "This account was not approved.");

  if (user.failedLogins || user.lockedUntil) {
    await update<User[]>("users", [], (us) => ({
      data: us.map((u) => {
        if (u.id !== user.id) return u;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { failedLogins, lockedUntil, ...rest } = u;
        return rest;
      }),
    }));
  }

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
