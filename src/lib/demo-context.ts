import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { HttpError } from "./errors";

/**
 * The public demo runs the real API handlers against a throwaway copy of a
 * made-up household. That copy lives in the visitor's browser tab and is sent
 * along with every demo request; while a handler runs inside `runDemo`, the
 * store reads and writes this in-memory copy instead of real storage, so
 * nothing a visitor does is ever saved on the server.
 */
export interface DemoContext {
  /** Collections by name (users, settings, recipes, …). Mutated in place by store.update. */
  db: Record<string, unknown>;
  /** The roommate the visitor is currently acting as. */
  meId: string;
}

const storage = new AsyncLocalStorage<DemoContext>();

export function runDemo<T>(ctx: DemoContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/** The active demo, if this request is a demo request. */
export function demoContext(): DemoContext | undefined {
  return storage.getStore();
}

export const inDemo = () => storage.getStore() !== undefined;

/** Refuse anything with real-world side effects (Claude calls, emails, Discord) inside the demo. */
export function assertNotDemo(message: string) {
  if (inDemo()) throw new HttpError(403, message);
}
