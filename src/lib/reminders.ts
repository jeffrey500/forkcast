import "server-only";
import { read, update } from "./store";
import { appUrl, emailConfigured, sendEmail } from "./email";
import { SetupError } from "./errors";
import { getSettings } from "./server";
import { addDays, DAY_NAMES, dayName, shortDate, weekDays, weekLabel, weekStart } from "./dates";
import { requiredAgreements } from "./inventory";
import { APP_NAME, type Meal, type User } from "./types";

/** How far ahead reminders look. */
const LOOKAHEAD_DAYS = 14;

/** Today's date (YYYY-MM-DD) in the household's time zone. */
export function localToday(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface ReminderResult {
  skipped?: string;
  sent: { name: string; meals: number }[];
  failed: { name: string; error: string }[];
}

interface Section {
  heading: string;
  lines: { main: string; sub?: string }[];
}

/**
 * Each evening, email every approved roommate one summary that can include:
 *  1. Tomorrow has no agreed meal (everyone).
 *  2. Planning day has come and next week still has empty days (everyone,
 *     from planning day until the week starts).
 *  3. Upcoming meals they personally haven't agreed to (just them).
 * Nobody gets an email if none of these apply to them.
 */
export async function sendReminders(opts: { force?: boolean } = {}): Promise<ReminderResult> {
  const settings = await getSettings();
  if (!settings.reminderEmails && !opts.force) return { skipped: "Reminder emails are turned off in Settings.", sent: [], failed: [] };
  if (!emailConfigured()) return { skipped: "Email isn't set up (SMTP_HOST, SMTP_USER, SMTP_PASS).", sent: [], failed: [] };

  const today = localToday(settings.timezone);

  // Run at most once per household day (the cron may be retried).
  if (!opts.force) {
    const already = await update<{ lastRunDay?: string }, boolean>("reminders", {}, (r) =>
      r.lastRunDay === today ? { data: r, result: true } : { data: { lastRunDay: today }, result: false },
    );
    if (already) return { skipped: `Already sent today (${today}).`, sent: [], failed: [] };
  }

  const [users, meals] = await Promise.all([read<User[]>("users", []), read<Meal[]>("meals", [])]);
  const members = users.filter((u) => u.status === "approved");
  const names = new Map(members.map((u) => [u.id, u.name]));
  const needed = requiredAgreements(settings.agreementRule, members.length);
  const votes = (m: Meal) => m.agreedBy.filter((id) => names.has(id)).length;
  const isAgreed = (m: Meal) => votes(m) >= needed;
  const tomorrow = addDays(today, 1);
  const label = (d: string) => `${dayName(d)} ${shortDate(d)}`;
  const planned = meals.filter((m) => m.status === "planned" || m.status === "cooked");

  // 1. Tomorrow
  const shared: Section[] = [];
  const tomorrowMeals = planned.filter((m) => m.date === tomorrow);
  if (!tomorrowMeals.some(isAgreed)) {
    shared.push({
      heading: `Nothing is agreed for tomorrow (${label(tomorrow)})`,
      lines: settings.mealSlots.map((slot) => {
        const inSlot = tomorrowMeals.filter((m) => m.slot === slot);
        return inSlot.length
          ? { main: `${slot}: ${inSlot.map((m) => m.title).join(", ")}`, sub: `waiting on votes (${Math.max(...inSlot.map(votes))}/${needed} needed)` }
          : { main: `${slot}: nothing planned yet` };
      }),
    });
  }

  // 2. Planning day passed and next week still has empty days
  const thisWeek = weekStart(today, settings.weekStartDay);
  const nextWeek = addDays(thisWeek, 7);
  const sincePlanning = (new Date(`${today}T12:00:00`).getDay() - settings.planningDay + 7) % 7;
  const daysUntilNextWeek = Math.round((Date.parse(nextWeek) - Date.parse(today)) / 86_400_000);
  if (sincePlanning < daysUntilNextWeek) {
    const days = weekDays(nextWeek);
    const empty = days.filter((d) => !planned.some((m) => m.date === d));
    const unvoted = planned.filter((m) => m.date >= nextWeek && m.date <= days[6] && !isAgreed(m)).length;
    if (empty.length) {
      shared.push({
        heading: `${DAY_NAMES[settings.planningDay]} was planning day, and next week (${weekLabel(nextWeek)}) isn't planned yet`,
        lines: [
          { main: `${empty.length} of 7 days have no meals: ${empty.map((d) => dayName(d).slice(0, 3)).join(", ")}` },
          ...(unvoted ? [{ main: `${unvoted} proposed meal(s) still need votes` }] : []),
        ],
      });
    }
  }

  // 3. Meals each person hasn't agreed to
  const upcoming = meals
    .filter((m) => m.status === "planned" && m.date >= tomorrow && m.date <= addDays(today, LOOKAHEAD_DAYS))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));

  const result: ReminderResult = { sent: [], failed: [] };
  const link = appUrl();

  for (const u of members) {
    const pending = upcoming.filter((m) => !m.agreedBy.includes(u.id));
    const sections = [...shared];
    if (pending.length) {
      sections.push({
        heading: pending.length === 1 ? "1 meal is waiting for your vote" : `${pending.length} meals are waiting for your vote`,
        lines: pending.map((m) => ({
          main: `${label(m.date)} · ${m.slot}: ${m.title}`,
          sub: `proposed by ${names.get(m.proposedBy) ?? "a former roommate"} · ${votes(m)}/${members.length} agreed`,
        })),
      });
    }
    if (!sections.length) continue;

    const subject = `🍴 ${sections[0].heading}${sections.length > 1 ? ` (+${sections.length - 1} more)` : ""}`;
    const text = [
      `Hi ${u.name},`,
      "",
      ...sections.flatMap((sec) => [sec.heading, ...sec.lines.map((l) => `  • ${l.main}${l.sub ? ` (${l.sub})` : ""}`), ""]),
      `Open ${APP_NAME}: ${link}`,
      "",
      `An admin can turn these emails off in Settings.`,
    ].join("\n");
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2a24;max-width:520px">
<p>Hi ${esc(u.name)},</p>
${sections
  .map(
    (sec) => `<h3 style="font-size:15px;margin:18px 0 6px">${esc(sec.heading)}</h3><ul style="padding-left:18px;margin:0">${sec.lines
      .map((l) => `<li style="margin-bottom:6px">${esc(l.main)}${l.sub ? `<br><span style="color:#5b665f;font-size:13px">${esc(l.sub)}</span>` : ""}</li>`)
      .join("")}</ul>`,
  )
  .join("")}
<p style="margin-top:20px"><a href="${esc(link)}" style="display:inline-block;background:#237546;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open ${APP_NAME}</a></p>
<p style="color:#8a948d;font-size:12px">An admin can turn these emails off in Settings.</p></div>`;
    try {
      await sendEmail({ to: u.email, subject, text, html });
      result.sent.push({ name: u.name, meals: pending.length });
    } catch (err) {
      if (err instanceof SetupError) throw err;
      console.error("Reminder email failed for", u.id, err);
      result.failed.push({ name: u.name, error: "could not send" });
    }
  }
  return result;
}
