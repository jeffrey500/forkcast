"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import MealForm, { type MealFormInit } from "@/components/MealForm";
import { useForecast } from "@/components/useForecast";
import { IngredientList } from "@/components/ui";
import { addDays, DAY_NAMES, dayName, fromISODate, shortDate, weekDays, weekLabel, weekStart } from "@/lib/dates";
import { formatAmount, roundUpQty } from "@/lib/units";
import type { Meal } from "@/lib/types";
import { repeatCandidates, type MealForecast } from "@/lib/inventory";

export default function WeekPage() {
  const { state, api, toast } = useApp();
  const fc = useForecast();
  const { settings } = state;
  const thisWeek = weekStart(fc.today, settings.weekStartDay);
  const [start, setStart] = useState(thisWeek);
  const [form, setForm] = useState<MealFormInit | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [shopDate, setShopDate] = useState(fc.today);

  const days = weekDays(start);
  const nextWeek = addDays(thisWeek, 7);
  const isPlanningDay = fromISODate(fc.today).getDay() === settings.planningDay;
  const weekMeals = state.meals.filter((m) => m.date >= start && m.date <= days[6]);
  const slots = [...settings.mealSlots, ...new Set(weekMeals.map((m) => m.slot).filter((s) => !settings.mealSlots.includes(s)))];

  const weekForecasts = weekMeals.map((m) => fc.byMeal.get(m.id)).filter(Boolean) as MealForecast[];
  const shortCount = weekForecasts.filter((f) => f.readiness === "short").length;
  const pendingAgree = weekMeals.filter((m) => m.status === "planned" && !fc.isAgreed(m)).length;
  const weekShortfalls = fc.shortfalls.filter((s) => s.neededBy <= days[6]);
  const nextWeekMeals = state.meals.filter((m) => m.date >= nextWeek && m.date <= addDays(nextWeek, 6)).length;

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
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-leaf-600 px-5 py-4 text-white shadow-sm">
          <span className="text-2xl">🗳️</span>
          <div className="flex-1">
            <p className="font-bold">It&apos;s {DAY_NAMES[settings.planningDay]} — planning day!</p>
            <p className="text-sm text-white/80">
              Pick meals for {weekLabel(nextWeek)}.{" "}
              {nextWeekMeals ? `${nextWeekMeals} meal(s) proposed so far.` : "Nothing proposed yet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRepeatNext > 0 && (
              <button className="btn border border-white/40 text-white hover:bg-white/10" onClick={() => repeatLastWeek(nextWeek)}>
                ↻ Repeat this week
              </button>
            )}
            <button className="btn bg-white text-leaf-700 hover:bg-white/90" onClick={() => setStart(nextWeek)}>
              Plan next week →
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink/50">
            {start === thisWeek ? "This week" : start === nextWeek ? "Next week" : start < thisWeek ? "Past week" : "Upcoming week"}
          </p>
          <h1 className="text-2xl font-extrabold">{weekLabel(start)}</h1>
        </div>
        <div className="flex flex-wrap gap-1">
          {canRepeat > 0 && (
            <button
              className="btn-outline"
              onClick={() => repeatLastWeek(start)}
              title="Copy last week's meals into this week's empty slots"
            >
              ↻ Repeat last week ({canRepeat})
            </button>
          )}
          <button className="btn-outline" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">←</button>
          <button className="btn-outline" onClick={() => setStart(thisWeek)} disabled={start === thisWeek}>Today</button>
          <button className="btn-outline" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">→</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Meals planned" value={weekMeals.filter((m) => m.status !== "skipped").length} />
        <Stat label="Waiting on votes" value={pendingAgree} tone={pendingAgree ? "amber" : undefined} />
        <Stat label="Short on food" value={shortCount} tone={shortCount ? "red" : undefined} />
        <Stat label="Cooked" value={weekMeals.filter((m) => m.status === "cooked").length} tone="leaf" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {days.map((d) => {
          const isToday = d === fc.today;
          return (
            <section key={d} className={`card flex flex-col p-3 ${isToday ? "ring-2 ring-leaf-500" : ""} ${d < fc.today ? "opacity-80" : ""}`}>
              <header className="mb-2 flex items-baseline justify-between">
                <h2 className="font-bold">
                  {dayName(d).slice(0, 3)}
                  {isToday && <span className="chip ml-1.5 bg-leaf-100 text-leaf-700">Today</span>}
                </h2>
                <p className="text-xs text-ink/50">{shortDate(d)}</p>
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
                          className="w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-ink/40 hover:bg-black/5 hover:text-leaf-700"
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
      <p className="text-xs text-ink/50">Tip: drag a meal onto another day or slot to move it.</p>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">What we&apos;re missing</h2>
            <p className="text-sm text-ink/60">
              Ingredients the fridge won&apos;t cover for planned meals up to {shortDate(days[6])}, after counting the shopping list.
            </p>
          </div>
          {weekShortfalls.length > 0 && (
            <div className="flex items-end gap-2">
              <div>
                <label className="label">Shopping on</label>
                <input className="input" type="date" value={shopDate} onChange={(e) => setShopDate(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={addShortfallsToList}>Add all to list</button>
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
              <li key={`${s.name}|${s.unit}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{formatAmount(s.quantity, s.unit)}</b> {s.name}
                  <span className="ml-2 text-xs text-ink/50">for {s.meals.join(", ")}</span>
                </span>
                <span className="chip bg-red-50 text-red-700">needed by {dayName(s.neededBy)} {shortDate(s.neededBy)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/fridge" className="mt-3 inline-block text-sm font-semibold text-leaf-700">Open fridge &amp; shopping list →</Link>
      </section>

      {form && <MealForm init={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" | "leaf" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : tone === "leaf" ? "text-leaf-700" : "";
  return (
    <div className="card px-4 py-3">
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-ink/50">{label}</p>
    </div>
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

  const readiness = forecast?.readiness;
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
      <button onClick={onEdit} className="block w-full text-left font-semibold leading-snug hover:text-leaf-700" disabled={cooked}>
        {meal.title}
      </button>
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
      {(meal.cookId || meal.notes) && (
        <p className="mt-1 text-[11px] text-ink/50">
          {meal.cookId && <>👩‍🍳 {userName(meal.cookId)} </>}
          {meal.notes}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1 whitespace-nowrap">
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
