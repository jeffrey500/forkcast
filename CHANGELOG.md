# Changelog

Every change bumps the version: fixes bump the patch number, features bump the minor number.

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
