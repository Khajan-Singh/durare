# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Durare — a two-sided web app connecting grocery retailers with food-bank
coordinators to rescue surplus food before it's discarded. Retailers log
inventory + expiry; an external XGBoost model forecasts unsold surplus;
coordinators triage forecasts and confirm pickups. Full architecture, data
model, security model, and user flows are documented in `README.md` — read
it before making non-trivial changes; it is kept up to date and this file
intentionally does not repeat it.

## Commands

This repo uses **Bun** as the package manager (npm works too).

```bash
bun install
bun run dev          # vite dev server, http://localhost:5173
bun run build        # production build
bun run build:dev    # dev-mode build
bun run preview      # preview a production build
bun run lint         # eslint .
bun run format       # prettier --write .
```

There is no test suite configured in this repo (`package.json` has no
`test` script).

Model service (separate Python deployable, `model-service/`):

```bash
cd model-service
pip install -r requirements.txt
API_KEY=devkey MODEL_LAYOUT=multiquantile uvicorn main:app --reload --port 8000
```

Then point the frontend at it locally via the `MODEL_SERVICE_URL` /
`MODEL_SERVICE_API_KEY` server secrets (see README §6, §9).

## Architecture essentials

- **Two independently deployable parts**: the TanStack Start app (frontend +
  one server function) and `model-service/` (FastAPI + XGBoost). They talk
  over HTTP with an `X-API-Key` header — see README §6–7 for the full
  contract.
- **File-based routing** (`src/routes/`, TanStack Router). Do not create
  `src/pages/` or Next.js/Remix-style files — see `src/routes/README.md`
  for the exact file→URL conventions (note the bare `$id`, not `{$id}`, for
  dynamic segments). `routeTree.gen.ts` is auto-generated; never hand-edit.
  All protected pages live under `src/routes/_authenticated/`; the auth
  redirect is handled once in `_authenticated/route.tsx` — don't duplicate it.
- **`src/lib/data.ts` is the single data-access layer** — every Supabase
  query, mutation, and derivation goes through it. In particular
  `derivePrediction()` is the *only* place raw model quantiles become
  display values (surplus, confidence band, target date, driver prose). If
  you touch prediction display logic, it almost certainly belongs there, not
  in a component.
- **Exactly one server function**: `triggerModelRun` in
  `src/lib/predictions.functions.ts`. It is the only privileged backend
  endpoint, the only thing that uses the service-role Supabase client, and
  the only thing that calls the model service. Everything else in the UI
  talks directly to Supabase from the browser under RLS.
- **`src/integrations/supabase/`** (client, client.server, auth-middleware,
  auth-attacher, types.ts) is integration-managed/auto-generated — don't
  hand-edit `types.ts`.
- **RLS does the authorization work**, not application code. When adding a
  table or changing access patterns, the policy lives in a new migration
  under `supabase/migrations/`, not in a server-side check (the one
  exception, `triggerModelRun`, re-checks role server-side in addition to
  RLS as defense-in-depth).
- **Model service is intentionally dumb**: it returns raw `sales_q10/q50/q90`
  + `attribution` JSON and must never compute surplus, target dates, or
  prose — that split (README §7) is what keeps the model swappable without
  touching the UI.
- **Styling**: Tailwind v4 with semantic tokens defined in `src/styles.css`
  (`text-primary`, `bg-warning-soft`, etc.). No raw hex colors or
  unthemed Tailwind color utilities.
- **`useAuth()`** re-fetches the profile on a custom
  `durare:profile-updated` window event rather than on every render — fire
  that event after any out-of-band profile mutation.

See `README.md` §10 ("Non-obvious Gotchas & Conventions") for further sharp
edges (pickup race-safety via `fetchActivePickupKeys()`, inventory-delete
cascade to predictions, profile immutability enforced in two places, model
item/store alias tables, Render free-tier cold starts).

## Lovable integration

This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
published git history — force-pushing, or rebasing/amending/squashing
commits already pushed — since it rewrites history on Lovable's side and
the user will likely lose project history. Commits pushed to the connected
branch sync back into the Lovable editor, so keep the branch buildable.
