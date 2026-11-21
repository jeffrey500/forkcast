import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { read } from "./store";
import { SESSION_COOKIE, verifySession } from "./session";
import {
  DEFAULT_SETTINGS,
  type PublicSettings,
  type PublicUser,
  type Settings,
  type User,
} from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export function publicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u;
  return rest;
}

export async function getSettings(): Promise<Settings> {
  const s = await read<Partial<Settings>>("settings", {});
  return { ...DEFAULT_SETTINGS, ...s };
}

export function claudeKey(settings: Settings): { key: string; source: PublicSettings["claudeKeySource"] } {
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: "env" };
  if (settings.anthropicApiKey) return { key: settings.anthropicApiKey, source: "settings" };
  return { key: "", source: "none" };
}

export function publicSettings(s: Settings): PublicSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { anthropicApiKey, ...rest } = s;
  return { ...rest, claudeKeySource: claudeKey(s).source };
}

/** The signed-in user, whatever their approval status. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const users = await read<User[]>("users", []);
  return users.find((u) => u.id === id) ?? null;
}

/** Signed in AND approved by an admin. */
export async function requireMember(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in.");
  if (u.status !== "approved") throw new HttpError(403, "Your account is waiting for admin approval.");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireMember();
  if (u.role !== "admin") throw new HttpError(403, "Admins only.");
  return u;
}

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response | unknown>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      const out = await fn(...args);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      const msg = err instanceof Error ? err.message : "Something went wrong";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

// ---- input cleaning --------------------------------------------------------

export function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function isoDate(v: unknown): string {
  const s = str(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "Date must be YYYY-MM-DD.");
  return s;
}

export function cleanIngredients(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => ({
      name: str((i as Record<string, unknown>)?.name, 100),
      quantity: Math.max(0, num((i as Record<string, unknown>)?.quantity, 0)),
      unit: str((i as Record<string, unknown>)?.unit, 20),
    }))
    .filter((i) => i.name);
}

export function cleanRecipe(b: Record<string, unknown>) {
  const name = str(b.name, 120);
  if (!name) throw new HttpError(400, "Recipe needs a name.");
  return {
    name,
    description: str(b.description, 1000),
    servings: Math.max(1, Math.round(num(b.servings, 2))),
    ingredients: cleanIngredients(b.ingredients),
    instructions: str(b.instructions, 10000),
    tags: Array.isArray(b.tags) ? b.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 12) : [],
  };
}
