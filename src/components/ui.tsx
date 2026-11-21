"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatAmount, titleCase } from "@/lib/units";

// How many modals are open, so nested ones don't unlock page scrolling too early.
let openModals = 0;
let savedOverflow = "";

/** Stops the page behind an open modal from scrolling; restores it when the last modal closes. */
function useScrollLock() {
  useEffect(() => {
    const body = document.body;
    if (openModals++ === 0) {
      savedOverflow = body.style.overflow;
      body.style.overflow = "hidden";
    }
    return () => {
      if (--openModals === 0) body.style.overflow = savedOverflow;
    };
  }, []);
}

/** A dialog: a bottom sheet on phones, a centred card from the `sm` breakpoint up. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useScrollLock();
  // Render at the end of <body> so no page element (e.g. the phone bottom nav) can sit on top of it.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center overscroll-contain bg-black/30 p-0 sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        className={`card flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none border-b-0 sm:max-h-[92vh] sm:rounded-2xl sm:border-b ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 pb-3 sm:pt-5 sm:pb-4">
          <h2 className="min-w-0 text-lg font-bold">{title}</h2>
          <button type="button" className="btn-ghost btn-sm min-w-9 shrink-0" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function IngredientList({ items, className = "" }: { items: Ingredient[]; className?: string }) {
  return (
    <span className={className}>
      {items.map((i, idx) => (
        <span key={idx}>
          {idx > 0 && ", "}
          {formatAmount(i.quantity, i.unit)} {titleCase(i.name)}
        </span>
      ))}
    </span>
  );
}

const UNITS = ["", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "can", "bunch", "clove", "slice", "pack"];

export function UnitInput({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <>
      <input
        className={`input ${className}`}
        list="unit-options"
        value={value}
        placeholder="unit"
        onChange={(e) => onChange(e.target.value)}
        aria-label="Unit"
      />
      <datalist id="unit-options">
        {UNITS.filter(Boolean).map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}

export function IngredientEditor({
  value,
  onChange,
  nameOptions = [],
}: {
  value: Ingredient[];
  onChange: (v: Ingredient[]) => void;
  nameOptions?: string[];
}) {
  const set = (i: number, patch: Partial<Ingredient>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <datalist id="ingredient-names">
        {nameOptions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {value.map((ing, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input w-20 shrink-0 max-sm:w-14 max-sm:px-2"
            type="number"
            min="0"
            step="any"
            value={Number.isFinite(ing.quantity) ? ing.quantity : ""}
            onChange={(e) => set(i, { quantity: parseFloat(e.target.value) })}
            aria-label="Quantity"
          />
          <UnitInput className="w-24 shrink-0 max-sm:w-20 max-sm:px-2" value={ing.unit} onChange={(u) => set(i, { unit: u })} />
          <input
            className="input min-w-0"
            list="ingredient-names"
            placeholder="ingredient"
            value={ing.name}
            onChange={(e) => set(i, { name: e.target.value })}
            aria-label="Ingredient name"
          />
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0 max-sm:px-1.5"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remove ingredient"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn-outline btn-sm" onClick={() => onChange([...value, { name: "", quantity: 1, unit: "" }])}>
        + Ingredient
      </button>
    </div>
  );
}

export type RecipeDraft = Pick<Recipe, "name" | "description" | "servings" | "ingredients" | "instructions" | "tags">;

export function RecipeForm({
  initial,
  onSave,
  onCancel,
  nameOptions,
}: {
  initial?: Partial<RecipeDraft>;
  onSave: (r: RecipeDraft) => Promise<void> | void;
  onCancel: () => void;
  nameOptions: string[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(initial?.servings ?? 3);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial?.ingredients ?? [{ name: "", quantity: 1, unit: "" }]);
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({
      name,
      description,
      servings,
      ingredients: ingredients.filter((i) => i.name.trim()),
      instructions,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Serves</label>
          <input className="input" type="number" min={1} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 1)} />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Ingredients</label>
        <IngredientEditor value={ingredients} onChange={setIngredients} nameOptions={nameOptions} />
      </div>
      <div>
        <label className="label">Instructions</label>
        <textarea className="input min-h-28" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div>
        <label className="label">Tags (comma separated)</label>
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="quick, vegetarian" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save recipe"}</button>
      </div>
    </form>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-2 font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-ink/60">{children}</div>}
    </div>
  );
}
