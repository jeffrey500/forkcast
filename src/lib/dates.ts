export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Local YYYY-MM-DD for a Date. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date at noon (avoids DST edge cases). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

/** First day of the week containing `iso`, given which weekday weeks start on. */
export function weekStart(iso: string, weekStartDay: number): string {
  const d = fromISODate(iso);
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  return addDays(iso, -diff);
}

export function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

export function dayName(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

export function shortDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function weekLabel(startIso: string): string {
  return `${shortDate(startIso)} – ${shortDate(addDays(startIso, 6))}`;
}
