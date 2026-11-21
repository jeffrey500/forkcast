"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import MealForm, { type MealFormInit } from "@/components/MealForm";
import { EmptyState, IngredientList, Modal, RecipeForm } from "@/components/ui";
import { useForecast } from "@/components/useForecast";
import RecipeLibrary from "@/components/RecipeLibrary";
import { LIBRARY } from "@/lib/library";
import { consumeFromFridge } from "@/lib/inventory";
import { formatAmount } from "@/lib/units";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const { state, api, toast, userName } = useApp();
  const fc = useForecast();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [planning, setPlanning] = useState<MealFormInit | null>(null);
  const [tab, setTab] = useState<"ours" | "library">(state.recipes.length ? "ours" : "library");

  const names = useMemo(() => {
    const s = new Set<string>();
    state.recipes.forEach((r) => r.ingredients.forEach((i) => s.add(i.name)));
    state.fridge.forEach((f) => s.add(f.name));
    return [...s].sort();
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
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Recipes</h1>
          <p className="text-sm text-ink/60">The meals your household makes. Ingredients here drive the fridge math.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing("new")}>+ New recipe</button>
      </div>

      <div className="flex gap-1 border-b border-black/10" role="tablist">
        {([
          ["ours", `Our recipes (${state.recipes.length})`],
          ["library", `Recipe library (${LIBRARY.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? "border-leaf-600 text-leaf-700" : "border-transparent text-ink/50 hover:text-ink"}`}
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
          <input className="input max-w-xs" placeholder="Search by name or ingredient…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            <button className={`chip px-3 py-1.5 text-xs ${!tag ? "bg-ink text-white" : "bg-white"}`} onClick={() => setTag("")}>All</button>
            {tags.map((t) => (
              <button key={t} className={`chip px-3 py-1.5 text-xs ${tag === t ? "bg-ink text-white" : "bg-white"}`} onClick={() => setTag(tag === t ? "" : t)}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const missing = missingNow.get(r.id) ?? 0;
            return (
              <button key={r.id} onClick={() => setViewing(r)} className="card p-4 text-left transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{r.name}</h3>
                  {missing === 0 ? (
                    <span className="chip shrink-0 bg-sky-50 text-sky-700">Can make now</span>
                  ) : (
                    <span className="chip shrink-0 bg-black/5 text-ink/60">Missing {missing}</span>
                  )}
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{r.description}</p>}
                <p className="mt-2 text-xs text-ink/50">
                  Serves {r.servings} · {r.ingredients.length} ingredients
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

      {viewing && !editing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)} wide>
          {viewing.description && <p className="text-sm text-ink/70">{viewing.description}</p>}
          <p className="mt-1 text-xs text-ink/50">
            Serves {viewing.servings} · added by {userName(viewing.createdBy)}
          </p>
          <h3 className="mt-4 mb-1 text-sm font-bold">Ingredients</h3>
          <ul className="space-y-0.5 text-sm">
            {viewing.ingredients.map((i, idx) => (
              <li key={idx}>
                <b>{formatAmount(i.quantity, i.unit)}</b> {i.name}
              </li>
            ))}
          </ul>
          {(() => {
            const miss = consumeFromFridge(state.fridge, viewing.ingredients, state.settings.staples, "").missing;
            return miss.length ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                Not in the fridge right now: <IngredientList items={miss} />
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">Everything is in the fridge right now.</p>
            );
          })()}
          {viewing.instructions && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">Instructions</h3>
              <p className="text-sm whitespace-pre-wrap text-ink/80">{viewing.instructions}</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <button
              className="btn-danger"
              onClick={async () => {
                if (!confirm(`Delete “${viewing.name}”?`)) return;
                if (await api("DELETE", `/api/recipes/${viewing.id}`)) {
                  toast("Recipe deleted.");
                  setViewing(null);
                }
              }}
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button className="btn-outline" onClick={() => setEditing(viewing)}>Edit</button>
              <button
                className="btn-primary"
                onClick={() => {
                  setPlanning({ date: fc.today, slot: state.settings.mealSlots.at(-1) ?? "Dinner", recipeId: viewing.id });
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
