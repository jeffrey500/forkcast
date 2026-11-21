import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { update } from "@/lib/store";
import { body, handle, HttpError, newId, nowIso, publicUser, str } from "@/lib/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const MAX_PENDING = 10;
import { signSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import type { User } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  rateLimit(`register:${clientIp(req)}`, 5, 60 * 60_000, "Too many sign-up attempts. Try again later.");
  const b = await body(req);
  const email = str(b.email, 200).toLowerCase();
  const name = str(b.name, 60);
  const password = typeof b.password === "string" ? b.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email.");
  if (!name) throw new HttpError(400, "Enter your name.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

  const passwordHash = await bcrypt.hash(password, 10);
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const user = await update<User[], User>("users", [], (users) => {
    if (users.some((u) => u.email === email)) {
      throw new HttpError(409, "An account with that email already exists.");
    }
    // The very first account (or anyone listed in ADMIN_EMAILS) is an approved admin.
    const bootstrap = users.length === 0 || adminEmails.includes(email);
    // Once everyone has joined, set ALLOW_SIGNUPS=false so strangers can't even ask.
    if (!bootstrap && process.env.ALLOW_SIGNUPS === "false") {
      throw new HttpError(403, "Sign-ups are closed. Ask your household admin.");
    }
    // Stop a flood of junk sign-ups from piling up (an admin can clear them).
    if (!bootstrap && users.filter((u) => u.status === "pending").length >= MAX_PENDING) {
      throw new HttpError(429, "Too many accounts are waiting for approval. Ask your admin to review them.");
    }
    const u: User = {
      id: newId(),
      email,
      name,
      passwordHash,
      role: bootstrap ? "admin" : "member",
      status: bootstrap ? "approved" : "pending",
      createdAt: nowIso(),
    };
    return { data: [...users, u], result: u };
  });

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
