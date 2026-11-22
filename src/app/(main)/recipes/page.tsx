"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import MealForm, { type MealFormInit } from "@/components/MealForm";
import { EmptyState, IngredientList, Modal, RecipeForm } from "@/components/ui";
import { useForecast } from "@/components/useForecast";
import RecipeLibrary from "@/components/RecipeLibrary";
import { LIBRARY } from "@/lib/library";
import { consumeFromFridge } from "@/lib/inventory";
import { formatAmount, normalizeName, titleCase } from "@/lib/units";
import { currentNutrition, formatKcal, needsNutrition } from "@/lib/nutrition-shared";
import type { Recipe } from "@/lib/types";

/** How long after a save we show "analysing…" for a recipe that has no estimate yet. */
const ANALYSING_WINDOW_MS = 2 * 60 * 1000;

export default function RecipesPage() {
  const { state, api, toast, userName, refresh } = useApp();
  const fc = useForecast();
  const hasKey = state.settings.claudeKeySource !== "none";
  const [now, setNow] = useState(() => Date.now());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analysing, setAnalysing] = useState(false);

  // Keep "analysing…" hints honest: re-evaluate the 2-minute window every 15 s.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(t);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [planning, setPlanning] = useState<MealFormInit | null>(null);
  const [tab, setTab] = useState<"ours" | "library">(state.recipes.length ? "ours" : "library");

  const names = useMemo(() => {
    // One entry per item regardless of case/plural ("eggs", "Egg" → "Egg").
    const byKey = new Map<string, string>();
    const add = (n: string) => {
      const key = normalizeName(n);
      if (key && !byKey.has(key)) byKey.set(key, titleCase(n));
    };
    state.recipes.forEach((r) => r.ingredients.forEach((i) => add(i.name)));
    state.fridge.forEach((f) => add(f.name));
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [state.recipes, state.fridge]);

  const tags = [...new Set(state.recipes.flatMap((r) => r.tags))].sort();

  /** What each recipe would be missing if cooked right now. */
  const missingNow = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of state.recipes) {
      m.set(r.id, consumeFromFridge(state.fridge, r.ingredients, state.settings.staples, "").missing.length);
    }
    return m;
  }, [state.recipes, state.fridge, state.settings.staples]);

  const shown = state.recipes
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => {
      const q = query.trim().toLowerCase();
      return !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  async function save(draft: Omit<Recipe, "id" | "createdBy" | "createdAt" | "updatedAt">) {
    const ok =
      editing === "new"
        ? await api("POST", "/api/recipes", draft)
        : editing && (await api("PUT", `/api/recipes/${editing.id}`, draft));
    if (ok) {
      toast("Recipe saved.");
      setEditing(null);
      setViewing(null);
      setNow(Date.now());
      // The server estimates calories in the background; pick the result up once without a reload.
      if (hasKey) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null;
          setNow(Date.now());
          refresh();
        }, 8000);
      }
    }
  }

  async function analyse(r: Recipe) {
    setAnalysing(true);
    const res = await api<{ recipe: Recipe }>("POST", `/api/recipes/${r.id}/nutrition`);
    setAnalysing(false);
    const n = res?.recipe?.nutrition;
    if (res) toast(n ? `Calories estimated: ${formatKcal(n.kcal)} per serving.` : "Calories estimated.");
  }

  // Show the latest copy of the open recipe (e.g. after a re-analysis).
  const viewed = viewing ? (state.recipes.find((r) => r.id === viewing.id) ?? viewing) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Recipes</h1>
          <p className="text-sm text-ink/60">The meals your household makes. Ingredients here drive the fridge math.</p>
        </div>
        <button className="btn-primary max-sm:min-h-10" onClick={() => setEditing("new")}>+ New recipe</button>
      </div>

      <div className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_rgb(0_0_0/0.1)] [scrollbar-width:none]" role="tablist">
        {([
          ["ours", `Our recipes (${state.recipes.length})`],
          ["library", `Recipe library (${LIBRARY.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap max-sm:py-2.5 ${tab === key ? "border-leaf-600 text-leaf-700" : "border-transparent text-ink/50 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "library" && (
        <RecipeLibrary onPlan={(r) => setPlanning({ date: fc.today, slot: state.settings.mealSlots.at(-1) ?? "Dinner", recipeId: r.id })} />
      )}

      {tab === "ours" && (<>

      {state.recipes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input className="input sm:max-w-xs" placeholder="Search by name or ingredient…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex gap-1 max-sm:w-full max-sm:overflow-x-auto max-sm:pb-1 max-sm:[scrollbar-width:none] sm:flex-wrap">
            <button className={`chip shrink-0 px-3 py-1.5 text-xs whitespace-nowrap max-sm:py-2 ${!tag ? "bg-ink text-white" : "bg-white"}`} onClick={() => setTag("")}>All</button>
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
        </div>
      )}

      {state.recipes.length === 0 ? (
        <EmptyState icon="📖" title="No recipes yet">
          Add the meals you usually cook, pick some from the{" "}
          <button className="font-semibold text-leaf-700 underline" onClick={() => setTab("library")}>recipe library</button>, or ask Claude for ideas.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1900px]:grid-cols-4">
          {shown.map((r) => {
            const missing = missingNow.get(r.id) ?? 0;
            const nutrition = currentNutrition(r);
            const pending =
              !nutrition && hasKey && needsNutrition(r) && now - Date.parse(r.updatedAt) < ANALYSING_WINDOW_MS;
            return (
              <button key={r.id} onClick={() => setViewing(r)} className="card p-4 text-left transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 font-bold">{r.name}</h3>
                  {missing === 0 ? (
                    <span className="chip shrink-0 bg-sky-50 text-sky-700">Can make now</span>
                  ) : (
                    <span className="chip shrink-0 bg-black/5 text-ink/60">Missing {missing}</span>
                  )}
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{r.description}</p>}
                <p className="mt-2 text-xs text-ink/50">
                  Serves {r.servings} · {r.ingredients.length} ingredients
                  {nutrition && <span title="Estimated calories per serving"> · {formatKcal(nutrition.kcal)}/serving</span>}
                  {pending && <span className="text-ink/40"> · Calories: analysing…</span>}
                </p>
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="chip bg-leaf-50 text-leaf-700">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      </>)}

      {viewed && !editing && (
        <Modal title={viewed.name} onClose={() => setViewing(null)} wide>
          {viewed.description && <p className="text-sm text-ink/70">{viewed.description}</p>}
          <p className="mt-1 text-xs text-ink/50">
            Serves {viewed.servings} · added by {userName(viewed.createdBy)}
          </p>
          <h3 className="mt-4 mb-1 text-sm font-bold">Ingredients</h3>
          <ul className="space-y-0.5 text-sm">
            {viewed.ingredients.map((i, idx) => (
              <li key={idx}>
                <b>{formatAmount(i.quantity, i.unit)}</b> {titleCase(i.name)}
              </li>
            ))}
          </ul>
          {(() => {
            const miss = consumeFromFridge(state.fridge, viewed.ingredients, state.settings.staples, "").missing;
            return miss.length ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                Not in the fridge right now: <IngredientList items={miss} />
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">Everything is in the fridge right now.</p>
            );
          })()}
          <NutritionBlock recipe={viewed} hasKey={hasKey} busy={analysing} onAnalyse={() => analyse(viewed)} />
          {viewed.instructions && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">Instructions</h3>
              <p className="text-sm whitespace-pre-wrap text-ink/80">{viewed.instructions}</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <button
              className="btn-danger max-sm:min-h-10"
              onClick={async () => {
                if (!confirm(`Delete “${viewed.name}”?`)) return;
                if (await api("DELETE", `/api/recipes/${viewed.id}`)) {
                  toast("Recipe deleted.");
                  setViewing(null);
                }
              }}
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button className="btn-outline max-sm:min-h-10" onClick={() => setEditing(viewed)}>Edit</button>
              <button
                className="btn-primary max-sm:min-h-10"
                onClick={() => {
                  setPlanning({ date: fc.today, slot: state.settings.mealSlots.at(-1) ?? "Dinner", recipeId: viewed.id });
                  setViewing(null);
                }}
              >
                Add to plan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New recipe" : `Edit ${editing.name}`} onClose={() => setEditing(null)} wide>
          <RecipeForm initial={editing === "new" ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} nameOptions={names} />
        </Modal>
      )}

      {planning && <MealForm init={planning} onClose={() => setPlanning(null)} />}
    </div>
  );
}

const SOURCE_LABEL: Record<NonNullable<Recipe["nutrition"]>["source"], string> = {
  claude: "Estimated by Claude",
  library: "Built-in estimate",
  idea: "From Claude's idea",
};

function NutritionBlock({ recipe, hasKey, busy, onAnalyse }: { recipe: Recipe; hasKey: boolean; busy: boolean; onAnalyse: () => void }) {
  const n = recipe.nutrition;
  const stale = !!n && needsNutrition(recipe);
  return (
    <div className="mt-4 rounded-lg bg-black/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Nutrition per serving (estimate)</h3>
        <button
          type="button"
          className="btn-outline btn-sm max-sm:min-h-9"
          disabled={!hasKey || busy || recipe.ingredients.length === 0}
          title={!hasKey ? "Add a Claude API key in Admin → Settings to analyse calories" : "Ask Claude to estimate calories and macros (one request)"}
          onClick={onAnalyse}
        >
          {busy ? "Analysing…" : n ? "Re-analyse" : "Analyse calories"}
        </button>
      </div>
      {n ? (
        <>
          <dl className={`mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm ${stale ? "text-ink/50" : ""}`}>
            <div><dt className="inline text-ink/50">Calories </dt><dd className="inline font-semibold">{formatKcal(n.kcal)}</dd></div>
            <div><dt className="inline text-ink/50">Protein </dt><dd className="inline font-semibold">{Math.round(n.protein)} g</dd></div>
            <div><dt className="inline text-ink/50">Carbs </dt><dd className="inline font-semibold">{Math.round(n.carbs)} g</dd></div>
            <div><dt className="inline text-ink/50">Fat </dt><dd className="inline font-semibold">{Math.round(n.fat)} g</dd></div>
          </dl>
          <p className="mt-0.5 text-xs text-ink/50">
            {SOURCE_LABEL[n.source] ?? "Estimate"}
            {stale && <span className="text-amber-800"> · Ingredients changed since this estimate</span>}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink/50">
          {hasKey ? "No estimate yet." : "No estimate yet. Calories are estimated by Claude once an API key is added."}
        </p>
      )}
    </div>
  );
}
