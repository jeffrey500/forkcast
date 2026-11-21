"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { useForecast } from "./useForecast";
import { addDays, DAY_NAMES, dayName, fromISODate, shortDate, toISODate, weekStart } from "@/lib/dates";
import type { Meal } from "@/lib/types";

/** First of the month containing `iso`, as YYYY-MM-01. */
function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Shift a YYYY-MM-01 date by `n` months. */
function addMonths(firstIso: string, n: number): string {
  const d = fromISODate(firstIso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
}

/** Last day of the month starting at `firstIso`. */
function monthEnd(firstIso: string): string {
  return addDays(addMonths(firstIso, 1), -1);
}

function monthTitle(firstIso: string): string {
  return fromISODate(firstIso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type Mark = "made" | "agreed" | "proposed" | "skipped";

function markOf(meal: Meal, agreed: boolean): Mark {
  if (meal.status === "cooked") return "made";
  if (meal.status === "skipped") return "skipped";
  return agreed ? "agreed" : "proposed";
}

/** Status glyph used in the title rows (sm and up). */
function Glyph({ mark }: { mark: Mark }) {
  if (mark === "made") return <span className="w-2.5 shrink-0 text-center text-[10px] font-bold text-leaf-700">✓</span>;
  return (
    <span className="flex w-2.5 shrink-0 justify-center">
      <span
        className={`size-1.5 rounded-full ${
          mark === "agreed" ? "bg-leaf-500" : mark === "proposed" ? "border border-amber-500" : "bg-ink/20"
        }`}
      />
    </span>
  );
}

/** Compact dot used on phone widths (one per meal). */
function Dot({ mark, short }: { mark: Mark; short: boolean }) {
  const base =
    mark === "made"
      ? "bg-leaf-700"
      : mark === "agreed"
        ? "bg-leaf-500"
        : mark === "proposed"
          ? "border border-amber-500"
          : "bg-ink/20";
  return <span className={`size-1.5 rounded-full ${base} ${short ? "ring-1 ring-red-500" : ""}`} />;
}

export default function MonthCalendar({
  initialDate,
  onPickDate,
}: {
  /** Any date inside the month to show first (YYYY-MM-DD). */
  initialDate: string;
  /** Called when a day is clicked or a date is picked: the parent switches to that day's week. */
  onPickDate: (iso: string) => void;
}) {
  const { state } = useApp();
  const fc = useForecast();
  const { settings } = state;

  const [month, setMonth] = useState(() => monthStart(initialDate));
  // Follow the parent if it hands us a date in a different month later on.
  const [prevInitial, setPrevInitial] = useState(initialDate);
  if (prevInitial !== initialDate) {
    setPrevInitial(initialDate);
    setMonth(monthStart(initialDate));
  }

  const thisMonth = monthStart(fc.today);
  const last = monthEnd(month);

  const days = useMemo(() => {
    const first = weekStart(month, settings.weekStartDay);
    const end = addDays(weekStart(last, settings.weekStartDay), 6);
    const out: string[] = [];
    for (let d = first; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month, last, settings.weekStartDay]);

  const mealsByDay = useMemo(() => {
    const slotIndex = (s: string) => {
      const i = settings.mealSlots.indexOf(s);
      return i === -1 ? settings.mealSlots.length : i;
    };
    const from = days[0];
    const to = days[days.length - 1];
    const map = new Map<string, Meal[]>();
    for (const m of state.meals) {
      if (m.date < from || m.date > to) continue;
      const list = map.get(m.date);
      if (list) list.push(m);
      else map.set(m.date, [m]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          slotIndex(a.slot) - slotIndex(b.slot) ||
          a.slot.localeCompare(b.slot) ||
          a.createdAt.localeCompare(b.createdAt),
      );
    }
    return map;
  }, [state.meals, settings.mealSlots, days]);

  const headers = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(settings.weekStartDay + i) % 7].slice(0, 3));

  const pickFromInput = (value: string) => {
    // Typing into the date field fires partial values like 0002-11-21; ignore those.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1970) return;
    setMonth(monthStart(value));
    onPickDate(value);
  };

  return (
    <section className="card p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold sm:text-xl">{monthTitle(month)}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn-outline btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <button className="btn-outline btn-sm" onClick={() => setMonth(thisMonth)} disabled={month === thisMonth}>
            This month
          </button>
          <button className="btn-outline btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            ›
          </button>
          <input
            type="date"
            className="input w-auto px-2 py-1 text-xs"
            aria-label="Go to date"
            title="Go to date"
            onChange={(e) => pickFromInput(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {headers.map((h) => (
          <div key={h} className="pb-1 text-center text-[11px] font-semibold tracking-wide text-ink/50 uppercase">
            {h}
          </div>
        ))}

        {days.map((d) => {
          const inMonth = d >= month && d <= last;
          const isToday = d === fc.today;
          const meals = mealsByDay.get(d) ?? [];
          const made = meals.filter((m) => m.status === "cooked").length;
          const dayNum = fromISODate(d).getDate();
          const label =
            `${dayName(d)}, ${shortDate(d)}${isToday ? " (today)" : ""}: ` +
            (meals.length
              ? `${meals.length} meal${meals.length === 1 ? "" : "s"}${made ? `, ${made} made` : ""}`
              : "no meals");

          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDate(d)}
              aria-label={label}
              aria-current={isToday ? "date" : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-stretch rounded-lg border p-1 text-left transition hover:border-leaf-500 hover:bg-leaf-50 focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:outline-none sm:min-h-24 sm:rounded-xl sm:p-1.5 ${
                inMonth ? "border-black/5 bg-white" : "border-transparent bg-black/[0.02] opacity-50"
              } ${isToday ? "ring-2 ring-leaf-500" : ""}`}
            >
              <span
                className={`text-xs font-bold sm:text-[13px] ${
                  isToday ? "text-leaf-700" : d < fc.today ? "text-ink/50" : "text-ink/80"
                }`}
              >
                {dayNum}
              </span>

              {meals.length > 0 && (
                <>
                  {/* Phone: one dot per meal (max 4). */}
                  <span className="mt-auto flex flex-wrap gap-0.5 pt-1 sm:hidden" aria-hidden>
                    {meals.slice(0, 4).map((m) => (
                      <Dot
                        key={m.id}
                        mark={markOf(m, fc.isAgreed(m))}
                        short={m.status === "planned" && fc.byMeal.get(m.id)?.readiness === "short"}
                      />
                    ))}
                  </span>

                  {/* Wider: up to 3 title rows. */}
                  <span className="mt-1 hidden space-y-0.5 sm:block" aria-hidden>
                    {meals.slice(0, 3).map((m) => {
                      const mark = markOf(m, fc.isAgreed(m));
                      const short = m.status === "planned" && fc.byMeal.get(m.id)?.readiness === "short";
                      return (
                        <span key={m.id} className="flex items-center gap-1 text-[11px] leading-tight" title={`${m.slot}: ${m.title}`}>
                          <Glyph mark={mark} />
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              mark === "skipped" ? "text-ink/40 line-through" : mark === "made" ? "text-ink/60" : "text-ink/80"
                            }`}
                          >
                            {m.title}
                          </span>
                          {short && (
                            <span className="shrink-0 font-bold text-red-600" title="Short on food">
                              !
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {meals.length > 3 && (
                      <span className="block pl-3.5 text-[10px] font-semibold text-ink/40">+{meals.length - 3} more</span>
                    )}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
        <span className="flex items-center gap-1">
          <Glyph mark="made" /> Made
        </span>
        <span className="flex items-center gap-1">
          <Glyph mark="agreed" /> Agreed
        </span>
        <span className="flex items-center gap-1">
          <Glyph mark="proposed" /> Proposed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 text-center font-bold text-red-600">!</span> Short on food
        </span>
        <span className="flex items-center gap-1 line-through">
          <Glyph mark="skipped" /> Skipped
        </span>
      </div>
    </section>
  );
}
