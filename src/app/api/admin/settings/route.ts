import { update } from "@/lib/store";
import { body, getSettings, handle, num, publicSettings, requireAdmin, str } from "@/lib/server";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  const b = await body(req);
  await update<Partial<Settings>>("settings", {}, (cur) => {
    const s: Settings = { ...DEFAULT_SETTINGS, ...cur };
    if (b.householdName !== undefined) s.householdName = str(b.householdName, 60) || s.householdName;
    const day = (v: unknown, d: number) => {
      const n = Math.round(num(v, d));
      return n >= 0 && n <= 6 ? n : d;
    };
    if (b.planningDay !== undefined) s.planningDay = day(b.planningDay, s.planningDay);
    if (b.weekStartDay !== undefined) s.weekStartDay = day(b.weekStartDay, s.weekStartDay);
    if (Array.isArray(b.mealSlots)) {
      const slots = [...new Set(b.mealSlots.map((x) => str(x, 40)).filter(Boolean))].slice(0, 8);
      if (slots.length) s.mealSlots = slots;
    }
    if (b.agreementRule === "any" || b.agreementRule === "majority" || b.agreementRule === "all") {
      s.agreementRule = b.agreementRule;
    }
    if (Array.isArray(b.staples)) {
      s.staples = [...new Set(b.staples.map((x) => str(x, 60)).filter(Boolean))].slice(0, 50);
    }
    if (typeof b.claudeModel === "string" && MODELS.includes(b.claudeModel)) s.claudeModel = b.claudeModel;
    if (typeof b.reminderEmails === "boolean") s.reminderEmails = b.reminderEmails;
    if (typeof b.timezone === "string") {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: b.timezone });
        s.timezone = b.timezone;
      } catch {
        // ignore unknown time zones
      }
    }
    // Empty string clears the key; undefined leaves it alone.
    if (typeof b.anthropicApiKey === "string") s.anthropicApiKey = b.anthropicApiKey.trim();
    return { data: s };
  });
  return { settings: publicSettings(await getSettings()) };
});
