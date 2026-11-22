"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useApp } from "@/components/AppProvider";
import MealForm, { type MealFormInit } from "@/components/MealForm";
import MonthCalendar, { Dot, markOf } from "@/components/MonthCalendar";
import { useForecast } from "@/components/useForecast";
import { IngredientList, Modal } from "@/components/ui";
import { addDays, DAY_NAMES, dayName, fromISODate, shortDate, weekDays, weekLabel, weekStart } from "@/lib/dates";
import { formatAmount, roundUpQty, titleCase } from "@/lib/units";
import type { Meal } from "@/lib/types";
import { repeatCandidates, type MealForecast } from "@/lib/inventory";
import { dayKcalPerPerson, formatKcal, mealKcal } from "@/lib/nutrition-shared";

export default function WeekPage() {
  const { state, api, toast } = useApp();
  const fc = useForecast();
  const { settings } = state;
  const thisWeek = weekStart(fc.today, settings.weekStartDay);
  const [start, setStart] = useState(thisWeek);
  const [form, setForm] = useState<MealFormInit | null>(null);
  const [view, setView] = useState<"week" | "month">("week");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [shopDate, setShopDate] = useState(fc.today);
  const [statList, setStatList] = useState<StatKind | null>(null);
  // Phones show one day at a time; this is the day the user tapped (if it's in the shown week).
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const stickyTop = useStickyHeaderHeight();
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const days = weekDays(start);
  const selectedDay = pickedDay && days.includes(pickedDay) ? pickedDay : days.includes(fc.today) ? fc.today : days[0];
  const nextWeek = addDays(thisWeek, 7);
  const isPlanningDay = fromISODate(fc.today).getDay() === settings.planningDay;
  const weekMeals = state.meals.filter((m) => m.date >= start && m.date <= days[6]);
  const slots = [...settings.mealSlots, ...new Set(weekMeals.map((m) => m.slot).filter((s) => !settings.mealSlots.includes(s)))];

  const weekForecasts = weekMeals.map((m) => fc.byMeal.get(m.id)).filter(Boolean) as MealForecast[];
  const shortCount = weekForecasts.filter((f) => f.readiness === "short").length;
  const pendingAgree = weekMeals.filter((m) => m.status === "planned" && !fc.isAgreed(m)).length;
  const weekShortfalls = fc.shortfalls.filter((s) => s.neededBy <= days[6]);
  const slotOrder = (slot: string) => {
    const i = slots.indexOf(slot);
    return i === -1 ? slots.length : i;
  };
  const sortedWeekMeals = [...weekMeals].sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot));
  const statMeals: Record<StatKind, Meal[]> = {
    planned: sortedWeekMeals.filter((m) => m.status !== "skipped"),
    votes: sortedWeekMeals.filter((m) => m.status === "planned" && !fc.isAgreed(m)),
    short: sortedWeekMeals.filter((m) => fc.byMeal.get(m.id)?.readiness === "short"),
    cooked: sortedWeekMeals.filter((m) => m.status === "cooked"),
  };
  const nextWeekMeals = state.meals.filter((m) => m.date >= nextWeek && m.date <= addDays(nextWeek, 6)).length;

  /** Step the phone day view by one day, crossing into the neighbouring week at the edges. */
  function stepDay(n: 1 | -1) {
    const next = addDays(selectedDay, n);
    if (!days.includes(next)) setStart(addDays(start, 7 * n));
    setPickedDay(next);
  }

  function onSwipeEnd(e: React.TouchEvent) {
    const s = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepDay(dx < 0 ? 1 : -1);
  }

  async function onDrop(e: React.DragEvent, date: string, slot: string) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/meal-id");
    const meal = state.meals.find((m) => m.id === id);
    if (!meal || (meal.date === date && meal.slot === slot)) return;
    if (meal.status === "cooked") return toast("Cooked meals can't be moved.", "error");
    if (await api("PUT", `/api/meals/${id}`, { date, slot })) toast(`Moved to ${dayName(date)} ${slot.toLowerCase()}.`);
  }

  /** Copy last week's meals into the empty slots of `target`. */
  async function repeatLastWeek(target: string) {
    const n = repeatCandidates(state.meals, target, addDays).length;
    if (!n) return toast("Every slot that had a meal last week is already filled.");
    if (!confirm(`Fill ${n} empty slot${n === 1 ? "" : "s"} in ${weekLabel(target)} with last week's meals?\n\nThey'll be proposed by you, so everyone else still gets to agree.`)) return;
    const r = await api<{ added: number }>("POST", "/api/meals/repeat", { weekStart: target });
    if (r) {
      setStart(target);
      toast(`Copied ${r.added} meal${r.added === 1 ? "" : "s"} from last week.`);
    }
  }
  const canRepeat = repeatCandidates(state.meals, start, addDays).length;
  const canRepeatNext = repeatCandidates(state.meals, nextWeek, addDays).length;

  async function addShortfallsToList() {
    const items = weekShortfalls.map((s) => ({ name: s.name, quantity: roundUpQty(s.quantity), unit: s.unit }));
    if (await api("POST", "/api/shopping", { items, plannedDate: shopDate })) {
      toast(`Added ${items.length} item(s) to the shopping list for ${dayName(shopDate)}.`);
    }
  }

  return (
    <div className="space-y-6">
      {isPlanningDay && start !== nextWeek && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-leaf-600 px-4 py-4 text-white shadow-sm sm:px-5">
          <span className="text-2xl">🗳️</span>
          <div className="flex-1">
            <p className="font-bold">It&apos;s {DAY_NAMES[settings.planningDay]} — planning day!</p>
            <p className="text-sm text-white/80">
              Pick meals for {weekLabel(nextWeek)}.{" "}
              {nextWeekMeals ? `${nextWeekMeals} meal(s) proposed so far.` : "Nothing proposed yet."}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canRepeatNext > 0 && (
              <button className="btn flex-1 border border-white/40 text-white hover:bg-white/10 max-sm:min-h-10 sm:flex-none" onClick={() => repeatLastWeek(nextWeek)}>
                ↻ Repeat this week
              </button>
            )}
            <button className="btn flex-1 bg-white text-leaf-700 hover:bg-white/90 max-sm:min-h-10 sm:flex-none" onClick={() => setStart(nextWeek)}>
              Plan next week →
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink/50">
            {view === "month"
              ? "Calendar"
              : start === thisWeek
                ? "This week"
                : start === nextWeek
                  ? "Next week"
                  : start < thisWeek
                    ? "Past week"
                    : "Upcoming week"}
          </p>
          <h1 className="text-2xl font-extrabold">{view === "month" ? "Pick a day" : weekLabel(start)}</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
          <div className="grid grid-cols-2 rounded-lg bg-black/5 p-1 text-sm font-semibold sm:mr-1 sm:flex" role="tablist" aria-label="Planner view">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 max-sm:min-h-9 ${view === v ? "bg-white shadow-sm" : "text-ink/60 hover:text-ink"}`}
              >
                {v === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          {view === "week" && (
            <div className="flex items-center gap-1">
              {canRepeat > 0 && (
                <button
                  className="btn-outline min-w-0 flex-1 max-sm:min-h-10 sm:flex-none"
                  onClick={() => repeatLastWeek(start)}
                  title="Copy last week's meals into this week's empty slots"
                >
                  <span className="truncate">
                    ↻ Repeat<span className="hidden sm:inline"> last week</span> ({canRepeat})
                  </span>
                </button>
              )}
              <button className="btn-outline max-sm:min-h-10 max-sm:min-w-10 max-sm:px-2" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week" title="Previous week">←</button>
              <button
                className={`btn-outline max-sm:min-h-10 ${canRepeat > 0 ? "" : "max-sm:flex-1"}`}
                onClick={() => {
                  setStart(thisWeek);
                  setPickedDay(fc.today);
                }}
                disabled={start === thisWeek && selectedDay === fc.today}
              >
                Today
              </button>
              <button className="btn-outline max-sm:min-h-10 max-sm:min-w-10 max-sm:px-2" onClick={() => setStart(addDays(start, 7))} aria-label="Next week" title="Next week">→</button>
            </div>
          )}
        </div>
      </div>

      {view === "month" && (
        <MonthCalendar
          initialDate={start}
          onPickDate={(iso) => {
            setStart(weekStart(iso, settings.weekStartDay));
            setPickedDay(iso);
            setView("week");
          }}
        />
      )}

      {view === "week" && (<>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Stat label={STAT_LABEL.planned} value={statMeals.planned.length} onClick={() => setStatList("planned")} />
        <Stat label={STAT_LABEL.votes} value={pendingAgree} tone={pendingAgree ? "amber" : undefined} onClick={() => setStatList("votes")} />
        <Stat label={STAT_LABEL.short} value={shortCount} tone={shortCount ? "red" : undefined} onClick={() => setStatList("short")} />
        <Stat label={STAT_LABEL.cooked} value={statMeals.cooked.length} tone="leaf" onClick={() => setStatList("cooked")} />
      </div>
      {/* Phones: pick one day at a time. */}
      <nav
        aria-label="Pick a day"
        className="sticky z-20 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur sm:hidden"
        style={{ top: stickyTop }}
      >
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isToday = d === fc.today;
            const selected = d === selectedDay;
            const meals = weekMeals.filter((m) => m.date === d).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
            return (
              <button
                key={d}
                type="button"
                onClick={() => setPickedDay(d)}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${dayName(d)}, ${shortDate(d)}${isToday ? " (today)" : ""}: ${
                  meals.length ? `${meals.length} meal${meals.length === 1 ? "" : "s"}` : "no meals"
                }`}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-start gap-0.5 rounded-xl border px-0.5 pt-1.5 pb-1 transition ${
                  selected ? "border-leaf-500 bg-white shadow-sm ring-1 ring-leaf-500" : "border-transparent bg-white/60 active:bg-white"
                } ${d < fc.today && !selected ? "opacity-70" : ""}`}
              >
                <span className={`text-[11px] font-semibold uppercase ${selected || isToday ? "text-leaf-700" : "text-ink/50"}`}>
                  {dayName(d).slice(0, 3)}
                </span>
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-leaf-600 text-white" : selected ? "text-leaf-700" : "text-ink/80"
                  }`}
                >
                  {fromISODate(d).getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                  {meals.slice(0, 4).map((m) => (
                    <Dot key={m.id} mark={markOf(m, fc.isAgreed(m))} short={m.status === "planned" && fc.byMeal.get(m.id)?.readiness === "short"} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Columns follow the space actually available (container queries), so a day never gets squeezed:
          2 on tablets, 3 then 4 on laptops and desktops, all 7 in one row only on very wide screens. */}
      <div className="@container">
      <div
        className="grid gap-3 sm:grid-cols-2 @min-[49rem]:grid-cols-3 @min-[65rem]:grid-cols-4 @min-[112rem]:grid-cols-7"
        onTouchStart={(e) => {
          const t = e.touches[0];
          swipe.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={onSwipeEnd}
      >
        {days.map((d) => {
          const isToday = d === fc.today;
          const dayKcal = dayKcalPerPerson(weekMeals.filter((m) => m.date === d), state.recipes);
          return (
            <section
              key={d}
              className={`card flex-col p-3 ${d === selectedDay ? "flex" : "hidden sm:flex"} ${isToday ? "ring-2 ring-leaf-500" : ""} ${
                d < fc.today ? "opacity-80" : ""
              }`}
            >
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-bold">
                  <span className="sm:hidden">{dayName(d)}</span>
                  <span className="hidden sm:inline">{dayName(d).slice(0, 3)}</span>
                  {isToday && <span className="chip ml-1.5 bg-leaf-100 text-leaf-700">Today</span>}
                </h2>
                <div className="text-right">
                  <p className="text-xs text-ink/50">{shortDate(d)}</p>
                  {dayKcal.known > 0 && (
                    <p
                      className="text-[10px] leading-tight text-ink/40"
                      title={`One serving of each planned meal${
                        dayKcal.unknown > 0 ? `; ${dayKcal.unknown} meal${dayKcal.unknown === 1 ? "" : "s"} without an estimate` : ""
                      }`}
                    >
                      {formatKcal(dayKcal.kcal)}/person
                    </p>
                  )}
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {slots.map((slot) => {
                  const cellKey = `${d}|${slot}`;
                  const meals = weekMeals.filter((m) => m.date === d && m.slot === slot);
                  return (
                    <div
                      key={slot}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(cellKey);
                      }}
                      onDragLeave={() => setDragOver((k) => (k === cellKey ? null : k))}
                      onDrop={(e) => onDrop(e, d, slot)}
                      className={`rounded-xl border border-dashed p-1.5 transition ${
                        dragOver === cellKey ? "border-leaf-500 bg-leaf-50" : "border-transparent"
                      }`}
                    >
                      <p className="mb-1 px-1 text-[10px] font-bold tracking-wider text-ink/40 uppercase">{slot}</p>
                      <div className="space-y-1.5">
                        {meals.map((m) => (
                          <MealCard key={m.id} meal={m} forecast={fc.byMeal.get(m.id)} onEdit={() => setForm({ meal: m, date: m.date, slot: m.slot })} />
                        ))}
                        <button
                          className="w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-ink/40 hover:bg-black/5 hover:text-leaf-700 max-sm:py-2.5 max-sm:text-sm pointer-coarse:min-h-10"
                          onClick={() => setForm({ date: d, slot })}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      </div>
      <p className="hidden text-xs text-ink/50 sm:pointer-fine:block">Tip: drag a meal onto another day or slot to move it.</p>
      <p className="text-xs text-ink/50 sm:pointer-fine:hidden">
        <span className="sm:hidden">Swipe or tap a day above to switch days. </span>Tap a meal&apos;s name to change it or move it to another day.
      </p>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">What we&apos;re missing</h2>
            <p className="text-sm text-ink/60">
              Ingredients the fridge won&apos;t cover for planned meals up to {shortDate(days[6])}, after counting the shopping list.
            </p>
          </div>
          {weekShortfalls.length > 0 && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <div>
                <label className="label" htmlFor="shop-date">Shopping on</label>
                <input id="shop-date" className="input max-sm:min-h-11 max-sm:text-base" type="date" value={shopDate} onChange={(e) => setShopDate(e.target.value)} />
              </div>
              <button className="btn-primary max-sm:min-h-11" onClick={addShortfallsToList}>Add all to list</button>
            </div>
          )}
        </div>
        {weekShortfalls.length === 0 ? (
          <p className="mt-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-700">
            ✓ The fridge and shopping list cover everything planned for this week.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-black/5">
            {weekShortfalls.map((s) => (
              <li key={`${s.name}|${s.unit}`} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 text-sm">
                <span className="min-w-0">
                  <b>{formatAmount(s.quantity, s.unit)}</b> {titleCase(s.name)}
                  <span className="ml-2 text-xs text-ink/50">for {s.meals.join(", ")}</span>
                </span>
                <span className="chip bg-red-50 text-red-700">needed by {dayName(s.neededBy)} {shortDate(s.neededBy)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/fridge" className="mt-3 inline-block py-1 text-sm font-semibold text-leaf-700">Open fridge &amp; shopping list →</Link>
      </section>
      </>)}

      {statList && (
        <Modal title={`${STAT_LABEL[statList]} · ${weekLabel(start)}`} onClose={() => setStatList(null)} wide>
          {statMeals[statList].length === 0 ? (
            <p className="text-sm text-ink/60">Nothing here this week.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {statMeals[statList].map((m) => (
                <li key={m.id}>
                  <button
                    className="w-full rounded-lg px-2 py-2 text-left enabled:hover:bg-black/[0.03] focus-visible:bg-black/[0.03] disabled:cursor-default"
                    disabled={m.status === "cooked"}
                    title={m.status === "cooked" ? "Cooked meals can't be edited. Undo cooked on the meal card first." : undefined}
                    onClick={() => {
                      setStatList(null);
                      setForm({ meal: m, date: m.date, slot: m.slot });
                    }}
                  >
                    <p className="text-xs font-semibold text-ink/50">
                      {dayName(m.date)} {shortDate(m.date)} · {m.slot}
                    </p>
                    <p className="font-semibold">{m.title}</p>
                    <StatDetail kind={statList} meal={m} forecast={fc.byMeal.get(m.id)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {form && <MealForm init={form} onClose={() => setForm(null)} />}
    </div>
  );
}

type StatKind = "planned" | "votes" | "short" | "cooked";
const STAT_LABEL: Record<StatKind, string> = {
  planned: "Meals planned",
  votes: "Waiting on votes",
  short: "Short on food",
  cooked: "Cooked",
};

/** The category-specific detail line for a meal in a stat card's list. */
function StatDetail({ kind, meal, forecast }: { kind: StatKind; meal: Meal; forecast?: MealForecast }) {
  const { state, userName } = useApp();
  const fc = useForecast();
  const count = fc.agreeCount(meal);
  const chores = [meal.cookId && `👩‍🍳 ${userName(meal.cookId)}`, meal.dishesId && `🧽 ${userName(meal.dishesId)}`].filter(Boolean).join(" · ");

  if (kind === "votes") {
    const waiting = state.users.filter((u) => !meal.agreedBy.includes(u.id)).map((u) => userName(u.id));
    return (
      <p className="mt-0.5 text-xs text-amber-800">
        {count}/{state.users.length} agreed (needs {fc.needed}){waiting.length > 0 && ` · waiting on ${waiting.join(", ")}`}
      </p>
    );
  }
  if (kind === "short") {
    return (
      <p className="mt-0.5 text-xs text-red-700">
        {forecast?.missing.length ? (
          <>
            Missing <IngredientList items={forecast.missing} />
          </>
        ) : (
          "Short on ingredients"
        )}
      </p>
    );
  }
  if (kind === "cooked") {
    const by = meal.cookedBy ?? meal.cookId;
    return <p className="mt-0.5 text-xs text-leaf-700">✓ Cooked{by ? ` by ${userName(by)}` : ""}</p>;
  }
  const agreed = fc.isAgreed(meal);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {meal.status === "cooked" ? (
        <span className="chip bg-leaf-100 text-leaf-700">✓ Cooked</span>
      ) : (
        <span className={`chip ${agreed ? "bg-leaf-100 text-leaf-700" : "bg-amber-100 text-amber-800"}`}>
          {agreed ? "Agreed" : "Proposed"} {count}/{state.users.length}
        </span>
      )}
      {meal.status !== "cooked" && forecast?.readiness === "ok" && <span className="chip bg-sky-50 text-sky-700">In fridge</span>}
      {meal.status !== "cooked" && forecast?.readiness === "after-shopping" && <span className="chip bg-violet-50 text-violet-700">After shopping</span>}
      {meal.status !== "cooked" && forecast?.readiness === "short" && <span className="chip bg-red-50 text-red-700">Short</span>}
      {chores && <span className="text-xs text-ink/50">{chores}</span>}
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: "amber" | "red" | "leaf"; onClick: () => void }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : tone === "leaf" ? "text-leaf-700" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Show ${label.toLowerCase()} this week`}
      className="card flex cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:outline-none sm:block sm:px-4 sm:py-3"
    >
      <p className={`text-xl font-extrabold tabular-nums sm:text-2xl ${color}`}>{value}</p>
      <p className="text-xs leading-tight font-semibold text-ink/50">{label}</p>
    </button>
  );
}

function MealCard({ meal, forecast, onEdit }: { meal: Meal; forecast?: MealForecast; onEdit: () => void }) {
  const { state, api, toast, userName } = useApp();
  const fc = useForecast();
  const [busy, setBusy] = useState(false);
  const agreed = fc.isAgreed(meal);
  const iAgreed = meal.agreedBy.includes(state.me.id);
  const count = fc.agreeCount(meal);
  const cooked = meal.status === "cooked";
  const skipped = meal.status === "skipped";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    setBusy(false);
  }

  async function cook() {
    const missing = forecast?.missing ?? [];
    if (!agreed && !confirm(`Only ${count} of ${fc.needed} roommates agreed to this. Mark it cooked anyway?`)) return;
    if (missing.length && !confirm(`The fridge looks short on: ${missing.map((i) => `${formatAmount(i.quantity, i.unit)} ${i.name}`).join(", ")}.\n\nMark as cooked and take what's there?`)) return;
    const r = await api<{ missing: { name: string }[] }>("POST", `/api/meals/${meal.id}/cook`);
    if (r) toast(r.missing.length ? `Cooked! ${r.missing.length} ingredient(s) weren't in the fridge.` : "Cooked! Ingredients taken out of the fridge.");
  }

  async function remove() {
    if (!confirm(`Remove “${meal.title}” from ${dayName(meal.date)} ${meal.slot.toLowerCase()}?`)) return;
    if (await api("DELETE", `/api/meals/${meal.id}`)) toast("Removed from the plan.");
  }

  const readiness = forecast?.readiness;
  const kcal = mealKcal(meal, state.recipes);
  return (
    <div
      draggable={!cooked}
      onDragStart={(e) => e.dataTransfer.setData("text/meal-id", meal.id)}
      className={`group rounded-lg border p-2 text-sm ${
        cooked
          ? "border-leaf-100 bg-leaf-50"
          : skipped
            ? "border-black/5 bg-black/[0.02] text-ink/40 line-through"
            : agreed
              ? "border-black/10 bg-white"
              : "border-dashed border-amber-300 bg-amber-50/50"
      } ${!cooked ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-1">
        <button
          onClick={onEdit}
          className="block min-w-0 flex-1 text-left font-semibold leading-snug break-words hover:text-leaf-700 pointer-coarse:min-h-8 max-sm:text-base"
          disabled={cooked}
        >
          {meal.title}
        </button>
        {meal.status === "planned" && (
          <button
            className="-mt-0.5 -mr-1 flex shrink-0 items-center justify-center rounded px-1 text-xs text-ink/30 hover:bg-red-50 hover:text-red-700 max-sm:-my-1.5 max-sm:size-10 pointer-coarse:-my-1.5 pointer-coarse:size-10 pointer-coarse:text-sm"
            disabled={busy}
            onClick={() => run(remove)}
            aria-label={`Remove ${meal.title}`}
            title="Remove from the plan"
          >
            ✕
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {cooked ? (
          <span className="chip bg-leaf-100 text-leaf-700">✓ Cooked</span>
        ) : skipped ? (
          <span className="chip bg-black/5 text-ink/50">Skipped</span>
        ) : (
          <>
            <span className={`chip ${agreed ? "bg-leaf-100 text-leaf-700" : "bg-amber-100 text-amber-800"}`} title={`${meal.agreedBy.map(userName).join(", ") || "Nobody yet"} · needs ${fc.needed} to count as agreed`}>
              {agreed ? "Agreed" : "Proposed"} {count}/{state.users.length}
            </span>
            {readiness === "ok" && <span className="chip bg-sky-50 text-sky-700">In fridge</span>}
            {readiness === "after-shopping" && <span className="chip bg-violet-50 text-violet-700">After shopping</span>}
            {readiness === "short" && <span className="chip bg-red-50 text-red-700">Short</span>}
          </>
        )}
        {kcal !== null && (
          <span className="chip bg-orange-50 text-orange-800" title="Estimated calories per serving">
            🔥 {formatKcal(kcal)}
          </span>
        )}
      </div>
      {readiness === "short" && !cooked && !skipped && forecast && (
        <p className="mt-1 text-[11px] leading-snug text-red-700">
          Missing <IngredientList items={forecast.missing} />
        </p>
      )}
      {readiness === "after-shopping" && !cooked && !skipped && forecast && (
        <p className="mt-1 text-[11px] leading-snug text-violet-700">
          Needs <IngredientList items={forecast.coveredByShopping} /> from the shopping list
        </p>
      )}
      {(meal.cookId || meal.dishesId || meal.notes) && (
        <p className="mt-1 text-[11px] text-ink/50">
          {[meal.cookId && `👩‍🍳 ${userName(meal.cookId)}`, meal.dishesId && `🧽 ${userName(meal.dishesId)}`].filter(Boolean).join(" · ")}
          {(meal.cookId || meal.dishesId) && meal.notes ? " " : ""}
          {meal.notes}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1 whitespace-nowrap max-sm:mt-2 max-sm:gap-1.5 max-sm:[&>button]:flex-1 pointer-coarse:[&>button]:min-h-10">
        {cooked ? (
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api("DELETE", `/api/meals/${meal.id}/cook`))}>
            Undo cooked
          </button>
        ) : skipped ? (
          <>
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api("PUT", `/api/meals/${meal.id}`, { status: "planned" }))}>Restore</button>
            <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api("DELETE", `/api/meals/${meal.id}`))}>Delete</button>
          </>
        ) : (
          <>
            <button
              className={`btn-sm btn ${iAgreed ? "bg-leaf-100 text-leaf-700 hover:bg-leaf-50" : "border border-black/10 bg-white hover:bg-black/[0.03]"}`}
              disabled={busy}
              onClick={() => run(() => api("POST", `/api/meals/${meal.id}/agree`))}
            >
              {iAgreed ? "✓ Agreed" : "Agree"}
            </button>
            {meal.recipeId ? (
              <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(cook)}>Cooked</button>
            ) : (
              <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api("POST", `/api/meals/${meal.id}/cook`))}>Done</button>
            )}
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api("PUT", `/api/meals/${meal.id}`, { status: "skipped" }))}>Skip</button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Height of the app's sticky top bar (0 if it isn't sticky), so the phone day strip can stick
 * just below it whatever height the bar ends up being.
 */
function useStickyHeaderHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      const header = document.querySelector("header");
      const ro = header ? new ResizeObserver(onChange) : null;
      if (header) ro?.observe(header);
      window.addEventListener("resize", onChange);
      return () => {
        ro?.disconnect();
        window.removeEventListener("resize", onChange);
      };
    },
    () => {
      const header = document.querySelector("header");
      if (!header) return 0;
      const { position } = getComputedStyle(header);
      return position === "sticky" || position === "fixed" ? Math.round(header.getBoundingClientRect().height) : 0;
    },
    () => 0,
  );
}
