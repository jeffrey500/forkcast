"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { formatAmount, titleCase } from "@/lib/units";
import { formatKcal } from "@/lib/nutrition-shared";
import { APP_NAME, type Ingredient } from "@/lib/types";

interface Idea {
  name: string;
  description: string;
  servings: number;
  prepMinutes: number;
  ingredients: Ingredient[];
  instructions: string;
  usesFromFridge: string[];
  needToBuy: string[];
  tags: string[];
  /** Per-serving estimates (may be missing from older responses). */
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const PROMPTS = [
  "Something cozy and cheap",
  "High-protein dinners we can batch cook",
  "Use up whatever is about to go off",
  "Quick lunches under 20 minutes",
  "Vegetarian, but filling",
];

export default function IdeasPage() {
  const { state, api, toast } = useApp();
  const [prompt, setPrompt] = useState("");
  const [useFridge, setUseFridge] = useState(true);
  const [count, setCount] = useState(3);
  const [servings, setServings] = useState(Math.max(2, state.users.length));
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  // The demo has no Claude key; it answers with samples from the built-in library instead.
  const noKey = state.settings.claudeKeySource === "none" && !state.demo;

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, useFridge, count, servings }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Claude couldn't come up with anything.");
      return;
    }
    setIdeas(data.ideas ?? []);
    setSaved(new Set());
  }

  async function save(idea: Idea) {
    const ok = await api("POST", "/api/recipes", {
      name: idea.name,
      description: idea.description,
      servings: idea.servings,
      ingredients: idea.ingredients,
      instructions: idea.instructions,
      tags: [...idea.tags, "from-claude"],
      ...(isNum(idea.kcal) && isNum(idea.protein) && isNum(idea.carbs) && isNum(idea.fat)
        ? { nutrition: { kcal: idea.kcal, protein: idea.protein, carbs: idea.carbs, fat: idea.fat, source: "idea" } }
        : {}),
    });
    if (ok) {
      setSaved((s) => new Set(s).add(idea.name));
      toast(`Saved “${idea.name}” to recipes.`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Ask Claude for ideas</h1>
        <p className="text-sm text-ink/60">Describe what you&apos;re craving. Claude can look at what&apos;s in the fridge and avoids recipes you already have.</p>
      </div>

      {state.demo && (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>Demo:</b> ideas here are samples from the built-in recipe library. In your own {APP_NAME}, Claude writes them from your
          request and what&apos;s in the fridge.
        </div>
      )}

      {noKey && (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>No Claude API key yet.</b>{" "}
          {state.me.role === "admin" ? (
            <>Add one under <Link className="font-semibold underline" href="/admin">Admin → Settings</Link>.</>
          ) : (
            "Ask an admin to add one in Admin → Settings."
          )}
        </div>
      )}

      <form onSubmit={ask} className="card space-y-4 p-4 sm:p-5">
        <textarea
          className="input min-h-24 text-base"
          placeholder="e.g. something with the leftover chicken, nothing too spicy"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {PROMPTS.map((p) => (
            <button type="button" key={p} className="chip bg-black/5 px-3 py-1.5 text-left text-xs hover:bg-leaf-100 max-sm:py-2" onClick={() => setPrompt(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium max-sm:min-h-10">
            <input type="checkbox" checked={useFridge} onChange={(e) => setUseFridge(e.target.checked)} className="h-5 w-5 shrink-0 accent-leaf-600 sm:h-4 sm:w-4" />
            Use what&apos;s in our fridge ({state.fridge.length} items)
          </label>
          <div>
            <label className="label">Ideas</label>
            <select className="input w-20 max-sm:w-full" value={count} onChange={(e) => setCount(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Servings</label>
            <input className="input w-20 max-sm:w-full" type="number" min={1} max={12} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 1)} />
          </div>
          <button className="btn-primary col-span-2 max-sm:min-h-11 sm:ml-auto" disabled={busy || noKey}>
            {busy ? "Thinking…" : "✨ Get ideas"}
          </button>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>

      {busy && <p className="text-center text-sm text-ink/50">Claude is cooking up some ideas — this can take a little while…</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ideas.map((idea) => (
          <article key={idea.name} className="card flex flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 text-lg font-bold">{idea.name}</h2>
              <span className="chip shrink-0 bg-black/5 text-ink/60">{idea.prepMinutes} min</span>
            </div>
            <p className="mt-1 text-sm text-ink/70">{idea.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {isNum(idea.kcal) && (
                <span className="chip bg-orange-50 text-orange-800" title="Estimated per serving">
                  {formatKcal(idea.kcal)}
                  {isNum(idea.protein) && ` · ${Math.round(idea.protein)}g protein`}
                </span>
              )}
              {idea.tags.map((t) => (
                <span key={t} className="chip bg-leaf-50 text-leaf-700">{t}</span>
              ))}
            </div>
            {idea.usesFromFridge.length > 0 && (
              <p className="mt-3 text-xs text-sky-700"><b>From the fridge:</b> {idea.usesFromFridge.map(titleCase).join(", ")}</p>
            )}
            {idea.needToBuy.length > 0 && (
              <p className="mt-1 text-xs text-red-700"><b>Need to buy:</b> {idea.needToBuy.map(titleCase).join(", ")}</p>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink/70">Ingredients &amp; steps (serves {idea.servings})</summary>
              <ul className="mt-2 space-y-0.5">
                {idea.ingredients.map((i, idx) => (
                  <li key={idx}><b>{formatAmount(i.quantity, i.unit)}</b> {titleCase(i.name)}</li>
                ))}
              </ul>
              <p className="mt-2 whitespace-pre-wrap text-ink/80">{idea.instructions}</p>
            </details>
            <div className="mt-auto pt-4">
              <button className="btn-primary w-full max-sm:min-h-11" disabled={saved.has(idea.name)} onClick={() => save(idea)}>
                {saved.has(idea.name) ? "✓ Saved to recipes" : "Save as recipe"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
