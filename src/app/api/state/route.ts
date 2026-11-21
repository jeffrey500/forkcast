import { read } from "@/lib/store";
import { currentUser, getSettings, handle, HttpError, publicSettings, publicUser } from "@/lib/server";
import type { AppState, FridgeItem, Meal, Recipe, ShoppingItem, User } from "@/lib/types";

/** Everything the dashboard needs in one request. */
export const GET = handle(async () => {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "Please sign in.");
  if (me.status !== "approved") {
    // Pending users only learn their own status.
    return { pending: true, me: publicUser(me) };
  }
  const [users, settings, recipes, fridge, meals, shopping] = await Promise.all([
    read<User[]>("users", []),
    getSettings(),
    read<Recipe[]>("recipes", []),
    read<FridgeItem[]>("fridge", []),
    read<Meal[]>("meals", []),
    read<ShoppingItem[]>("shopping", []),
  ]);
  const state: AppState = {
    me: publicUser(me),
    users: users.filter((u) => u.status === "approved").map(publicUser),
    settings: publicSettings(settings),
    recipes,
    fridge,
    meals,
    shopping,
  };
  return state;
});
