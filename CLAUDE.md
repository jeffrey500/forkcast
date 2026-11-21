@AGENTS.md

# Forkcast: working notes

## Versioning (always)
Every change that ships gets a version bump, no matter how small:
- Bug fix, copy tweak, styling, dependency patch → bump **patch** (0.5.0 → 0.5.1)
- New feature or new setting → bump **minor** (0.5.1 → 0.6.0)
- Breaking data/storage change → bump **major**

Bump with `npm version <patch|minor|major> --no-git-tag-version`, add an entry at the top of
`CHANGELOG.md`, and commit both with the change. The version is shown in the app footer, on the
login page, and in Admin → Settings (read from `package.json` at build time via `NEXT_PUBLIC_APP_VERSION`).

## Privacy
The repo is public. Never commit household data (`.data/`), secrets, or real names/emails.
Screenshots in `docs/` use the made-up "Maple St. Apartment" demo household.
