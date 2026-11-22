export const APP_NAME = "Forkcast";

export type Role = "admin" | "member";
export type UserStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  /** Consecutive wrong passwords; reset on success. */
  failedLogins?: number;
  /** ISO time until which sign-in is blocked after too many wrong passwords. */
  lockedUntil?: string;
  /** Personal opt-out of reminder emails (default: on). */
  emailReminders?: boolean;
  /** Discord user ID, so Discord reminders can @mention this person. */
  discordId?: string;
}

/** User as sent to the browser (no password hash or lockout info). */
export type PublicUser = Omit<User, "passwordHash" | "failedLogins" | "lockedUntil">;

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

/** Estimated nutrition for ONE serving of a recipe. */
export interface NutritionFacts {
  kcal: number;
  /** grams */
  protein: number;
  /** grams */
  carbs: number;
  /** grams */
  fat: number;
}

export interface Nutrition extends NutritionFacts {
  /** "claude": analysed by Claude; "library": built-in estimate; "idea": came with a Claude idea. */
  source: "claude" | "library" | "idea";
  /** nutritionBasis() of the ingredients/servings this was computed for. If it no longer matches, the estimate is stale. */
  basis: string;
  analyzedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string;
  tags: string[];
  /** Set when copied from the built-in recipe library. */
  libraryId?: string;
  /** Per-serving estimate; filled automatically after saving when a Claude key is set. */
  nutrition?: Nutrition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FridgeItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  updatedAt: string;
  updatedBy: string;
}

export type MealStatus = "planned" | "cooked" | "skipped";

export interface Meal {
  id: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  slot: string;
  /** null for free-form meals like "Eating out" */
  recipeId: string | null;
  title: string;
  servings: number;
  status: MealStatus;
  proposedBy: string;
  agreedBy: string[];
  cookId: string | null;
  /** Who washes up. Missing on meals created before chores existed. */
  dishesId?: string | null;
  notes: string;
  createdAt: string;
  cookedAt?: string;
  cookedBy?: string;
  /** Ingredients actually taken out of the fridge when cooked (used for undo). */
  consumed?: Ingredient[];
  /** Ingredients the recipe needed that weren't in the fridge at cook time. */
  missingAtCook?: Ingredient[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** The day you plan to buy it. Used by the forecast; null = "sometime". */
  plannedDate: string | null;
  addedBy: string;
  createdAt: string;
}

export type AgreementRule = "any" | "majority" | "all";

export interface Settings {
  householdName: string;
  /** 0 = Sunday ... 6 = Saturday */
  planningDay: number;
  weekStartDay: number;
  mealSlots: string[];
  agreementRule: AgreementRule;
  /** Ingredients always assumed to be on hand (salt, pepper, ...). */
  staples: string[];
  claudeModel: string;
  /** Stored server-side only, never sent to the browser. */
  anthropicApiKey: string;
  /** Evening reminders by email. */
  reminderEmails: boolean;
  /** Evening reminders posted to a Discord channel. */
  reminderDiscord: boolean;
  /** Discord channel webhook URL. Stored server-side only. */
  discordWebhookUrl: string;
  /** IANA time zone for "today"/"tomorrow" in reminders, e.g. America/New_York. */
  timezone: string;
  /** "rotate": new meals get a cook automatically, spread fairly across the week. */
  cookAssignment: CookAssignment;
  /** "rotate": fair rotation; "not-cook": fair rotation, never the meal's cook. */
  dishesAssignment: DishesAssignment;
}

export type CookAssignment = "manual" | "rotate";
export type DishesAssignment = "manual" | "rotate" | "not-cook";

export const DEFAULT_SETTINGS: Settings = {
  householdName: "Our place",
  planningDay: 5,
  weekStartDay: 6,
  mealSlots: ["Lunch", "Dinner"],
  agreementRule: "majority",
  staples: ["salt", "pepper", "water"],
  claudeModel: "claude-opus-5-5",
  anthropicApiKey: "",
  reminderEmails: true,
  reminderDiscord: false,
  discordWebhookUrl: "",
  timezone: "America/New_York",
  cookAssignment: "manual",
  dishesAssignment: "manual",
};

export type PublicSettings = Omit<Settings, "anthropicApiKey" | "discordWebhookUrl"> & {
  discordSource: "env" | "settings" | "none";
  claudeKeySource: "env" | "settings" | "none";
  /** Whether SMTP is configured so reminder emails can actually be sent. */
  emailConfigured: boolean;
  /** Whether the daily cron is protected by CRON_SECRET. */
  cronConfigured: boolean;
};

export interface AppState {
  me: PublicUser;
  users: PublicUser[];
  settings: PublicSettings;
  recipes: Recipe[];
  fridge: FridgeItem[];
  meals: Meal[];
  shopping: ShoppingItem[];
  /** True in the public demo (a made-up household; nothing is saved). */
  demo?: boolean;
}
