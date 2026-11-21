import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { read } from "@/lib/store";
import { claudeError, claudeFor } from "@/lib/claude";
import { body, handle, HttpError, requireMember } from "@/lib/server";
import type { FridgeItem, Recipe, ShoppingItem } from "@/lib/types";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // the browser shrinks photos well below this

const ReceiptSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
      receiptText: z.string(),
      storage: z.enum(["fridge", "freezer", "pantry"]),
    }),
  ),
  ignored: z.array(z.string()),
});

const SYSTEM = `You read photos of grocery receipts for a group of roommates and work out how to stock their shared fridge and pantry.
For every food or drink line on the receipt, return one item:
- name: a plain, lowercase ingredient name a person would write on a shopping list ("chicken thigh", "greek yogurt", "black beans"). Expand receipt abbreviations. Drop brands, "organic", sizes and codes. If the household already uses a name for the same thing (see the list provided), use exactly that name.
- quantity and unit: the amount bought. Use one of: g, kg, ml, l, lb, oz, or "" for counted items, or "can" for canned goods. Use the weight printed for weighed items; otherwise the pack size if it's printed (e.g. 32oz → 32 oz, 1 gal milk → 3.78 l); otherwise count units bought (2 @ 0.99 → 2). Multiply by the number of packs bought. Combine repeated lines for the same product.
- receiptText: the receipt line(s) this came from, as printed.
- storage: where it should go: fridge, freezer, or pantry.
List anything that isn't food (cleaning supplies, toiletries, bags, deposits, discounts, totals, tax, payment) in "ignored" instead of items.
If the image isn't a receipt or can't be read, return no items and explain briefly in "ignored".`;

/** Claude scan: read a receipt photo and suggest how to stock the fridge. */
export const POST = handle(async (req: Request) => {
  const me = await requireMember();
  const b = await body(req, MAX_IMAGE_BYTES * 1.4);
  const image = typeof b.image === "string" ? b.image : "";
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new HttpError(400, "Send a JPEG, PNG or WebP photo of the receipt.");
  const mediaType = m[1] as "image/jpeg" | "image/png" | "image/webp";
  const data = m[2];
  if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too large. Try a smaller one.");

  const { client, settings } = await claudeFor(me);

  const [fridge, recipes, shopping] = await Promise.all([
    read<FridgeItem[]>("fridge", []),
    read<Recipe[]>("recipes", []),
    read<ShoppingItem[]>("shopping", []),
  ]);
  const known = [
    ...new Set([
      ...fridge.map((f) => f.name),
      ...shopping.map((s) => s.name),
      ...recipes.flatMap((r) => r.ingredients.map((i) => i.name)),
    ]),
  ]
    .slice(0, 300)
    .join(", ");

  try {
    const response = await client.beta.messages.parse({
      model: settings.claudeModel || "claude-opus-5-5",
      // If a safety classifier declines, the API retries on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(ReceiptSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            {
              type: "text",
              text: `Ingredient names this household already uses: ${known || "(none yet)"}\n\nRead this receipt and list what to stock.`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new HttpError(422, "Claude couldn't read that image. Try another photo.");
    if (!response.parsed_output) throw new HttpError(502, "Claude's answer couldn't be read. Try again.");
    return response.parsed_output;
  } catch (err) {
    claudeError(err);
  }
});
