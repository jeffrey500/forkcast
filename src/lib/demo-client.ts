import { toISODate } from "./dates";

/**
 * Browser side of the public demo.
 *
 * A session cookie `fc_demo=1` marks the demo (it only lets the app's page
 * shells load; it unlocks no data). The demo household itself lives in this
 * tab's sessionStorage. While the demo is on, every /api/* call the app makes
 * is sent to /api/demo together with that copy, and the copy that comes back
 * replaces it. Nothing is saved on the server.
 */

const COOKIE = "fc_demo";
const DB_KEY = "fc_demo_db";
const AS_KEY = "fc_demo_as";

let memoryDb: unknown = null; // used when sessionStorage is unavailable
let memoryAs = "";

export function isDemo(): boolean {
  return typeof document !== "undefined" && new RegExp(`(?:^|;\\s*)${COOKIE}=1(?:;|$)`).test(document.cookie);
}

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // private mode or storage full: the in-memory copy still works for this page
  }
}

function loadDb(): unknown {
  const raw = storageGet(DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return memoryDb;
}

function saveDb(db: unknown) {
  memoryDb = db;
  storageSet(DB_KEY, db === null ? null : JSON.stringify(db));
}

/** Which made-up roommate the visitor is acting as ("" = the default admin). */
export function demoAs(): string {
  return storageGet(AS_KEY) ?? memoryAs;
}

export function setDemoAs(id: string) {
  memoryAs = id;
  storageSet(AS_KEY, id);
}

export function startDemo() {
  saveDb(null);
  setDemoAs("");
  document.cookie = `${COOKIE}=1; path=/; SameSite=Lax`;
}

/** Throw away the demo household and start again from the beginning. */
export function resetDemo() {
  saveDb(null);
  setDemoAs("");
}

export function endDemo() {
  resetDemo();
  storageSet(AS_KEY, null);
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

let installed = false;

/** Route the app's API calls through the demo while the demo is on. Safe to call more than once. */
export function installDemoFetch() {
  if (installed || typeof window === "undefined" || !isDemo()) return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  // One request at a time, so each sees the copy the previous one returned.
  let queue: Promise<unknown> = Promise.resolve();

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (!isDemo() || url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.pathname === "/api/demo") {
      return realFetch(input, init);
    }
    if (url.pathname === "/api/auth/logout") {
      endDemo();
      return Promise.resolve(json({ ok: true }));
    }
    if (url.pathname === "/api/receipt") {
      // Don't upload the photo just to be told no.
      return Promise.resolve(
        json({ error: "Receipt scanning with Claude is switched off in the demo. Try the on-device option instead." }, 403),
      );
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }

    const run = async () => {
      const res = await realFetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          path: url.pathname + url.search,
          body,
          db: loadDb(),
          as: demoAs(),
          today: toISODate(new Date()),
        }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out || typeof out.status !== "number") {
        return json({ error: out?.error ?? "The demo couldn't reach the server. Try again." }, res.ok ? 502 : res.status);
      }
      if (out.db) saveDb(out.db);
      return json(out.data, out.status);
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
}
