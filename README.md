# Durare — Predict Surplus, Rescue Food

Durare is a two-sided web application that helps grocery retailers and food-bank
coordinators rescue donatable surplus **before** it is discarded. Retailers log
what's on their shelves and when it expires; an external machine-learning model
forecasts how much of each item is likely to go unsold; coordinators see those
forecasts ranked by quantity, readiness, and distance from their food bank,
confirm pickups, and mark deliveries complete.

The product is a single React/TanStack Start app backed by Lovable Cloud
(Postgres + Auth + Storage via Supabase) and a small FastAPI service that wraps
a trained XGBoost quantile model.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Core User Flows](#3-core-user-flows)
4. [Data Model](#4-data-model)
5. [Frontend Code Map](#5-frontend-code-map)
6. [Backend / Server Functions](#6-backend--server-functions)
7. [The Forecasting Model Service](#7-the-forecasting-model-service)
8. [Security Model](#8-security-model)
9. [Setup & Running Locally](#9-setup--running-locally)
10. [Non-obvious Gotchas & Conventions](#10-non-obvious-gotchas--conventions)

---

## 1. Overview

**The problem.** Grocery stores throw away enormous quantities of edible food
every day because they don't realize what will be unsold until it's already
expired. Food banks have trucks, cold storage, and volunteers — but they only
find out about donations reactively, often too late to plan a route.

**What Durare does.** It moves the donation conversation forward in time:

- Retailers enter (or CSV-upload) their perishable inventory: item, quantity,
  and expiry date.
- A trained quantile-regression model predicts, for each row, how many units
  are likely to actually sell before the expiry date — and how much is likely
  to be left over (the "surplus").
- Each prediction comes with a confidence range, a plain-language explanation
  of the drivers, and a recommended pickup date (some days before expiry,
  tightened or loosened based on confidence).
- Coordinators see the forecasts as cards filterable by radius, sortable by
  readiness/quantity/distance, claim a pickup with one click, and then
  manage scheduled pickups and completed deliveries from dedicated tabs.

**Who it's for.** Grocery / convenience-store managers and food-bank pickup
coordinators. Both roles are first-class users with separate dashboards.

**Design ethos.** "Foresight & Stewardship" — every forecast must be
explainable (no black-box numbers), every action must be a human decision
(the AI proposes, a coordinator confirms), and the UI must be calm and
legible, not flashy.

---

## 2. Architecture

### Tech stack

| Layer | Choice |
| --- | --- |
| Frontend framework | React 19 + TanStack Start v1 (Vite 7) |
| Routing | TanStack Router (file-based, in `src/routes/`) |
| Data fetching | TanStack Query (`@tanstack/react-query`) |
| Styling | Tailwind v4 (via `src/styles.css`) + shadcn/ui components |
| Auth + DB + Storage | Lovable Cloud (Supabase under the hood) |
| Server-side logic | TanStack `createServerFn` (Cloudflare Workers runtime) |
| ML serving | FastAPI + XGBoost, deployed separately (Render free tier) |
| Maps / geocoding | Google Maps JS API (via Lovable connector) |
| Forms / validation | `zod` |

### High-level diagram

```text
 ┌──────────────────────┐      Supabase Data API       ┌───────────────────────┐
 │  Browser (React)     │ ◄──────────────────────────► │  Postgres (Lovable    │
 │  - retailer / coord  │       publishable key + RLS   │  Cloud / Supabase)    │
 │  - shadcn UI         │                               │  - RLS on every table │
 └──────┬───────────────┘                               └──────────┬────────────┘
        │                                                          ▲
        │ Google Maps JS / Geocoding (browser key)                 │
        │                                                          │ service-role
        │ useServerFn(triggerModelRun)                             │ inserts
        ▼                                                          │
 ┌──────────────────────┐    POST /predict (X-API-Key)   ┌─────────┴───────────┐
 │ TanStack server fn   │ ─────────────────────────────► │ FastAPI model       │
 │ (Cloudflare Worker)  │ ◄──────────────────────────────│ service (Render)    │
 │ - reads inventory    │   raw quantile predictions     │ - XGBoost q10/q50/q90│
 │ - writes predictions │                                │ - encoders.json     │
 └──────────────────────┘                                └─────────────────────┘
```

### Why these choices

- **TanStack Start, not Next.js.** Co-located server functions
  (`createServerFn`) with strict TypeScript and built-in type-safe routing fit
  the "small, surgical backend" we needed (one privileged endpoint:
  `triggerModelRun`).
- **Lovable Cloud / Supabase.** Gives us Postgres + Auth + RLS without
  building it. Every table has Row-Level Security so the browser can talk
  directly to the database safely.
- **Forecasts written by an external service, not computed in-app.** Keeps
  the model versionable and swappable, and keeps Python/XGBoost out of the
  Worker bundle. The app only stores **raw quantiles** and derives every
  display value on read (see `src/lib/data.ts → derivePrediction`). Anything
  shown to a user can be traced back to a single deterministic function.
- **TanStack Query for cache + invalidation.** Mutations (`addInventory`,
  `confirmPickup`, `markPickupCompleted`) explicitly invalidate their queries
  so the UI updates without manual refresh.
- **shadcn/ui + Tailwind v4.** Components live in `src/components/ui/` so we
  can restyle without forking a library. All colors/gradients are semantic
  tokens (`text-primary`, `bg-warning-soft`, etc.) defined in
  `src/styles.css`, never hardcoded hex values.

---

## 3. Core User Flows

### 3.1 Sign up (`/auth`)

`src/routes/auth.tsx` runs a small three-step state machine: **signin →
role-picker → signup**.

1. **Pick a role**: Retailer or Coordinator.
2. **Sign up form**: email + password + display name + organization name +
   **map-picked location**. The `LocationPicker` component
   (`src/components/location-picker.tsx`) embeds a Google Map; the user
   searches an address or drops a pin and the picker returns `{lat, lng,
   address}`. The state (`CA`, `TX`, …) is reverse-geocoded so the model
   can use it as a feature.
3. On submit:
   - `supabase.auth.signUp(...)` creates the auth user.
   - For retailers we `createStore({...})`; for coordinators we
     `createFoodBank({...})`.
   - A `profiles` row is inserted with `role` and the linked `store_id` or
     `food_bank_id`. **This row is immutable for those fields** (see
     security section).
4. The auth state listener in `useAuth()` picks up the session and
   `src/routes/index.tsx` redirects to `/retailer` or `/coordinator`.

### 3.2 Retailer: log inventory (`/retailer`)

`src/routes/_authenticated/retailer.tsx`:

- The page header shows the store name. The main table lists every active
  inventory snapshot ordered by expiry date and badged when it's near
  expiry.
- **Add item drawer**: pick an Overall category (Produce, Bakery, Dairy,
  …) then a specific item (autocomplete from `src/lib/food-catalog.ts`,
  but a custom name is allowed). The drawer calls `findOrCreateItem` to
  upsert the canonical `items` row, then `addInventorySnapshot` to insert
  into `inventory_snapshots`.
- **CSV upload**: drag-drop a 4-column CSV (`category, item_name, quantity,
  expiry_date`). Each row is parsed, validated, and previewed with a per-row
  error message; the user clicks **Import** to commit. A template is
  downloadable from the same drawer.
- **Claimed column**: shows the latest pickup status for each item, so the
  retailer knows when a coordinator has confirmed a rescue.
- **Filters**: "all" and "near expiry (≤2 days)". A produce-only filter was
  intentionally removed because there is no reliable category mapping yet.
- Items whose latest pickup is `completed` are hidden — they move to the
  Deliveries tab.

### 3.3 Coordinator: triage forecasts (`/coordinator`)

`src/routes/_authenticated/coordinator.tsx`:

- **Radius selector** (10 / 25 / 50 / 100 mi). Distance is computed
  client-side with the Haversine formula in `src/lib/utils.ts`.
- **Retailers strip**: every retailer in the system within the radius,
  with a per-store count of forecasts and total units. Clicking a retailer
  filters the forecast grid.
- **Forecast cards**: each `PredictionCard` shows item, store, predicted
  surplus, the confidence range, a colored confidence bar
  (`ConfidenceBar`), the recommended pickup date, distance, and the
  plain-language drivers. The card is colored `near-expiry` if `days_to_expiry
  ≤ 2`.
- **Sort**: by readiness (target date), quantity, or distance.
- **Refresh button**: calls `triggerModelRun` → fresh predictions are
  inserted → query is invalidated → the grid re-renders.
- **Confirm pickup**: opens `ConfirmPickupModal`; on submit it inserts a
  `pickups` row with status `confirmed`. After insertion that
  (store, item) pair is filtered out of the coordinator grid (so two
  coordinators don't double-claim the same forecast).

### 3.4 Pickups & Deliveries

- `/pickups` (`pickups.tsx`) — coordinator view of confirmed pickups for
  their food bank, separated into Pending and Completed sections. The
  **Complete** button calls `markPickupCompleted(id)` which sets status to
  `completed`. An info popover (`PickupDetailsPopover`) shows store contact +
  the original forecast drivers.
- `/deliveries` (`deliveries.tsx`) — retailer-side view of completed
  rescues from their store (i.e., food that has actually left the building).

### 3.5 Settings dialog

`src/components/settings-dialog.tsx`, opened from the header. Lets a user
edit their display name and (for retailers) the store name + address,
(for coordinators) the food-bank name + address. Re-uses
`LocationPicker`. On save it dispatches a `durare:profile-updated` window
event so `useAuth` refetches the profile.

---

## 4. Data Model

All tables live in the `public` schema. Migrations are under
`supabase/migrations/`. RLS is enabled on every table; see the Security
section for the access matrix.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `stores` | Retailer locations | `id, name, lat, lng, type, state, address` |
| `food_banks` | Food-bank locations | `id, name, lat, lng, capacity, cold_storage, address` |
| `items` | Canonical product catalog | `id, name, category, shelf_life_days` |
| `profiles` | App user metadata (FK to `auth.users`) | `id, email, display_name, role, store_id, food_bank_id` |
| `inventory_snapshots` | A point-in-time count of one item at one store | `store_id, item_id, qty_on_hand, expiry_date, date, shelf_life_days, catalog_item_id, catalog_category_id` |
| `predictions` | One model output row per (store, item, snapshot) | `store_id, item_id, snapshot_date, expiry_date, qty_on_hand, sales_q10, sales_q50, sales_q90, attribution (jsonb), model_version` |
| `pickups` | A coordinator-confirmed rescue | `food_bank_id, store_id, item_id, scheduled_date, quantity, status, confirmed_by` |
| `daily_sales` | Optional historical sales feed used to enrich forecasts | `store_id, item_id, date, units` |

The `app_role` Postgres enum has two values: `retailer`, `coordinator`.

### How a number becomes a forecast

The model writes raw quantile output and an `attribution` JSON. The app
derives **everything** on read in `derivePrediction()`:

```text
predicted_surplus_qty = round( qty_on_hand − sales_q50 )
confidence_low        = round( qty_on_hand − sales_q90 )   // high sales → low surplus
confidence_high       = round( qty_on_hand − sales_q10 )   // low sales  → high surplus

rel_width = (confidence_high − confidence_low) / max(predicted_surplus_qty, 1)

if rel_width < 0.6 :  confidence = "high",     buffer = 3 days
elif rel_width < 1.2: confidence = "moderate", buffer = 2 days
else:                 confidence = "low",      buffer = 1 day

target_date = clamp(expiry_date − buffer, snapshot_date, expiry_date − 1)
```

`drivers` is then a short paragraph composed from:
- the arithmetic ("~12 of 40 units expected to sell, leaving ~28 surplus…"),
- a confidence sentence built from `attribution.recent_trend`,
  `attribution.promo_active`, and `attribution.window_days`,
- the recommended pickup date.

### Data flow (write path)

1. Retailer submits inventory → `addInventorySnapshot()` inserts a row in
   `inventory_snapshots` (browser → Supabase, RLS-gated to that store).
2. Coordinator presses **Refresh** → `useServerFn(triggerModelRun)` →
   server function:
   - re-reads `inventory_snapshots` joined with `items` + `stores`,
   - POSTs them to the FastAPI model service with the API key,
   - inserts the returned rows into `predictions` using the service-role
     client (RLS allows `INSERT` only to `service_role`).
3. Coordinator confirms a pickup → `confirmPickup()` inserts into `pickups`
   with status `confirmed`. RLS requires `food_bank_id` to match the
   coordinator's profile *and* the user to have the `coordinator` role.
4. Pickup completed → `markPickupCompleted()` sets `status = 'completed'`.

---

## 5. Frontend Code Map

```
src/
├── routes/                          # File-based TanStack routes
│   ├── __root.tsx                   # HTML shell, QueryClientProvider, error/404 boundaries
│   ├── index.tsx                    # Landing page; redirects logged-in users to their dashboard
│   ├── auth.tsx                     # Sign-in / role-pick / sign-up state machine
│   └── _authenticated/
│       ├── route.tsx                # Integration-managed auth gate (ssr:false, redirects to /auth)
│       ├── retailer.tsx             # Inventory snapshot + CSV importer
│       ├── coordinator.tsx          # Forecast triage + radius filter + refresh button
│       ├── pickups.tsx              # Confirmed pickups (food-bank side)
│       └── deliveries.tsx           # Completed pickups (retailer side)
│
├── components/
│   ├── app-shell.tsx                # Top nav, profile menu, settings, logout
│   ├── prediction-card.tsx          # Card UI for one forecast on the coordinator dashboard
│   ├── confidence-bar.tsx           # Visual q10–q90 range bar inside a prediction card
│   ├── confirm-pickup-modal.tsx     # Coordinator's "claim this surplus" modal
│   ├── pickup-details-popover.tsx   # Info popover for a confirmed pickup
│   ├── location-picker.tsx          # Google Maps embed for picking lat/lng + address
│   ├── settings-dialog.tsx          # Edit display name + store/food-bank name + address
│   └── ui/                          # shadcn/ui primitives
│
├── hooks/
│   └── use-auth.ts                  # Session + profile, re-fetches on durare:profile-updated
│
├── lib/
│   ├── data.ts                      # ★ Single data-access layer (queries, mutations, derivations)
│   ├── predictions.functions.ts     # ★ TanStack server function: triggerModelRun
│   ├── food-catalog.ts              # Static taxonomy: overall categories → specific items
│   ├── utils.ts                     # cn(), formatDate, daysUntil, haversineMiles, …
│   └── (error-capture / lovable-error-reporting / error-page)
│
├── integrations/supabase/           # Auto-generated; do NOT edit
│   ├── client.ts                    # Browser client (publishable key, persisted session)
│   ├── client.server.ts             # Service-role client (server-only)
│   ├── auth-middleware.ts           # requireSupabaseAuth for server functions
│   ├── auth-attacher.ts             # Adds Authorization header to server-fn calls
│   └── types.ts                     # DB schema → TypeScript types
│
├── routes/api/                      # (empty today; reserved for public webhooks)
├── start.ts / server.ts / router.tsx
└── styles.css                       # Tailwind v4 + design tokens
```

### Key functions in `src/lib/data.ts`

| Function | What it does |
| --- | --- |
| `fetchPredictions()` | Reads `predictions`, keeps only the latest model run (by `created_at`), filters out expired ones, and maps every row through `derivePrediction()`. |
| `derivePrediction(raw)` | Pure function: turns raw quantiles + attribution into the `PredictionWithRefs` shape the UI consumes. **The only place display values are computed.** |
| `runModelAndRefresh()` | Calls the `triggerModelRun` server function then re-runs `fetchPredictions()`. |
| `fetchStores / fetchFoodBanks / fetchItems` | Simple list queries. |
| `createStore / createFoodBank` | Used during sign-up. |
| `addInventorySnapshot / deleteInventorySnapshot` | Retailer inventory CRUD. Delete also wipes the linked predictions so the row disappears for the coordinator. |
| `findOrCreateItem` | Upserts the canonical `items` row so two retailers logging "Bananas" point at the same item. |
| `fetchPickupsForFoodBank / fetchPickupsForStore` | Filtered pickup lists; each one enriches rows with `confirmed_by_profile` for contact info. |
| `fetchActivePickupKeys()` | Returns a `Set<"storeId|itemId">` of pickups already confirmed/completed, so the coordinator grid can hide them. |
| `confirmPickup / markPickupCompleted` | Status transitions. |
| `updateProfileName / updateStore / updateFoodBank` | Backing the settings dialog. |

---

## 6. Backend / Server Functions

There is exactly **one** privileged server function:

### `triggerModelRun` — `src/lib/predictions.functions.ts`

- Authored with `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`.
- Re-checks the caller's role on the server (`supabase.rpc("has_role", ...)`)
  and rejects non-coordinators — a defense-in-depth check on top of RLS.
- Reads every `inventory_snapshots` row joined with its item and store.
- Maps app-side item/store names to the **model's** identifiers via two
  alias tables (`MODEL_ITEM_ALIASES`, `MODEL_STORE_ALIASES`) so the trained
  encoders find a match. Unknown items still flow through (the model maps
  unknowns to `-1`, which XGBoost treats as missing).
- POSTs the batch to `${MODEL_SERVICE_URL}/predict` with header
  `X-API-Key: ${MODEL_SERVICE_API_KEY}`.
- Inserts the returned predictions into `public.predictions` using the
  service-role client (RLS on `predictions` allows `INSERT` only to
  `service_role`).

Required server env vars: `MODEL_SERVICE_URL`, `MODEL_SERVICE_API_KEY`,
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Everything else the UI does goes through the **browser** Supabase client
under RLS — there are no REST or edge function endpoints.

---

## 7. The Forecasting Model Service

Lives in `model-service/`. It is a separate deployable; the README inside
that folder is the operational manual. Summary:

### Model

- **Algorithm**: XGBoost quantile regression.
- **Three quantiles per row**: `q10`, `q50`, `q90`. These are the *number
  of units expected to sell* over the snapshot → expiry window.
- Two file layouts are supported (`MODEL_LAYOUT` env):
  - `multiquantile` (default): one Booster outputting three columns.
  - `three`: three Booster files `xgboost_model_q{10,50,90}.json`.
- Negative outputs are clamped to 0 and quantiles are sorted per-row so
  `q10 ≤ q50 ≤ q90` even if the boosters cross.

### Features (12)

Built inside `_build_features()` in `model-service/main.py`:

`dow, is_weekend, month, is_holiday, is_promo, shelf_life_days,
item_id_code, category_code, store_id_code, state_code,
days_until_expiry, is_near_expiry`

Categorical fields are encoded with `encoders.json` (a JSON dump of the
training-time `LabelEncoder` mappings). Unknown categories become `-1`.
Holidays are looked up with the `holidays` Python package, scoped to the
row's US state when given.

### Contract

- `POST /predict` with header `X-API-Key`. Body: `{ rows: [...] }`.
- Each row carries the public inventory fields plus optional model-native
  aliases (`model_item_id`, `model_store_id`, `model_category`,
  `shelf_life_days`, `is_promo`, `sales_history`).
- Response: same row identifiers + `sales_q10/q50/q90` + `attribution`
  (object with `recent_trend`, `promo_active`, `window_days`).
- `GET /health` returns model version and layout.

The service **never** computes surplus, target date, or driver prose —
those are exclusively the Lovable app's responsibility. This split keeps
the model swappable without UI changes.

### Files in `model-service/`

| File | Purpose |
| --- | --- |
| `main.py` | FastAPI app, request/response models, feature engineering, prediction & attribution. |
| `model_loader.py` | Loads booster(s), `encoders.json`, and `item_catalog.csv` at startup. |
| `encoders.json` | Training-time label encoders. Must match the model's vocabulary. |
| `item_catalog.csv` | `item_id, shelf_life_days` lookup so a row without explicit shelf life still gets a sensible default. |
| `Dockerfile`, `render.yaml`, `requirements.txt` | Deployment to Render (free tier; sleeps after ~15 min). |

### Local run

```bash
cd model-service
pip install -r requirements.txt
API_KEY=devkey uvicorn main:app --reload
```

After deploy, set the URL + API key as the `MODEL_SERVICE_URL` and
`MODEL_SERVICE_API_KEY` server secrets in the Lovable app — the Refresh
button on the coordinator dashboard will then start working.

---

## 8. Security Model

- **Auth**: Supabase email/password. Anonymous sign-ups are disabled.
- **All public-schema tables** have RLS enabled and explicit `GRANT`s for
  `authenticated` and `service_role`. Nothing is granted to `anon`.
- **Profiles**: a user can `SELECT/INSERT/UPDATE` only their own row.
  A `prevent_profile_privilege_escalation` trigger (defined in migrations)
  and a `WITH CHECK` clause on the UPDATE policy both block changes to
  `role`, `store_id`, `food_bank_id`, and `id` — so a user cannot promote
  themselves to coordinator or steal another store.
- **`inventory_snapshots`**: a retailer can INSERT/UPDATE/DELETE only for
  their own `store_id`. SELECT is restricted to the user's store or to
  coordinators (broad read is intentional and required for the model
  service to see snapshots).
- **`pickups`**: SELECT restricted to the requesting user's store or food
  bank. INSERT requires the user's profile to match `food_bank_id` and
  have the `coordinator` role.
- **`predictions`**: SELECT restricted to the user's store or to
  coordinators. INSERT is service-role only — only the
  `triggerModelRun` server function can write predictions.
- **`daily_sales`**: SELECT restricted to the user's store or to
  coordinators.
- Helper functions in Postgres (`SECURITY DEFINER`, `SET search_path =
  public`): `has_role`, `current_user_store`, `current_user_food_bank`,
  `prevent_profile_privilege_escalation`.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` and `MODEL_SERVICE_API_KEY` are
  read **only** inside server-function handlers. The publishable Supabase
  key is the only credential shipped to the browser.

---

## 9. Setup & Running Locally

### Prerequisites

- [Bun](https://bun.com) (used as the package manager; npm works too)
- A Lovable Cloud (Supabase) project — the integration provisions one
  automatically inside Lovable
- A Google Maps API key with **Maps JavaScript API** and **Geocoding API**
  enabled (provided via the Lovable Google Maps connector)
- Python 3.11+ if you want to run the model service locally

### Environment variables

Frontend (auto-populated by Lovable in `.env`; needed for any other host):

| Var | Where used |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser client |
| `VITE_SUPABASE_PROJECT_ID` | Diagnostics |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | LocationPicker, reverse-geocode |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | Maps connector |

Server (set as Lovable secrets, not committed):

| Var | Where used |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | `requireSupabaseAuth` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role inserts in `triggerModelRun` |
| `MODEL_SERVICE_URL` | FastAPI endpoint, e.g. `https://durare-model.onrender.com` |
| `MODEL_SERVICE_API_KEY` | Shared secret sent as `X-API-Key` |
| `LOVABLE_API_KEY` | Lovable AI gateway (reserved) |

### Install + run

```bash
# 1) Install
bun install

# 2) Apply DB migrations (handled automatically by Lovable Cloud;
#    or use the Supabase CLI against your project: `supabase db push`)

# 3) Dev server
bun run dev          # http://localhost:5173

# 4) Production build
bun run build
```

### Run the model service locally

```bash
cd model-service
pip install -r requirements.txt
API_KEY=devkey MODEL_LAYOUT=multiquantile uvicorn main:app --reload --port 8000
# Then set MODEL_SERVICE_URL=http://localhost:8000 and
# MODEL_SERVICE_API_KEY=devkey in the Lovable app's secrets.
```

You need to drop your own trained model in `model-service/`:

- `xgboost_model.json` (multiquantile) **or**
  `xgboost_model_q10.json` / `_q50.json` / `_q90.json` (three-booster).
- `encoders.json` — exported from your training notebook.
- `item_catalog.csv` — same file the app uses to look up shelf life.

---

## 10. Non-obvious Gotchas & Conventions

- **The model never computes display values.** Surplus, confidence band,
  target date, and driver prose are derived in `derivePrediction()`. If
  the model is replaced, only that one function needs to know.
- **Only the latest model run is shown.** `fetchPredictions()` keeps rows
  whose `created_at` matches the newest row's `created_at` — older runs
  stay in the table for history but are filtered out of the UI.
- **`fetchActivePickupKeys()` is what makes claims race-safe.** Once a
  coordinator confirms a pickup, every coordinator's grid filters that
  `(store, item)` pair out on the next refetch.
- **Inventory delete cascades to predictions.** `deleteInventorySnapshot()`
  also deletes predictions for the same `(store, item)` pair so a removed
  item disappears from the coordinator view immediately.
- **Profile field immutability is enforced in two places** — the
  `prevent_profile_privilege_escalation` trigger and a `WITH CHECK`
  clause. Either alone would block the attack; both are kept for
  defense-in-depth.
- **Model item/store aliases live in `predictions.functions.ts`.** If you
  add a new retailer or item that the trained model knows about, add it to
  `MODEL_STORE_ALIASES` / `MODEL_ITEM_ALIASES`. Unknown values still work
  but the model treats them as `-1` (missing).
- **Render's free tier sleeps.** The first `Refresh` after ~15 min idle
  takes ~30 s to wake the model service. This is expected.
- **Auth gate**: every protected page lives under `src/routes/_authenticated/`.
  The pathless `_authenticated/route.tsx` layout (managed by the
  integration, `ssr: false`) redirects unauthenticated users to `/auth`.
  Do not add a second redirect in child routes.
- **`useAuth` re-fetches on a custom event.** When the settings dialog
  saves changes it dispatches `window.dispatchEvent(new Event("durare:profile-updated"))`.
  Anywhere you mutate the profile out-of-band, fire that event so the
  header/menu update without a reload.
- **No hardcoded colors.** Tailwind tokens come from `src/styles.css`.
  Adding a raw `text-white` or `bg-[#abc]` bypasses theming.
- **CSV importer is purely client-side.** Rows are inserted one at a time
  through the browser Supabase client, so RLS still applies — a malformed
  CSV cannot bypass the per-store check.
- **Distance is computed in the browser** with `haversineMiles()`; the
  database does not store geographic types, just `lat` and `lng` as
  `double precision`.

---

© 2026 Durare. Foresight & Stewardship.