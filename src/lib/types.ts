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
}

/** User as sent to the browser (no password hash or lockout info). */
export type PublicUser = Omit<User, "passwordHash" | "failedLogins" | "lockedUntil">;

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string;
  tags: string[];
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
}

export const DEFAULT_SETTINGS: Settings = {
  householdName: "Our place",
  planningDay: 5,
  weekStartDay: 6,
  mealSlots: ["Lunch", "Dinner"],
  agreementRule: "majority",
  staples: ["salt", "pepper", "water"],
  claudeModel: "claude-opus-5-5",
  anthropicApiKey: "",
};

export type PublicSettings = Omit<Settings, "anthropicApiKey"> & {
  claudeKeySource: "env" | "settings" | "none";
};

export interface AppState {
  me: PublicUser;
  users: PublicUser[];
  settings: PublicSettings;
  recipes: Recipe[];
  fridge: FridgeItem[];
  meals: Meal[];
  shopping: ShoppingItem[];
}
