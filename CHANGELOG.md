# Changelog

Every change bumps the version: fixes bump the patch number, features bump the minor number.

## 0.8.1
- README refreshed with new screenshots: calorie chips, the month calendar, and the phone layout.

## 0.8.0
- **Made for phones.** Every page is tuned for a phone browser: bigger tap targets, no sideways scrolling, bottom-sheet dialogs, no zoom-in when typing, and room for the iPhone home bar. The week planner shows one day at a time on a phone with a day picker.
- **Add to Home Screen:** Forkcast can be installed like an app (icon, full-screen, theme colour).
- **Show password:** an eye button on the sign-in and sign-up forms reveals what you typed.

## 0.7.0
- **Automatic calorie analysis.** Saving a recipe (or a Claude idea) gets a per-serving estimate of calories, protein, carbs and fat from Claude in the background; it's redone when ingredients change. Library recipes come with built-in estimates.
- Meal cards show ~kcal per serving, each day shows a rough per-person total, and recipe cards and details show the numbers. Admins can analyse all older recipes at once.
- New optional `NUTRITION_DAILY_LIMIT` (default 60) caps automatic analyses per household per day.
- The planner's stat cards (Meals planned, Waiting on votes, Short on food, Cooked) are clickable and list the meals behind each number.
- **Calendar view:** switch the planner between Week and Month to see at a glance which days had meals planned or made, and jump to any date.

## 0.6.2
- Redesigned README with every feature and fresh screenshots.

## 0.6.1
- The planner no longer shows a "Chores this week" bar or an **Assign chores** button; each meal shows its own cook and dishwasher. Automatic rotation (Admin → Settings → Chores) still fills new meals.

## 0.6.0
- **Who cooks and who does dishes:** every meal can have a cook and a dishwasher. Admins can set either to rotate fairly (dishes can be "never the cook"), and the planner's **Assign chores** button fills a week. The planner shows a weekly chores tally.
- Evening reminders include tomorrow's cook and dishwasher.
- Planned meals can be removed from the plan directly (no need to skip them first).
- Food names ignore upper/lower case and are shown with each word capitalized ("chicken THIGH" → "Chicken Thigh").

## 0.5.0
- Reminders can go to **Discord** as well as email. Admins choose the channels; a channel webhook posts one combined message that @mentions whoever still needs to vote.
- Everyone can turn their own email reminders off and add a Discord user ID for mentions (in **Your profile**).
- **Send test to Discord** button next to **Send test email to me**.
- The app version is shown in the footer, on the login page, and in Admin → Settings.

## 0.4.2
- Fix: saving anything to a file that already existed (fridge, meals, settings…) failed on Vercel Blob with "too many simultaneous edits".

## 0.4.1
- Admin **Send test email to me**; email failures explain what to fix; other server errors show a ref code to find in Vercel logs.

## 0.4.0
- Built-in recipe library (30 easy, healthy lunches and dinners) with **Add to our recipes**.
- Receipt scanning: Quick scan (on-device) and Claude scan.
- Evening reminder emails: votes needed, nothing agreed for tomorrow, missed planning day.
- **Repeat last week** for empty slots; change your own display name.

## 0.3.0
- Works with Vercel Blob stores that use `BLOB_STORE_ID`; clear "Setup needed" messages.

## 0.2.0
- Ready for a public repo: noindex, security headers, login lockout, rate limits, CSRF checks, Claude daily limit; new logo and README.

## 0.1.0
- First version: week planner with voting, fridge tracking and forecasts, shopping list, recipes, Ask Claude, admin approval.
