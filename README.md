# Forkcast 🍴

A meal planner for roommates. Plan the week's meals together, agree on them, and let the app keep track of what's in the fridge.

- **Week planner**: add meals to any day and slot (Lunch, Dinner, or your own), drag them around, skip them, and assign a cook.
- **Agreeing**: roommates 👍 meals. A meal counts as agreed when anyone, most, or everyone agrees (your choice in Settings).
- **Fridge tracking**: marking a meal as **Cooked** takes its ingredients (scaled to servings) out of the fridge. **Undo cooked** puts them back.
- **Shortfall forecast**: each planned meal shows *In fridge*, *After shopping*, or *Short* (with exactly what's missing for that day). Shopping-list items with a shopping day count from that day onward.
- **Planning day**: on your chosen day (Friday by default) everyone gets a banner to plan next week.
- **Recipes**: add your own recipes, see which ones you can make right now, and add them to the plan.
- **Ask Claude**: describe what you feel like eating; Claude suggests recipes based on what's in the fridge, and you can save any of them with one click.
- **Accounts**: email and password sign-in. The first account becomes admin. Everyone after that waits for an admin to approve them.

## Storage

All data is stored as JSON files, one per collection: `users`, `settings`, `recipes`, `fridge`, `meals`, `shopping`.

- **On Vercel**, the files live in a **private Vercel Blob store** (`data/*.json`). A Vercel function's own filesystem is wiped between requests, so that's where the files have to go. Writes use ETag checks, so two roommates saving at the same time won't overwrite each other.
- **Locally**, the files live in `./.data/*.json` (git-ignored).

## Deploy to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. In the Vercel project, go to **Storage → Create → Blob**, create a store, and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN` for you.
3. In **Settings → Environment Variables**, add:
   | Variable | Value |
   |---|---|
   | `AUTH_SECRET` | a long random string, e.g. the output of `openssl rand -base64 32` |
   | `ANTHROPIC_API_KEY` | *(optional)* your Claude API key. You can paste it in Admin → Settings instead. |
   | `ADMIN_EMAILS` | *(optional)* comma-separated emails that become admins automatically when they sign up |
4. Deploy, open the site, and **create your account first**. That account becomes the admin.
5. Send the link to your roommates. Approve them under **Admin**.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Without `BLOB_READ_WRITE_TOKEN`, data is saved to `./.data/`. To use Claude locally, set `ANTHROPIC_API_KEY` in `.env.local` or add the key in Admin → Settings.

## Notes

- Units convert within families (g/kg/oz/lb, ml/l/tsp/tbsp/cup, and plain counts), and names are matched loosely ("Tomatoes" = "tomato"). Units from different families (e.g. "1 can" vs "400 g") don't match, so keep fridge and recipe units consistent.
- Staples (salt, pepper, water by default) are never counted against the fridge. Edit the list in Settings.
- The Claude model defaults to Claude Opus 5.5. Admins can switch to Sonnet or Haiku to make requests cheaper.
