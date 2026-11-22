import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { runDemo } from "@/lib/demo-context";
import { DEMO_DEFAULT_USER, demoSeed } from "@/lib/demo-seed";
import { LIBRARY, libraryToRecipe } from "@/lib/library";
import { normalizeName } from "@/lib/units";
import { body, handle, HttpError, num, str } from "@/lib/server";
import { today as serverToday } from "@/lib/dates";
import type { FridgeItem, Recipe } from "@/lib/types";

import * as state from "../state/route";
import * as me from "../me/route";
import * as recipes from "../recipes/route";
import * as recipe from "../recipes/[id]/route";
import * as fridge from "../fridge/route";
import * as fridgeItem from "../fridge/[id]/route";
import * as meals from "../meals/route";
import * as meal from "../meals/[id]/route";
import * as agree from "../meals/[id]/agree/route";
import * as cook from "../meals/[id]/cook/route";
import * as repeat from "../meals/repeat/route";
import * as shopping from "../shopping/route";
import * as shoppingItem from "../shopping/[id]/route";
import * as adminUsers from "../admin/users/route";
import * as adminUser from "../admin/users/[id]/route";
import * as adminSettings from "../admin/settings/route";

/**
 * The public demo ("Try the demo" on the sign-in page).
 *
 * The browser keeps a throwaway copy of a made-up household and sends it with
 * every request. This route runs the app's real API handler for that request
 * against the copy (see demo-context.ts) and sends the changed copy back.
 * Nothing is read from or written to the household's real storage, and
 * anything with outside effects (Claude, email, Discord, accounts) is off.
 */

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "DELETE", unknown>>;

const ROUTES: [RegExp, RouteModule][] = [
  [/^\/api\/state$/, state],
  [/^\/api\/me$/, me],
  [/^\/api\/recipes$/, recipes],
  [/^\/api\/recipes\/([^/]+)$/, recipe],
  [/^\/api\/fridge$/, fridge],
  [/^\/api\/fridge\/([^/]+)$/, fridgeItem],
  [/^\/api\/meals$/, meals],
  [/^\/api\/meals\/repeat$/, repeat],
  [/^\/api\/meals\/([^/]+)$/, meal],
  [/^\/api\/meals\/([^/]+)\/agree$/, agree],
  [/^\/api\/meals\/([^/]+)\/cook$/, cook],
  [/^\/api\/shopping$/, shopping],
  [/^\/api\/shopping\/([^/]+)$/, shoppingItem],
  [/^\/api\/admin\/users$/, adminUsers],
  [/^\/api\/admin\/users\/([^/]+)$/, adminUser],
  [/^\/api\/admin\/settings$/, adminSettings],
];

const SWITCHED_OFF: [RegExp, string][] = [
  [/^\/api\/receipt$/, "Receipt scanning with Claude is switched off in the demo. Try the on-device option instead."],
  [/^\/api\/(recipes\/[^/]+\/nutrition|admin\/nutrition)$/, "Calorie analysis with Claude is switched off in the demo. Recipes added from the library come with estimates."],
  [/^\/api\/admin\/reminders$/, "Emails and Discord messages are switched off in the demo."],
  [/^\/api\/(auth|cron)\//, "Not available in the demo."],
];

const METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
const MAX_DEMO_BYTES = 512 * 1024;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Stand-in for Claude on the Ideas page: library recipes the household doesn't have yet. */
function sampleIdeas(db: Record<string, unknown>, b: Record<string, unknown>) {
  const count = Math.min(6, Math.max(1, Math.round(num(b.count, 3))));
  const servings = Math.min(12, Math.max(1, Math.round(num(b.servings, 4))));
  const useFridge = b.useFridge !== false;
  const owned = new Set((Array.isArray(db.recipes) ? (db.recipes as Recipe[]) : []).map((r) => r.libraryId));
  const inFridge = new Set((Array.isArray(db.fridge) ? (db.fridge as FridgeItem[]) : []).map((f) => normalizeName(String(f.name))));
  const pool = LIBRARY.filter((r) => !owned.has(r.id));
  const score = (r: (typeof LIBRARY)[number]) =>
    (useFridge ? r.ingredients.filter((i) => inFridge.has(normalizeName(i.name))).length : 0) + Math.random() * 2;
  return {
    ideas: pool
      .map((r) => ({ r, s: score(r) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, count)
      .map(({ r }) => {
        const scaled = libraryToRecipe(r, servings);
        const have = (name: string) => useFridge && inFridge.has(normalizeName(name));
        return {
          name: scaled.name,
          description: scaled.description, // the page explains these are library samples
          servings,
          prepMinutes: r.minutes,
          ingredients: scaled.ingredients,
          instructions: scaled.instructions,
          usesFromFridge: r.ingredients.filter((i) => have(i.name)).map((i) => i.name),
          needToBuy: r.ingredients.filter((i) => !have(i.name)).map((i) => i.name),
          tags: r.tags.slice(0, 4),
          ...(r.nutrition ?? {}),
        };
      }),
  };
}

export const POST = handle(async (req: Request) => {
  rateLimit(`demo:${clientIp(req)}`, 300, 60_000, "The demo is getting a lot of clicks. Wait a moment and try again.");
  const b = await body(req, MAX_DEMO_BYTES);

  const method = str(b.method, 10).toUpperCase();
  if (!METHODS.has(method)) throw new HttpError(400, "Unsupported method.");
  const url = new URL(str(b.path, 500) || "/", req.url);
  if (url.origin !== new URL(req.url).origin) throw new HttpError(400, "Bad path.");
  const path = url.pathname;

  const off = SWITCHED_OFF.find(([re]) => re.test(path));
  if (off) return { status: 403, data: { error: off[1] } };

  // A fresh demo starts from the seed, built around the visitor's own date.
  const fresh = !isRecord(b.db);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(str(b.today, 10)) ? str(b.today, 10) : serverToday();
  const db = fresh ? demoSeed(today) : (b.db as Record<string, unknown>);
  const meId = str(b.as, 60) || DEMO_DEFAULT_USER;

  if (path === "/api/ideas" && method === "POST") {
    return { status: 200, data: sampleIdeas(db, isRecord(b.body) ? b.body : {}), ...(fresh ? { db } : {}) };
  }

  let handler: Handler | undefined;
  let params: Record<string, string> = {};
  for (const [re, mod] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      handler = mod[method as keyof RouteModule] as Handler | undefined;
      params = m[1] ? { id: decodeURIComponent(m[1]) } : {};
      break;
    }
  }
  if (!handler) return { status: 404, data: { error: "Not available in the demo." } };

  const inner = new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(b.body ?? {}),
  });
  const res = await runDemo({ db, meId }, () => handler(inner, { params: Promise.resolve(params) }));
  const data = await res.json().catch(() => ({}));
  // The copy only changes on writes (or when it was just created), so reads don't send it back.
  return NextResponse.json({ status: res.status, data, ...(fresh || method !== "GET" ? { db } : {}) });
});
