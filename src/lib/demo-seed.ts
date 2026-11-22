import "server-only";
import { LIBRARY, libraryToRecipe } from "./library";
import { addDays, weekStart } from "./dates";
import { nutritionBasis } from "./nutrition-shared";
import { normalizeName, titleCase } from "./units";
import {
  DEFAULT_SETTINGS,
  type FridgeItem,
  type Ingredient,
  type Meal,
  type Recipe,
  type Settings,
  type ShoppingItem,
  type User,
} from "./types";

/**
 * The made-up "Maple St. Apartment" household used by the public demo.
 * Everything is generated fresh around the visitor's own "today", so the
 * week view always has something cooked, something planned and some gaps.
 * No real people, emails or household data.
 */

const ROOMMATES = [
  { id: "demo-maya", name: "Maya", role: "admin" as const },
  { id: "demo-theo", name: "Theo", role: "member" as const },
  { id: "demo-priya", name: "Priya", role: "member" as const },
  { id: "demo-sam", name: "Sam", role: "member" as const },
];
export const DEMO_DEFAULT_USER = ROOMMATES[0].id;

const LUNCHES = ["greek-chicken-salad", "red-lentil-soup", "black-bean-quesadillas", "egg-fried-rice", "shakshuka"];
const DINNERS = [
  "sheet-pan-chicken-veg",
  "chickpea-spinach-curry",
  "turkey-bolognese",
  "teriyaki-tofu-bowls",
  "lemon-garlic-salmon",
  "burrito-bowl",
  "sweet-potato-black-bean-chili",
];

const titled = (items: Ingredient[]) => items.map((i) => ({ ...i, name: titleCase(i.name) }));

export function demoSeed(today: string): Record<string, unknown> {
  let seq = 0;
  const id = (prefix: string) => `demo-${prefix}-${++seq}`;
  const at = (iso: string, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`).toISOString();
  const created = at(addDays(today, -40));
  const members = ROOMMATES.map((r) => r.id);

  const users: User[] = [
    ...ROOMMATES.map((r) => ({
      id: r.id,
      email: `${r.name.toLowerCase()}@example.com`,
      name: r.name,
      passwordHash: "",
      role: r.role,
      status: "approved" as const,
      createdAt: created,
    })),
    // Shows what a sign-up waiting for approval looks like on the Admin page.
    {
      id: "demo-jordan",
      email: "jordan@example.com",
      name: "Jordan",
      passwordHash: "",
      role: "member",
      status: "pending",
      createdAt: at(addDays(today, -1), 18),
    },
  ];

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    householdName: "Maple St. Apartment",
    cookAssignment: "rotate",
    dishesAssignment: "not-cook",
  };

  // ---- recipes: library favourites plus one house original
  const recipeFor = new Map<string, Recipe>();
  const recipes: Recipe[] = [...LUNCHES, ...DINNERS].map((libId, n) => {
    const lib = LIBRARY.find((r) => r.id === libId);
    if (!lib) throw new Error(`Demo recipe ${libId} is missing from the library.`);
    const base = libraryToRecipe(lib, 4);
    const ingredients = titled(base.ingredients);
    const recipe: Recipe = {
      ...base,
      ingredients,
      nutrition: base.nutrition && {
        ...base.nutrition,
        basis: nutritionBasis({ servings: base.servings, ingredients }),
        analyzedAt: created,
      },
      id: id("recipe"),
      createdBy: members[n % members.length],
      createdAt: created,
      updatedAt: created,
    };
    recipeFor.set(libId, recipe);
    return recipe;
  });
  const macIngredients = titled([
    { name: "macaroni", quantity: 400, unit: "g" },
    { name: "cheddar", quantity: 250, unit: "g" },
    { name: "milk", quantity: 500, unit: "ml" },
    { name: "broccoli", quantity: 300, unit: "g" },
  ]);
  const mac: Recipe = {
    id: id("recipe"),
    name: "Theo's Broccoli Mac & Cheese",
    description: "The house comfort food. Sneaks in a whole head of broccoli.",
    servings: 4,
    ingredients: macIngredients,
    instructions: "1. Boil the macaroni, adding the broccoli for the last 3 minutes.\n2. Melt the cheddar into the warm milk.\n3. Stir everything together and grill until bubbling.",
    tags: ["comfort", "vegetarian", "dinner"],
    nutrition: {
      kcal: 640,
      protein: 28,
      carbs: 78,
      fat: 24,
      source: "claude",
      basis: nutritionBasis({ servings: 4, ingredients: macIngredients }),
      analyzedAt: created,
    },
    createdBy: "demo-theo",
    createdAt: created,
    updatedAt: created,
  };
  recipes.push(mac);
  recipeFor.set("mac", mac);

  // ---- meals: two weeks of history, this week partly planned, a few gaps to fill
  const meals: Meal[] = [];
  let turn = 0;
  const addMeal = (offset: number, slot: string, key: string | null, agreed: number, title = "") => {
    const date = addDays(today, offset);
    const recipe = key ? recipeFor.get(key) : undefined;
    const cook = members[turn % members.length];
    const dishes = members[(turn + 1) % members.length];
    turn++;
    const past = offset < 0;
    meals.push({
      id: id("meal"),
      date,
      slot,
      recipeId: recipe?.id ?? null,
      title: recipe?.name ?? title,
      servings: 4,
      status: past ? "cooked" : "planned",
      proposedBy: cook,
      agreedBy: past ? members : [cook, ...members.filter((m) => m !== cook)].slice(0, agreed),
      cookId: recipe ? cook : null,
      dishesId: recipe ? dishes : null,
      notes: "",
      createdAt: at(addDays(date, -3)),
      ...(past ? { cookedAt: at(date, slot === "Lunch" ? 17 : 23), cookedBy: cook, consumed: [] } : {}),
    });
  };

  for (let offset = -14; offset < 0; offset++) {
    const n = offset + 14;
    if (n % 2 === 0) addMeal(offset, "Lunch", LUNCHES[(n / 2) % LUNCHES.length], 4);
    if (offset === -9) addMeal(offset, "Dinner", null, 4, "Eating Out: Thai Place");
    else addMeal(offset, "Dinner", n % 5 === 3 ? "mac" : DINNERS[n % DINNERS.length], 4);
  }
  // Today and the next few days, with every stage of voting on show.
  addMeal(0, "Lunch", "red-lentil-soup", 4);
  addMeal(0, "Dinner", "chickpea-spinach-curry", 4);
  addMeal(1, "Lunch", "greek-chicken-salad", 3);
  addMeal(1, "Dinner", "teriyaki-tofu-bowls", 3);
  addMeal(2, "Dinner", "lemon-garlic-salmon", 1);
  addMeal(3, "Lunch", "black-bean-quesadillas", 2);
  addMeal(3, "Dinner", "turkey-bolognese", 2);
  addMeal(4, "Dinner", null, 1, "Pizza Night");

  // ---- fridge: everything for today and tomorrow, plus odds and ends.
  // Later meals come up short or wait on the shopping trip, so the warnings have something to show.
  const stock = new Map<string, Ingredient>();
  const stockUp = (items: Ingredient[]) => {
    for (const i of items) {
      const key = `${normalizeName(i.name)}|${i.unit}`;
      const cur = stock.get(key);
      stock.set(key, { name: titleCase(i.name), unit: i.unit, quantity: (cur?.quantity ?? 0) + i.quantity });
    }
  };
  const soon = new Set([today, addDays(today, 1)]);
  for (const m of meals) {
    if (m.status !== "planned" || !soon.has(m.date)) continue;
    stockUp(recipes.find((r) => r.id === m.recipeId)?.ingredients ?? []);
  }
  stockUp([
    { name: "garlic", quantity: 6, unit: "clove" },
    { name: "egg", quantity: 6, unit: "" },
    { name: "tortilla", quantity: 8, unit: "" },
    { name: "cheddar", quantity: 120, unit: "g" },
    { name: "milk", quantity: 1, unit: "l" },
    { name: "greek yogurt", quantity: 500, unit: "g" },
    { name: "carrot", quantity: 3, unit: "" },
    { name: "spinach", quantity: 50, unit: "g" },
  ]);
  const fridge: FridgeItem[] = [...stock.values()].map((item, n) => ({
    id: id("fridge"),
    ...item,
    updatedAt: at(addDays(today, -2)),
    updatedBy: members[n % members.length],
  }));

  // ---- shopping list: a trip planned for tomorrow, and a few "sometime" items
  const thisWeek = weekStart(today, settings.weekStartDay);
  const shopping: ShoppingItem[] = (
    [
      ["salmon fillet", 4, "", addDays(today, 1)],
      ["asparagus", 500, "g", addDays(today, 1)],
      ["baby potato", 800, "g", addDays(today, 1)],
      ["lemon", 3, "", addDays(today, 1)],
      ["ground turkey", 600, "g", null],
      ["whole-wheat spaghetti", 400, "g", null],
      ["oat milk", 1, "l", null],
    ] as [string, number, string, string | null][]
  ).map(([name, quantity, unit, plannedDate], n) => ({
    id: id("shop"),
    name: titleCase(name),
    quantity,
    unit,
    plannedDate,
    addedBy: members[n % members.length],
    createdAt: at(thisWeek),
  }));

  return { users, settings, recipes, fridge, meals, shopping };
}
