"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { Modal, UnitInput } from "./ui";
import { LIBRARY } from "@/lib/library";
import { parseReceiptText, suggestStocking, type ScannedItem, type Suggestion } from "@/lib/receipt";
import { normalizeName } from "@/lib/units";
import type { Ingredient } from "@/lib/types";

type Method = "quick" | "claude";
type Step = "pick" | "scanning" | "review";

/** Shrink a photo so it's quick to OCR and small enough to upload. */
async function loadPhoto(file: File, maxSide = 1600): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't an image we can read."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ReceiptScanner({ onClose }: { onClose: () => void }) {
  const { state, api, toast } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<Method>(state.settings.claudeKeySource === "none" ? "quick" : "claude");
  const [step, setStep] = useState<Step>("pick");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const noKey = state.settings.claudeKeySource === "none";

  /** Ingredient names (and their usual units) the household already uses; the fridge wins. */
  const known = useMemo(() => {
    const m = new Map<string, Ingredient>();
    const add = (i: Ingredient) => {
      const k = normalizeName(i.name);
      if (!m.has(k)) m.set(k, { name: i.name, quantity: 0, unit: i.unit });
    };
    state.fridge.forEach(add);
    state.recipes.forEach((r) => r.ingredients.forEach(add));
    LIBRARY.forEach((r) => r.ingredients.forEach(add));
    return [...m.values()];
  }, [state.fridge, state.recipes]);

  async function scan() {
    if (!file) return;
    setError("");
    setStep("scanning");
    try {
      const canvas = await loadPhoto(file);
      let items: ScannedItem[];
      if (method === "quick") {
        setProgress("Loading the text reader…");
        const Tesseract = (await import("tesseract.js")).default;
        const { data } = await Tesseract.recognize(canvas, "eng", {
          logger: (m) => {
            if (m.status === "recognizing text") setProgress(`Reading the receipt… ${Math.round(m.progress * 100)}%`);
          },
        });
        items = parseReceiptText(data.text);
        setIgnored([]);
      } else {
        setProgress("Claude is reading the receipt…");
        const res = await fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.85) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Claude couldn't read the receipt.");
        items = (json.items as { name: string; quantity: number; unit: string; receiptText: string; storage: ScannedItem["storage"] }[]).map(
          (it) => ({ name: it.name, quantity: it.quantity, unit: it.unit, raw: it.receiptText, storage: it.storage }),
        );
        setIgnored(json.ignored ?? []);
      }
      if (!items.length) {
        throw new Error(
          method === "quick"
            ? "No grocery lines found. Try a flatter, brighter photo, or use Claude scan."
            : "Claude didn't find any groceries on that receipt.",
        );
      }
      setRows(suggestStocking(items, state.shopping, known));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("pick");
    }
  }

  const set = (i: number, patch: Partial<Suggestion>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = rows.filter((r) => r.include && r.name.trim() && r.quantity > 0);

  async function stock() {
    setBusy(true);
    const ok = await api("POST", "/api/fridge", {
      items: chosen.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      clearShoppingIds: chosen.flatMap((r) => (r.match.kind === "shopping" ? [r.match.shoppingId] : [])),
    });
    setBusy(false);
    if (ok) {
      const ticked = chosen.filter((r) => r.match.kind === "shopping").length;
      toast(`Added ${chosen.length} item(s) to the fridge${ticked ? ` and ticked ${ticked} off the shopping list` : ""}.`);
      onClose();
    }
  }

  return (
    <Modal title="Scan a receipt" onClose={onClose} wide>
      {step === "pick" && (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/15 px-4 py-8 text-center hover:border-leaf-500">
            <span className="text-3xl">🧾</span>
            <span className="text-sm font-semibold">{file ? file.name : "Take a photo or choose an image"}</span>
            <span className="text-xs text-ink/50">Lay the receipt flat in good light.</span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <MethodCard
              active={method === "quick"}
              onClick={() => setMethod("quick")}
              title="Quick scan"
              badge="Free · on your device"
              text="Reads the text in your browser and matches lines to your shopping list and ingredients. The photo never leaves your phone. Works best on clear, simple receipts."
            />
            <MethodCard
              active={method === "claude"}
              disabled={noKey}
              onClick={() => setMethod("claude")}
              title="Claude scan"
              badge={noKey ? "Needs an API key" : "Most accurate · uses 1 Claude request"}
              text="Claude reads the photo, decodes abbreviations, works out amounts and units, skips non-food, and suggests fridge, freezer or pantry."
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!file} onClick={scan}>Scan receipt</button>
          </div>
        </div>
      )}

      {step === "scanning" && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-leaf-100 border-t-leaf-600" />
          <p className="text-sm text-ink/70">{progress}</p>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-3">
          <p className="text-sm text-ink/70">
            Check the amounts, untick anything you don&apos;t want, then stock the fridge. Items matched to the shopping list get ticked off it.
          </p>
          <ul className="divide-y divide-black/5 rounded-xl border border-black/10">
            {rows.map((r, i) => (
              <li key={i} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${r.include ? "" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-leaf-600"
                  checked={r.include}
                  onChange={(e) => set(i, { include: e.target.checked })}
                  aria-label={`Include ${r.name}`}
                />
                <input
                  className="input w-20 py-1"
                  type="number"
                  min="0"
                  step="any"
                  value={Number.isFinite(r.quantity) ? r.quantity : ""}
                  onChange={(e) => set(i, { quantity: parseFloat(e.target.value) })}
                  aria-label="Quantity"
                />
                <UnitInput className="w-20 py-1" value={r.unit} onChange={(u) => set(i, { unit: u })} />
                <input className="input min-w-32 flex-1 py-1" value={r.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Item" />
                <div className="flex w-full flex-wrap items-center gap-1 pl-6 text-[11px]">
                  {r.match.kind === "shopping" && <span className="chip bg-leaf-100 text-leaf-700">✓ On shopping list</span>}
                  {r.match.kind === "known" && <span className="chip bg-sky-50 text-sky-700">Matches “{r.match.label}”</span>}
                  {r.match.kind === "new" && <span className="chip bg-black/5 text-ink/60">New item</span>}
                  {r.checkUnit && <span className="chip bg-amber-100 text-amber-900">Check amount: you track this in {r.checkUnit}</span>}
                  {r.storage && <span className="chip bg-amber-50 text-amber-800">{r.storage}</span>}
                  <span className="truncate text-ink/40">{r.raw}</span>
                </div>
              </li>
            ))}
          </ul>
          {ignored.length > 0 && <p className="text-xs text-ink/50">Skipped: {ignored.join(", ")}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep("pick")}>← Scan again</button>
            <button className="btn-primary" disabled={busy || chosen.length === 0} onClick={stock}>
              {busy ? "Stocking…" : `Add ${chosen.length} item(s) to the fridge`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MethodCard(props: { active: boolean; disabled?: boolean; onClick: () => void; title: string; badge: string; text: string }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        props.active ? "border-leaf-500 bg-leaf-50 ring-2 ring-leaf-100" : "border-black/10 hover:border-black/20"
      }`}
    >
      <p className="font-bold">{props.title}</p>
      <p className="text-[11px] font-semibold text-leaf-700">{props.badge}</p>
      <p className="mt-1 text-xs text-ink/60">{props.text}</p>
    </button>
  );
}
