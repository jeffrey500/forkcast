import { handle, requireAdmin } from "@/lib/server";
import { rateLimit } from "@/lib/ratelimit";
import { sendReminders } from "@/lib/reminders";

export const maxDuration = 60;

/** "Send reminders now" button in Admin → Settings. */
export const POST = handle(async () => {
  const me = await requireAdmin();
  rateLimit(`reminders:${me.id}`, 3, 10 * 60_000, "You just sent reminders. Try again in a few minutes.");
  return sendReminders({ force: true });
});
