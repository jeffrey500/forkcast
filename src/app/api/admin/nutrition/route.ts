import { read } from "@/lib/store";
import { handle, requireAdmin } from "@/lib/server";
import { analyzeAndSave } from "@/lib/nutrition";
import { needsNutrition } from "@/lib/nutrition-shared";
import type { Recipe } from "@/lib/types";

export const maxDuration = 300;

const BATCH = 25;

/** Backfill: estimate nutrition for recipes that have none (or a stale one), up to 25 per call. */
export const POST = handle(async () => {
  await requireAdmin();
  const todo = (await read<Recipe[]>("recipes", [])).filter(needsNutrition).slice(0, BATCH);
  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  let stopped: "no-key" | "limit" | undefined;
  for (const r of todo) {
    const status = await analyzeAndSave(r.id);
    if (status === "saved") analyzed++;
    else if (status === "error") failed++;
    else if (status === "no-key" || status === "limit") {
      stopped = status;
      break;
    } else skipped++;
  }
  const remaining = (await read<Recipe[]>("recipes", [])).filter(needsNutrition).length;
  return { analyzed, skipped, failed, remaining, ...(stopped ? { stopped } : {}) };
});
