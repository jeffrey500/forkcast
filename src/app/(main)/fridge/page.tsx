"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useForecast } from "@/components/useForecast";
import { EmptyState, UnitInput } from "@/components/ui";
import ReceiptScanner from "@/components/ReceiptScanner";
import { addDays, dayName, shortDate } from "@/lib/dates";
import { mealIngredients, type Shortfall } from "@/lib/inventory";
import { convert, formatAmount, normalizeName, roundUpQty, titleCase } from "@/lib/units";
import type { FridgeItem, ShoppingItem } from "@/lib/types";

export default function FridgePage() {
  const { state, api, toast, userName } = useApp();
  const fc = useForecast();
  const [scanning, setScanning] = useState(false);

  const ingredientNames = useMemo(() => {
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

  /** How much of each fridge item planned meals will use. */
  const plannedUse = useMemo(() => {
    const out = new Map<string, number>();
    for (const m of state.meals) {
      if (m.status !== "planned") continue;
      for (const ing of mealIngredients(m, state.recipes)) {
        const f = state.fridge.find((x) => normalizeName(x.name) === normalizeName(ing.name) && convert(1, ing.unit, x.unit) !== null);
        if (f) out.set(f.id, (out.get(f.id) ?? 0) + (convert(ing.quantity, ing.unit, f.unit) ?? 0));
      }
    }
    return out;
  }, [state.meals, state.recipes, state.fridge]);

  const fridge = [...state.fridge].sort((a, b) => a.name.localeCompare(b.name));
  const shopping = [...state.shopping].sort((a, b) => (a.plannedDate ?? "9999").localeCompare(b.plannedDate ?? "9999"));

  return (
    <div className="space-y-6">
      <datalist id="ingredient-names">
        {ingredientNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Fridge &amp; shopping</h1>
          <p className="text-sm text-ink/60">
            Cooking a meal takes its ingredients out automatically. Use this page for groceries, leftovers and corrections.
          </p>
        </div>
        <button className="btn-primary max-sm:min-h-11 max-sm:w-full" onClick={() => setScanning(true)}>🧾 Scan a receipt</button>
      </div>
      {scanning && <ReceiptScanner onClose={() => setScanning(false)} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-bold">In the fridge</h2>
          <AddRow
            cta="Add to fridge"
            onAdd={async (item) => {
              if (await api("POST", "/api/fridge", item)) toast(`Added ${titleCase(item.name)}.`);
            }}
          />
          {fridge.length === 0 ? (
            <EmptyState icon="🧊" title="The fridge is empty">Add what you have so the planner can tell which meals you can make.</EmptyState>
          ) : (
            <div className="card divide-y divide-black/5">
              {fridge.map((f) => (
                <FridgeRow key={f.id} item={f} planned={plannedUse.get(f.id) ?? 0} updatedBy={userName(f.updatedBy)} />
              ))}
            </div>
          )}
          {state.settings.staples.length > 0 && (
            <p className="text-xs text-ink/50">Always assumed on hand: {state.settings.staples.join(", ")}.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Shopping</h2>

          {fc.shortfalls.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-bold text-red-700">Short for planned meals</h3>
              <p className="mb-2 text-xs text-ink/60">Not in the fridge or on the list in time.</p>
              <ul className="divide-y divide-black/5">
                {fc.shortfalls.map((s) => (
                  <ShortfallRow key={`${s.name}|${s.unit}`} s={s} />
                ))}
              </ul>
            </div>
          )}

          <div className="card p-4">
            <h3 className="mb-2 text-sm font-bold">Shopping list</h3>
            <AddRow
              cta="Add"
              withDate
              onAdd={async (item, plannedDate) => {
                await api("POST", "/api/shopping", { ...item, plannedDate });
              }}
            />
            {shopping.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">Nothing on the list.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/5">
                {shopping.map((s) => (
                  <ShoppingRow key={s.id} item={s} addedBy={userName(s.addedBy)} />
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink/50">
              Give items a shopping day: the week view treats them as in the fridge from that day on, so meals before it still show as short.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ShortfallRow({ s }: { s: Shortfall }) {
  const { api, toast } = useApp();
  const fc = useForecast();
  const [date, setDate] = useState(addDays(s.neededBy, s.neededBy > fc.today ? -1 : 0));
  const qty = roundUpQty(s.quantity);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <div className="min-w-0 flex-1 max-sm:basis-full">
        <b>{formatAmount(qty, s.unit)}</b> {titleCase(s.name)}
        <p className="text-xs text-ink/50">
          by {dayName(s.neededBy)} {shortDate(s.neededBy)} · {s.meals.join(", ")}
        </p>
      </div>
      <input
        className="input w-36 py-1 text-xs max-sm:h-10 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Shopping day"
      />
      <button className="btn-outline btn-sm max-sm:h-10 max-sm:px-3" onClick={() => api("POST", "/api/shopping", { name: s.name, quantity: qty, unit: s.unit, plannedDate: date })}>
        + List
      </button>
      <button
        className="btn-ghost btn-sm max-sm:h-10 max-sm:px-3"
        title="Already bought it — put it in the fridge"
        onClick={async () => {
          if (await api("POST", "/api/fridge", { name: s.name, quantity: qty, unit: s.unit })) toast(`${titleCase(s.name)} added to the fridge.`);
        }}
      >
        Bought
      </button>
    </li>
  );
}

function ShoppingRow({ item, addedBy }: { item: ShoppingItem; addedBy: string }) {
  const { api, toast } = useApp();
  const fc = useForecast();
  const late = item.plannedDate !== null && item.plannedDate < fc.today;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <div className="min-w-0 flex-1 max-sm:basis-full">
        <b>{formatAmount(item.quantity, item.unit)}</b> {titleCase(item.name)}
        <p className="text-xs text-ink/50">added by {addedBy}</p>
      </div>
      <input
        className={`input w-36 py-1 text-xs max-sm:h-10 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 ${late ? "border-amber-400" : ""}`}
        type="date"
        value={item.plannedDate ?? ""}
        onChange={(e) => api("PUT", `/api/shopping/${item.id}`, { plannedDate: e.target.value || null })}
        aria-label="Shopping day"
        title={late ? "This day has passed — still not bought?" : "Shopping day"}
      />
      <button
        className="btn-primary btn-sm max-sm:h-10 max-sm:px-3"
        onClick={async () => {
          if (await api("DELETE", `/api/shopping/${item.id}?bought=1`)) toast(`${titleCase(item.name)} is in the fridge now.`);
        }}
      >
        ✓ Bought
      </button>
      <button className="btn-ghost btn-sm max-sm:h-10 max-sm:w-10" onClick={() => api("DELETE", `/api/shopping/${item.id}`)} aria-label={`Remove ${titleCase(item.name)}`}>✕</button>
    </li>
  );
}

function FridgeRow({ item, planned, updatedBy }: { item: FridgeItem; planned: number; updatedBy: string }) {
  const { api } = useApp();
  const [qty, setQty] = useState(String(item.quantity));
  const left = item.quantity - planned;
  const step = item.unit === "" || item.unit === "pc" ? 1 : item.unit === "g" || item.unit === "ml" ? 100 : 1;
  const save = (q: number) => api("PUT", `/api/fridge/${item.id}`, { quantity: Math.max(0, q) });
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1 max-sm:basis-full">
        <p className="font-semibold">{titleCase(item.name)}</p>
        <p className="text-xs text-ink/50">
          {planned > 0 ? (
            <span className={left < 0 ? "text-red-700" : ""}>
              plan uses {formatAmount(planned, item.unit)} → {left < 0 ? `short ${formatAmount(-left, item.unit)}` : `${formatAmount(left, item.unit)} left`}
            </span>
          ) : (
            "not used by the plan"
          )}{" "}
          · {updatedBy}
        </p>
      </div>
      <div className="flex items-center gap-1 max-sm:w-full">
        <button className="btn-outline btn-sm w-7 max-sm:h-10 max-sm:w-10 max-sm:text-base" onClick={() => save(item.quantity - step)} aria-label={`Less ${titleCase(item.name)}`}>−</button>
        <input
          className="input w-20 py-1 text-center max-sm:h-10"
          type="number"
          min={0}
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => parseFloat(qty) !== item.quantity && save(parseFloat(qty) || 0)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label={`${titleCase(item.name)} quantity`}
        />
        <button className="btn-outline btn-sm w-7 max-sm:h-10 max-sm:w-10 max-sm:text-base" onClick={() => save(item.quantity + step)} aria-label={`More ${titleCase(item.name)}`}>+</button>
        <span className="w-10 text-xs text-ink/60 max-sm:pl-1">{item.unit}</span>
        <button className="btn-ghost btn-sm max-sm:ml-auto max-sm:h-10 max-sm:w-10" onClick={() => api("DELETE", `/api/fridge/${item.id}`)} aria-label={`Remove ${titleCase(item.name)}`}>✕</button>
      </div>
    </div>
  );
}


function AddRow({
  cta,
  withDate,
  onAdd,
}: {
  cta: string;
  withDate?: boolean;
  onAdd: (item: { name: string; quantity: number; unit: string }, plannedDate: string | null) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onAdd({ name: name.trim(), quantity: parseFloat(quantity) || 1, unit: unit.trim() }, date || null);
        setName("");
        setQuantity("1");
      }}
    >
      <input className="input w-20 max-sm:w-full" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Quantity" />
      <UnitInput className="w-24 max-sm:w-full" value={unit} onChange={setUnit} />
      <input className="input col-span-3 -order-1 min-w-32 flex-1 sm:order-none" list="ingredient-names" placeholder="item" value={name} onChange={(e) => setName(e.target.value)} aria-label="Item" />
      {withDate && (
        <input className="input w-36 max-sm:w-full max-sm:min-w-0 max-sm:px-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Shopping day" />
      )}
      <button className={`btn-primary max-sm:min-h-10 ${withDate ? "col-span-3" : ""}`}>{cta}</button>
    </form>
  );
}
