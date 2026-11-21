import { body, handle, HttpError, requireAdmin } from "@/lib/server";
import { rateLimit } from "@/lib/ratelimit";
import { sendReminders } from "@/lib/reminders";
import { sendEmail, smtpProblem, verifyEmail } from "@/lib/email";
import { APP_NAME } from "@/lib/types";

export const maxDuration = 60;

/**
 * Admin → Settings buttons:
 *  - { test: true }: check the SMTP login and send a test email to yourself.
 *  - otherwise: send tonight's reminders now.
 * Admins see the real reason when something fails, so they can fix the setup.
 */
export const POST = handle(async (req: Request) => {
  const me = await requireAdmin();
  rateLimit(`reminders:${me.id}`, 5, 10 * 60_000, "You just tried that. Wait a few minutes before trying again.");
  const b = await body(req).catch(() => ({}) as Record<string, unknown>);

  try {
    if (b.test === true) {
      await verifyEmail();
      await sendEmail({
        to: me.email,
        subject: `✅ ${APP_NAME} email is working`,
        text: `Hi ${me.name},\n\nReminder emails are set up correctly. Your roommates will get them in the evening when something needs their attention.`,
        html: `<p>Hi ${me.name.replace(/[<>&]/g, "")},</p><p>Reminder emails are set up correctly. Your roommates will get them in the evening when something needs their attention.</p>`,
      });
      return { ok: true, message: `Sent a test email to ${me.email}. Check your inbox (and spam).` };
    }
    return await sendReminders({ force: true });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("Admin email action failed", err);
    throw new HttpError(502, smtpProblem(err));
  }
});
