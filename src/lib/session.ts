import { SignJWT, jwtVerify } from "jose";
import { SetupError } from "./errors";

/** Edge-safe JWT helpers (used by proxy.ts and the server). */

export const SESSION_COOKIE = "fc_session";
export const SESSION_DAYS = 30;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || (process.env.NODE_ENV === "production" && s.length < 32)) {
    if (process.env.NODE_ENV === "production") {
      throw new SetupError(
        "add an AUTH_SECRET environment variable in Vercel (at least 32 random characters, e.g. from `openssl rand -base64 32`), then redeploy.",
      );
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-0123456789");
  }
  return new TextEncoder().encode(s);
}

/** Throws a SetupError if sessions can't be signed, before anything is saved. */
export function assertSessionSecret() {
  secret();
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
