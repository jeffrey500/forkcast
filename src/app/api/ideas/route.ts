import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { read } from "@/lib/store";
import { claudeError, claudeFor } from "@/lib/claude";
import { body, handle, HttpError, num, requireMember, str } from "@/lib/server";
import type { FridgeItem, Recipe } from "@/lib/types";

export const maxDuration = 120;


const IdeaSchema = z.object({
  ideas: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      servings: z.number(),
      prepMinutes: z.number(),
      ingredients: z.array(z.object({ name: z.string(), quantity: z.number(), unit: z.string() })),
      instructions: z.string(),
      usesFromFridge: z.array(z.string()),
      needToBuy: z.array(z.string()),
      tags: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `You help a group of roommates decide what to cook. Suggest practical home-cooked meals.
Rules for every idea:
- ingredients: quantities for the stated servings, using simple units the roommates already use (g, kg, ml, l, tsp, tbsp, cup, or "" for counted items like eggs). Use plain ingredient names ("chicken thigh", "onion") so they match fridge items.
- instructions: short numbered steps, one per line.
- usesFromFridge: ingredient names that come from the fridge list you were given.
- needToBuy: ingredient names that are not in the fridge (ignore staples).
- tags: 1-4 short tags like "quick", "vegetarian", "batch-cook".
Do not repeat recipes the roommates already have.`;

export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req);
  const prompt = str(b.prompt, 2000);
  const useFridge = b.useFridge !== false;
  const count = Math.min(6, Math.max(1, Math.round(num(b.count, 3))));
  const servings = Math.min(12, Math.max(1, Math.round(num(b.servings, 3))));

  const { client, settings } = await claudeFor(me);

  const [fridge, recipes] = await Promise.all([
    read<FridgeItem[]>("fridge", []),
    read<Recipe[]>("recipes", []),
  ]);

  const fridgeText = fridge.length
    ? fridge.map((f) => `- ${f.name}: ${f.quantity} ${f.unit}`.trim()).join("\n")
    : "(empty)";
  const userText = [
    `Give ${count} meal ideas, each for ${servings} servings.`,
    prompt ? `What we're in the mood for: ${prompt}` : "Surprise us.",
    useFridge
      ? `Prefer using what's already in our fridge:\n${fridgeText}`
      : "Don't worry about what's in the fridge.",
    `Staples we always have: ${settings.staples.join(", ") || "none"}.`,
    recipes.length ? `Recipes we already have (don't repeat): ${recipes.map((r) => r.name).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.beta.messages.parse({
      model: settings.claudeModel || "claude-opus-5-5",
      // If a safety classifier declines, the API retries on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(IdeaSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "Claude declined that request. Try rephrasing it.");
    }
    if (!response.parsed_output) {
      throw new HttpError(502, "Claude's answer couldn't be read. Try again.");
    }
    return response.parsed_output;
  } catch (err) {
    claudeError(err);
  }
});
