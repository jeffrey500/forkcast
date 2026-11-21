import "server-only";
import type { PublicSettings, Settings } from "./types";

/**
 * Discord reminders go through a channel webhook (Server Settings → Integrations
 * → Webhooks). Only real Discord webhook URLs are accepted, so the server can
 * never be pointed at another host.
 */
const WEBHOOK = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,120}$/;

export function isDiscordWebhook(url: string): boolean {
  return WEBHOOK.test(url.trim());
}

export function discordWebhook(settings: Settings): { url: string; source: PublicSettings["discordSource"] } {
  const env = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (env && isDiscordWebhook(env)) return { url: env, source: "env" };
  if (settings.discordWebhookUrl && isDiscordWebhook(settings.discordWebhookUrl)) {
    return { url: settings.discordWebhookUrl, source: "settings" };
  }
  return { url: "", source: "none" };
}

class DiscordError extends Error {
  constructor(public status: number) {
    super(`Discord responded ${status}`);
  }
}

/** Post a message; only the listed user IDs can be pinged (never @everyone). */
export async function postDiscord(url: string, content: string, mentionIds: string[] = []) {
  const res = await fetch(`${url}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Forkcast",
      content: content.length > 2000 ? `${content.slice(0, 1990)}\n…` : content,
      allowed_mentions: { parse: [], users: [...new Set(mentionIds)].slice(0, 100) },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new DiscordError(res.status);
}

/** Explain a Discord failure in words an admin can act on. */
export function discordProblem(err: unknown): string {
  if (err instanceof DiscordError) {
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      return "Discord rejected the webhook. It may have been deleted. Create a new webhook and paste its URL in Settings.";
    }
    if (err.status === 429) return "Discord is rate-limiting this webhook. Try again in a minute.";
    if (err.status === 400) return "Discord didn't accept the message.";
    return `Discord returned an error (${err.status}). Try again later.`;
  }
  return "Couldn't reach Discord. Try again later.";
}
