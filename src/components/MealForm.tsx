"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { Modal } from "./ui";
import { addDays, dayName, shortDate } from "@/lib/dates";
import type { Meal } from "@/lib/types";

export interface MealFormInit {
  meal?: Meal;
  date: string;
  slot: string;
  recipeId?: string;
}

/** Add or edit a meal on the plan. */
export default function MealForm({ init, onClose }: { init: MealFormInit; onClose: () => void }) {
  const { state, api } = useApp();
  const { meal } = init;
  const [mode, setMode] = useState<"recipe" | "free">(meal && !meal.recipeId ? "free" : "recipe");
  const [recipeId, setRecipeId] = useState(meal?.recipeId ?? init.recipeId ?? "");
  const [title, setTitle] = useState(meal && !meal.recipeId ? meal.title : "");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(meal?.date ?? init.date);
  const [slot, setSlot] = useState(meal?.slot ?? init.slot);
  const [servings, setServings] = useState<number | "">(meal?.servings ?? "");
  const [cookId, setCookId] = useState(meal?.cookId ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const recipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...state.recipes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)));
  }, [state.recipes, search]);

  const selected = state.recipes.find((r) => r.id === recipeId);
  const slots = state.settings.mealSlots.includes(slot) ? state.settings.mealSlots : [...state.settings.mealSlots, slot];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      date,
      slot,
      recipeId: mode === "recipe" ? recipeId : "",
      title: mode === "free" ? title : undefined,
      servings: servings === "" ? (selected?.servings ?? 1) : servings,
      cookId,
      notes,
    };
    const ok = meal ? await api("PUT", `/api/meals/${meal.id}`, payload) : await api("POST", "/api/meals", payload);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={meal ? "Edit meal" : "Add a meal"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex rounded-lg bg-black/5 p-1 text-sm font-semibold">
          {(["recipe", "free"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 ${mode === m ? "bg-white shadow-sm" : "text-ink/60"}`}
            >
              {m === "recipe" ? "From a recipe" : "Something else"}
            </button>
          ))}
        </div>

        {mode === "recipe" ? (
          <div>
            <label className="label">Recipe</label>
            {state.recipes.length === 0 ? (
              <p className="text-sm text-ink/60">No recipes yet. Add some on the Recipes page, or use “Something else”.</p>
            ) : (
              <>
                <input className="input mb-2" placeholder="Search recipes or tags…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-1">
                  {recipes.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRecipeId(r.id)}
                      className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                        r.id === recipeId ? "bg-leaf-100 font-semibold text-leaf-700" : "hover:bg-black/5"
                      }`}
                    >
                      {r.name}
                      <span className="ml-2 text-xs text-ink/50">serves {r.servings}</span>
                    </button>
                  ))}
                  {recipes.length === 0 && <p className="px-3 py-2 text-sm text-ink/50">No matches.</p>}
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <label className="label">What are you eating?</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eating out, leftovers, takeout…" />
            <p className="mt-1 text-xs text-ink/50">Doesn&apos;t use anything from the fridge.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Day</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <p className="mt-1 text-xs text-ink/50">{date && `${dayName(date)}, ${shortDate(date)}`}</p>
          </div>
          <div>
            <label className="label">Slot</label>
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Servings</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder={selected ? String(selected.servings) : "1"}
              value={servings}
              onChange={(e) => setServings(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="label">Who&apos;s cooking</label>
            <select className="input" value={cookId} onChange={(e) => setCookId(e.target.value)}>
              <option value="">Not decided</option>
              {state.users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        {meal && meal.recipeId !== (mode === "recipe" ? recipeId || null : null) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Changing the dish resets everyone&apos;s agreement.</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))}>← Day</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, 1))}>Day →</button>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy || (mode === "recipe" ? !recipeId : !title.trim())}>
              {busy ? "Saving…" : meal ? "Save" : "Add to plan"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
