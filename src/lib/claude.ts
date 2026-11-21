import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { update } from "./store";
import { rateLimit } from "./ratelimit";
import { claudeKey, getSettings, HttpError } from "./server";
import type { Settings, User } from "./types";

/** Per-person daily cap (ideas + receipt scans) so a leaked login can't run up the bill. */
const DAILY_LIMIT = Math.max(1, parseInt(process.env.IDEAS_DAILY_LIMIT ?? "20", 10) || 20);

type Usage = { day: string; counts: Record<string, number> };

/**
 * Get a Claude client for this request after checking there's a key, the
 * person isn't spamming, and they're within today's allowance.
 */
export async function claudeFor(me: User): Promise<{ client: Anthropic; settings: Settings }> {
  rateLimit(`claude:${me.id}`, 1, 5_000, "One request at a time — give Claude a few seconds.");
  const settings = await getSettings();
  const { key } = claudeKey(settings);
  if (!key) throw new HttpError(400, "No Claude API key yet. An admin can add one under Admin → Settings.");

  // Count this request against today's allowance (UTC day) before spending anything.
  const today = new Date().toISOString().slice(0, 10);
  await update<Usage>("usage", { day: today, counts: {} }, (u) => {
    const usage = u.day === today ? u : { day: today, counts: {} };
    const used = usage.counts[me.id] ?? 0;
    if (used >= DAILY_LIMIT) {
      throw new HttpError(429, `You've used today's ${DAILY_LIMIT} Claude requests. More tomorrow!`);
    }
    return { data: { day: today, counts: { ...usage.counts, [me.id]: used + 1 } } };
  });

  return { client: new Anthropic({ apiKey: key }), settings };
}

/** Turn SDK errors into messages people can act on. */
export function claudeError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof Anthropic.AuthenticationError) {
    throw new HttpError(400, "The Claude API key was rejected. Check it in Admin → Settings.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new HttpError(429, "Claude is rate-limited right now. Try again in a minute.");
  }
  if (err instanceof Anthropic.APIError) {
    throw new HttpError(502, `Claude API error: ${err.message}`);
  }
  throw err;
}
