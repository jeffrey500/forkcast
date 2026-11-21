"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { Modal } from "./ui";
import { consumeFromFridge } from "@/lib/inventory";
import { LIBRARY, MEAL_LABEL, libraryToRecipe, type LibraryRecipe } from "@/lib/library";
import { formatAmount, titleCase } from "@/lib/units";
import { formatKcal } from "@/lib/nutrition-shared";
import type { Recipe } from "@/lib/types";

type MealFilter = "all" | "lunch" | "dinner";

/** Browse the built-in library and copy recipes into the household's own recipes. */
export default function RecipeLibrary({ onPlan }: { onPlan: (recipe: Recipe) => void }) {
  const { state, api, toast } = useApp();
  const [meal, setMeal] = useState<MealFilter>("all");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<LibraryRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const householdSize = Math.max(2, state.users.length);

  const added = useMemo(() => {
    const m = new Map<string, Recipe>();
    for (const r of state.recipes) if (r.libraryId) m.set(r.libraryId, r);
    return m;
  }, [state.recipes]);

  const missing = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of LIBRARY) m.set(r.id, consumeFromFridge(state.fridge, r.ingredients, state.settings.staples, "").missing.length);
    return m;
  }, [state.fridge, state.settings.staples]);

  const tags = [...new Set(LIBRARY.flatMap((r) => r.tags))].sort();
  const shown = LIBRARY.filter((r) => meal === "all" || r.meal === meal || r.meal === "either")
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => {
      const q = query.trim().toLowerCase();
      return !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q));
    })
    // Things you can make with what's in the fridge first.
    .sort((a, b) => (missing.get(a.id) ?? 0) - (missing.get(b.id) ?? 0) || a.minutes - b.minutes);

  async function add(r: LibraryRecipe, thenPlan: boolean) {
    const existing = added.get(r.id);
    if (existing) {
      if (thenPlan) onPlan(existing);
      return;
    }
    setBusy(true);
    const res = await api<{ recipe: Recipe }>("POST", "/api/recipes", libraryToRecipe(r, householdSize));
    setBusy(false);
    if (!res) return;
    toast(`Added “${r.name}” to your recipes.`);
    if (thenPlan) {
      setOpen(null);
      onPlan(res.recipe);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-black/5 p-1 text-sm font-semibold max-sm:w-full">
          {(["all", "lunch", "dinner"] as const).map((m) => (
            <button key={m} onClick={() => setMeal(m)} className={`rounded-md px-3 py-1.5 capitalize max-sm:flex-1 max-sm:py-2 ${meal === m ? "bg-white shadow-sm" : "text-ink/60"}`}>
              {m === "all" ? "All" : m}
            </button>
          ))}
        </div>
        <input className="input sm:max-w-xs" placeholder="Search by name or ingredient…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex gap-1 max-sm:overflow-x-auto max-sm:pb-1 max-sm:[scrollbar-width:none] sm:flex-wrap">
        <button className={`chip shrink-0 px-3 py-1.5 text-xs whitespace-nowrap max-sm:py-2 ${!tag ? "bg-ink text-white" : "bg-white"}`} onClick={() => setTag("")}>Any</button>
        {tags.map((t) => (
          <button
            key={t}
            className={`chip shrink-0 px-3 py-1.5 text-xs whitespace-nowrap max-sm:py-2 ${tag === t ? "bg-ink text-white" : "bg-white"}`}
            onClick={() => setTag(tag === t ? "" : t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/50">
        {shown.length} easy, healthy recipes. Ones you can make with what&apos;s in the fridge come first. Adding one copies it into your recipes, sized for {householdSize}.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => {
          const miss = missing.get(r.id) ?? 0;
          const isAdded = added.has(r.id);
          return (
            <article key={r.id} className="card flex flex-col p-4">
              <button className="text-left" onClick={() => setOpen(r)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 font-bold hover:text-leaf-700">{r.name}</h3>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="chip bg-black/5 text-ink/60">{r.minutes} min</span>
                    {r.nutrition && (
                      <span className="chip bg-orange-50 text-orange-800" title="Estimated calories per serving">
                        {formatKcal(r.nutrition.kcal)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink/60">{r.description}</p>
              </button>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="chip bg-amber-50 text-amber-800">{MEAL_LABEL[r.meal]}</span>
                {miss === 0 ? (
                  <span className="chip bg-sky-50 text-sky-700">Can make now</span>
                ) : (
                  <span className="chip bg-black/5 text-ink/60">Missing {miss}</span>
                )}
                {r.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip bg-leaf-50 text-leaf-700">{t}</span>
                ))}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <button className={`${isAdded ? "btn-outline" : "btn-primary"} btn-sm flex-1 max-sm:min-h-10 max-sm:text-sm`} disabled={busy || isAdded} onClick={() => add(r, false)}>
                  {isAdded ? "✓ In our recipes" : "+ Add to our recipes"}
                </button>
                <button className="btn-ghost btn-sm max-sm:min-h-10 max-sm:px-3 max-sm:text-sm" onClick={() => setOpen(r)}>View</button>
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} wide>
          <p className="text-sm text-ink/70">{open.description}</p>
          <p className="mt-1 text-xs text-ink/50">
            {MEAL_LABEL[open.meal]} · {open.minutes} min · quantities below serve {open.servings}
          </p>
          {open.nutrition && (
            <p className="mt-2 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-ink/70" title="Built-in estimate">
              <b>Per serving (estimate):</b> {formatKcal(open.nutrition.kcal)} · {Math.round(open.nutrition.protein)} g protein ·{" "}
              {Math.round(open.nutrition.carbs)} g carbs · {Math.round(open.nutrition.fat)} g fat
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-bold">Ingredients</h3>
              <ul className="space-y-0.5 text-sm">
                {open.ingredients.map((ing) => {
                  const have = consumeFromFridge(state.fridge, [ing], state.settings.staples, "").missing.length === 0;
                  return (
                    <li key={ing.name} className={have ? "" : "text-red-700"}>
                      {have ? "✓ " : "· "}
                      <b>{formatAmount(ing.quantity, ing.unit)}</b> {titleCase(ing.name)}
                    </li>
                  );
                })}
              </ul>
              {open.pantry.length > 0 && <p className="mt-2 text-xs text-ink/50">From the pantry (not tracked): {open.pantry.join(", ")}</p>}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold">Steps</h3>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-ink/80">
                {open.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {added.has(open.id) ? (
              <span className="btn text-leaf-700 max-sm:min-h-10 max-sm:flex-1">✓ In our recipes</span>
            ) : (
              <button className="btn-outline max-sm:min-h-10 max-sm:flex-1" disabled={busy} onClick={() => add(open, false)}>+ Add to our recipes</button>
            )}
            <button className="btn-primary max-sm:min-h-10 max-sm:flex-1" disabled={busy} onClick={() => add(open, true)}>
              {added.has(open.id) ? "Add to plan" : "Add & plan it"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
