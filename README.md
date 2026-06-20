# Durare

> **Foresight & Stewardship.** Forecast donatable grocery surplus days in
> advance so food-bank coordinators can plan pickups with confidence and
> rescue food that would otherwise be thrown away.

Durare is a two-sided web app that connects **retailers** (grocery stores
with at-risk inventory) and **coordinators** (food banks that pick the
inventory up). An external XGBoost model predicts how much of each item
is likely to go unsold before expiry; the app turns those raw quantile
forecasts into actionable "rescue this many units, this many days before
expiry" recommendations, lets a coordinator claim them, and tracks each
rescue through to delivery.

- **Live preview:** https://id-preview--a431f6f1-dcb4-42d5-a5c4-b2ea541f5a38.lovable.app
- **Published:** https://durare.lovable.app

---

## 1. Overview

### The problem

Grocery retailers throw out enormous amounts of edible food every week.
Most of it is donatable, but two sides need to coordinate before it
expires:

1. The store has to *know* what is about to go to waste, *which* food
   bank wants it, and *when* to set it aside.
2. The food bank has to *find* that surplus across many stores, *trust*
   the prediction enough to dispatch a truck, and *schedule* the pickup
   with enough lead time for transport and cold storage.

Both sides today rely on phone calls, spreadsheets, or guesswork, and
the rescue happens (if at all) the day food expires — too late to plan a
route, too late to refrigerate, often too late to use.

### What Durare does

- **Retailers** log inventory snapshots (item, quantity, expiry date)
  one at a time or via CSV upload.
- An **AI surplus-forecast model** ingests those snapshots, sales history
  signals, calendar features, and shelf-life data, and emits three
  quantile predictions per item (`q10`, `q50`, `q90` units expected to
  sell before expiry).
- The app **derives** the human-facing numbers — predicted surplus,
  confidence band, recommended pickup date, plain-English "why this
  forecast?" drivers — from those raw quantiles. *The app never invents
  a forecast itself.*
- **Coordinators** see a dashboard of forecasted surplus across every
  retailer, sorted by urgency, with distance-from-bank and confidence
  built in.
- A coordinator **claims** a forecast → a `pickup` row is created, the
  forecast disappears from every other coordinator's dashboard, and the
  retailer's inventory row flips to "Claimed by …".
- After pickup, the coordinator marks it **completed** → the row moves
  to the retailer's **Deliveries** history and the coordinator's
  completed list.

### Who it's for

- Grocery / convenience retailers who want a no-friction way to donate
  rather than discard.
- Food-bank pickup coordinators planning routes a week in advance.
- (Future) Logistics partners and municipal waste-reduction programs.

---

## 2. Architecture

### Tech stack

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Framework        | **TanStack Start v1** (React 19, file-based routing, SSR-capable)      |
| Build tool       | **Vite 7**                                                             |
| Styling          | **Tailwind CSS v4** (token-driven theme in `src/styles.css`)           |
| UI primitives    | **shadcn/ui** on Radix (in `src/components/ui/`)                       |
| State / fetching | **TanStack Query v5**                                                  |
| Backend          | **Lovable Cloud / Supabase** — Postgres + Auth + RLS                   |
| Server logic     | **TanStack `createServerFn`** (no Edge Functions)                      |
| Forecast model   | **External FastAPI service** wrapping an XGBoost quantile booster      |
| Maps             | **Google Maps JS API** (Places + Marker), via Lovable connector        |
| Hosting target   | Cloudflare Workers (via nitro), through Lovable                        |

### Process model

```text
           ┌─────────────────────────────────────────────────────┐
           │                   Browser (React)                   │
           │  TanStack Router  ·  TanStack Query  ·  shadcn/ui   │
           └───────┬─────────────────────────────┬───────────────┘
                   │ Supabase JS (RLS, user JWT) │
                   ▼                             │
           ┌─────────────────┐                   │
           │  Supabase / PG  │  ◄── RLS scoped to auth.uid()
           │  + Auth         │                   │
           └─────────────────┘                   │
                   ▲                             │ createServerFn (RPC)
                   │ service-role insert         │
           ┌───────┴──────────────┐              ▼
           │ TanStack server fn   │     ┌───────────────────────┐
           │ triggerModelRun()    │ ──► │ FastAPI model-service │
           │ (auth + role check)  │     │  XGBoost quantiles    │
           └──────────────────────┘     └───────────────────────┘
```

### Key design decisions (and why)

1. **Two roles, one app.** Retailer and coordinator share auth,
   navigation, and data model — but each gets its own pair of pages
   (`/retailer`+`/deliveries` vs `/coordinator`+`/pickups`). The
   nav is rebuilt from `profile.role` in `AppShell`. *Why:* the value
   of the product is in the handoff; splitting it into two apps would
   prevent shared truth (claims, completion state) from being visible
   to both sides in real time.

2. **The app never computes a forecast.** The model writes raw
   quantiles (`sales_q10/50/90`) + an attribution JSON; everything
   user-facing (predicted surplus = `qty − q50`, confidence band,
   target pickup date, prose drivers) is derived once in
   `derivePrediction()` (`src/lib/data.ts`). *Why:* a single source of
   truth, no drift between pages, and the model can be retrained or
   swapped without touching the UI.

3. **Server functions, not Edge Functions, for app logic.**
   `triggerModelRun` runs as a TanStack `createServerFn` with the
   `requireSupabaseAuth` middleware and explicitly re-checks the
   coordinator role server-side. *Why:* lower latency, type-safe RPC,
   and the same auth context as the browser query.

4. **Predictions are inserted with the service role.** RLS on
   `predictions` allows `SELECT` to `authenticated` but `INSERT` only to
   `service_role`. The server function dynamically imports
   `supabaseAdmin` *inside* the handler to keep the admin client out of
   the client bundle. *Why:* defence in depth — even a compromised
   browser session cannot poison the forecast feed.

5. **Pickup state is the single source of truth.** A forecast becomes
   "Claimed" the instant a `pickups` row exists (`status='confirmed'`)
   and "Delivered" when `status='completed'`. The coordinator dashboard
   filters out any prediction whose `(store_id, item_id)` already has a
   non-cancelled pickup, so claiming one removes it from every
   coordinator's dashboard — not just the one who claimed.

6. **Role-based RLS with helpers, not stored on profile.** Roles live
   in the `profiles` table but are guarded by a `BEFORE UPDATE` trigger
   (`prevent_profile_privilege_escalation`) that blocks any change to
   `role`, `store_id`, or `food_bank_id`. Two `SECURITY DEFINER`
   helpers (`current_user_store`, `current_user_food_bank`) keep RLS
   policies non-recursive.

7. **Token-driven theming.** All colors / shadows / gradients are CSS
   custom properties in `src/styles.css` and consumed through Tailwind
   v4 utilities. Components must use semantic tokens (`bg-primary`,
   `text-muted-foreground`) — never hardcoded hex or `bg-white`.

---

## 3. Repository layout

```text
.
├── src/
│   ├── routes/                       # File-based routing
│   │   ├── __root.tsx                # Root layout (head, router providers)
│   │   ├── index.tsx                 # Public landing page
│   │   ├── auth.tsx                  # Sign in / sign up + role + location
│   │   └── _authenticated/           # Auth-gated subtree (managed layout)
│   │       ├── route.tsx             # Auth gate (redirects to /auth)
│   │       ├── retailer.tsx          # Retailer inventory + claims
│   │       ├── deliveries.tsx        # Retailer post-pickup history
│   │       ├── coordinator.tsx       # Coordinator forecast dashboard
│   │       └── pickups.tsx           # Coordinator scheduled pickups
│   ├── components/
│   │   ├── app-shell.tsx             # Top bar, nav, settings, sign-out
│   │   ├── prediction-card.tsx       # Forecast card (coordinator)
│   │   ├── confirm-pickup-modal.tsx  # Coordinator claim dialog
│   │   ├── pickup-details-popover.tsx# Shared info popover (both roles)
│   │   ├── settings-dialog.tsx       # Update name / org name / address
│   │   ├── location-picker.tsx       # Google Maps + Places autocomplete
│   │   ├── confidence-bar.tsx        # Visual confidence band
│   │   └── ui/                       # shadcn primitives
│   ├── lib/
│   │   ├── data.ts                   # ALL Supabase reads/writes + derive
│   │   ├── predictions.functions.ts  # createServerFn: triggerModelRun
│   │   ├── food-catalog.ts           # Generated from item_catalog.csv
│   │   ├── utils.ts                  # cn, formatDate, daysUntil, haversine
│   │   └── error-*.ts                # Lovable error reporting glue
│   ├── hooks/
│   │   └── use-auth.ts               # Session + profile + live updates
│   ├── integrations/supabase/        # Auto-generated; do not edit
│   │   ├── client.ts                 # Browser publishable client
│   │   ├── client.server.ts          # Service-role admin client
│   │   ├── auth-middleware.ts        # requireSupabaseAuth for serverFn
│   │   ├── auth-attacher.ts          # Attaches JWT to serverFn calls
│   │   └── types.ts                  # Generated Database types
│   ├── assets/                       # Logo + image assets
│   ├── styles.css                    # Tailwind v4 theme tokens
│   ├── router.tsx                    # Router + QueryClient bootstrap
│   ├── start.ts                      # Server runtime (middleware wiring)
│   └── server.ts                     # SSR entry wrapper
├── supabase/migrations/              # 14 timestamped SQL migrations
├── model-service/                    # External FastAPI XGBoost service
│   ├── main.py                       # /predict and /health endpoints
│   ├── model_loader.py               # Loads booster(s) + encoders
│   ├── encoders.json                 # Label-encoder mappings from training
│   ├── item_catalog.csv              # Item → shelf-life lookup
│   ├── render.yaml                   # Render.com Blueprint
│   ├── Dockerfile
│   └── README.md
├── package.json
├── vite.config.ts                    # Wraps @lovable.dev/vite-tanstack-config
└── README.md                         # ← you are here
```

---

## 4. Core user flows

Each flow describes the *purpose* and *behaviour* end to end, not just
the click path.

### 4.1 Onboarding (sign up)

File: `src/routes/auth.tsx`

1. The visitor lands on `/` and clicks **Get started** → `/auth`.
2. They choose **Sign up** and pick a role: **Retailer** or
   **Coordinator**.
3. They fill name, email, password, **organisation name**, and use the
   `LocationPicker` (Google Places autocomplete + draggable map pin) to
   pin the store / food bank's exact address. Lat, lng and a
   human-readable address are all captured — the popovers everywhere
   else in the app show the address, not raw coordinates.
4. On submit:
   - `supabase.auth.signUp` creates the auth user (email/password; no
     email confirmation required for the demo flow).
   - The app inserts a `stores` or `food_banks` row.
   - It inserts a `profiles` row linking `auth.uid()` → role +
     `store_id` / `food_bank_id`. (A `BEFORE UPDATE` trigger then locks
     those columns against any later mutation.)
5. The session is now authenticated; the landing page's auth hook
   redirects retailers to `/retailer` and coordinators to
   `/coordinator`.

### 4.2 Retailer: logging inventory

File: `src/routes/_authenticated/retailer.tsx`

Purpose: get at-risk SKUs onto the forecasting feed with as little
friction as possible.

- **Add one item:** opens a drawer with a two-step picker — overall
  category (Produce, Bakery, Dairy, …) then a typeahead of specific
  items from `src/lib/food-catalog.ts`. Picking a known catalog item
  pre-fills shelf-life days (used by the model). Custom items are
  allowed; `findOrCreateItem()` reuses a row if the same `(name,
  category)` already exists.
- **CSV upload:** download a template, drop a file, see a per-row
  validation preview, then bulk-insert valid rows into
  `inventory_snapshots`. Invalid rows are flagged with the reason.
- **Inventory table:** each row shows item, qty, expiry date,
  days-to-expiry, and a **Claimed** column. A delivered (completed)
  row is hidden from this view — it has moved to Deliveries.
- **Delete:** removes both the inventory snapshot **and** any
  predictions tied to the same `(store_id, item_id)` so coordinators
  stop seeing it instantly.

### 4.3 Coordinator: forecast dashboard

File: `src/routes/_authenticated/coordinator.tsx`

Purpose: give the coordinator a ranked list of *actionable* surplus
across every store.

- Loads `fetchPredictions()` (latest model run, future expiry only) and
  `fetchActivePickupKeys()` (set of already-claimed `storeId|itemId`).
- Filters out any prediction already claimed by anyone, so the
  dashboard reflects only what's still rescuable.
- Groups by store, with per-store tiles (forecasts / units / soonest
  expiry) and a **Refresh predictions** button that calls the model
  server function.
- Each `PredictionCard` shows: item, predicted surplus + confidence
  band, recommended pickup date, days to expiry, distance from the
  food bank, a confidence chip (high / moderate / low), and a
  collapsible **Why this forecast?** panel with the derived prose.
- **Confirm Pickup** → opens `ConfirmPickupModal` to adjust quantity
  and date, then writes a `pickups` row (`status='confirmed'`,
  `confirmed_by = auth.uid()`). On success, the card disappears for
  every coordinator.

### 4.4 Coordinator: scheduled pickups

File: `src/routes/_authenticated/pickups.tsx`

- Two stacked groups: **Pending** (sorted by `scheduled_date` asc) then
  **Completed** (newest first), separated by a faint divider.
- Each row: an **Info** popover button (rendered via the shared
  `PickupDetailsPopover`) showing the counterpart's contact /
  organisation / address, the item, qty, scheduled date, distance, and
  the forecast drivers if the prediction is still in cache.
- **Mark Completed** flips `status` to `completed`. The row drops to
  the lower group, leaves the retailer's inventory view, and surfaces
  on their Deliveries tab.

### 4.5 Retailer: claims & deliveries

- On `/retailer`, any item with a pickup at `status='confirmed'` shows
  a **Claimed by …** button that opens the same shared popover with
  the coordinator's name, email, food bank name + address, scheduled
  date, qty, and distance. Deleting a claimed item is disabled to
  protect the coordinator's scheduled run.
- On `/deliveries`, the retailer sees the historical record of every
  completed pickup — purely for trust and audit.

### 4.6 Settings

File: `src/components/settings-dialog.tsx`

A gear icon in the top bar opens a dialog to update the user's
display name, the organisation name, and the address (same
`LocationPicker` used during sign-up). On save, the app dispatches a
`durare:profile-updated` window event that `useAuth` listens for and
re-reads the profile, so the UI updates without a refresh.

---

## 5. Forecast pipeline (the "why" behind every number)

The forecast feed is the heart of the app. End to end:

1. **Coordinator clicks Refresh predictions** on `/coordinator`.
2. Browser invokes the `triggerModelRun` server function
   (`src/lib/predictions.functions.ts`). The `attachSupabaseAuth`
   client middleware attaches the user's JWT.
3. `requireSupabaseAuth` middleware validates the token server-side
   and injects `{ supabase, userId, claims }` into `context`.
4. The handler explicitly re-checks `has_role(userId, 'coordinator')`
   via RPC and rejects otherwise.
5. It reads every row from `inventory_snapshots` joined with `items`
   and `stores`, maps display names to the model's training aliases
   (e.g. "Bananas" → `ripe_banana`, "Mission Fresh Market" →
   `store_001`), and POSTs the batch to
   `${MODEL_SERVICE_URL}/predict` with the `MODEL_SERVICE_API_KEY`.
6. The FastAPI service (`model-service/main.py`) builds 12 derived
   features per row (day-of-week, weekend flag, month, holiday flag,
   promo flag, shelf-life days, encoded item/category/store/state,
   days-until-expiry, near-expiry flag) and runs the XGBoost booster.
   It supports two layouts: a multi-quantile booster emitting
   `[q10, q50, q90]` columns or three single-quantile boosters. Output
   is sorted row-wise so the quantiles stay monotonic even if the
   booster crosses.
7. The service returns raw `sales_q10/50/90` per row plus a small
   `attribution` JSON (`recent_trend`, `promo_active`, `window_days`).
   It never computes surplus or recommendations — that's the app's
   job.
8. The server function inserts the rows into `predictions` using
   `supabaseAdmin` (service role), because RLS allows INSERT only to
   `service_role`.
9. The browser invalidates the `["predictions"]` query; the dashboard
   re-renders.
10. `derivePrediction()` in `src/lib/data.ts` turns each raw row into:
    - `predicted_surplus_qty = round(qty − q50)`
    - `confidence_low = round(qty − q90)` (high sales → low surplus)
    - `confidence_high = round(qty − q10)` (low sales → high surplus)
    - `confidence_label`: `high` / `moderate` / `low` from the band's
      relative width
    - `target_date`: expiry minus a 1–3 day buffer that shrinks as
      confidence falls, clamped to `[snapshot_date, expiry-1]`
    - `drivers`: a plain-English paragraph stitched from the
      attribution JSON ("~30 of 42 units expected to sell, leaving ~12
      surplus (range 8–17). Confidence is moderate — recent sell-
      through is trending down ~8%, no promotion is active, the window
      falls on a mix of weekday and weekend. Pickup recommended 2 days
      before expiry (Jun 25).")

---

## 6. Modules & components — what each one does

### `src/lib/data.ts`

The **only** module that talks to Supabase from client code. Exports
typed read/write helpers for every table the UI touches:

- `fetchStores`, `createStore`, `updateStore`
- `fetchFoodBanks`, `createFoodBank`, `updateFoodBank`
- `fetchItems`, `findOrCreateItem`
- `fetchInventoryForStore`, `addInventorySnapshot`, `deleteInventorySnapshot`
- `fetchPredictions`, `derivePrediction`, `refreshPredictions`,
  `runModelAndRefresh`
- `fetchPickupsForStore`, `fetchPickupsForFoodBank`,
  `fetchActivePickupKeys`, `confirmPickup`, `markPickupCompleted`
- `updateProfileName`

`derivePrediction()` is the load-bearing pure function described in
§5. `attachConfirmedByProfiles()` bulk-loads the coordinator profile
for each pickup so the popover can show the right name and email.

### `src/lib/predictions.functions.ts`

The single TanStack server function in the codebase:
`triggerModelRun`. Lives in `src/lib/` (not `src/server/`) so the
client may import it via `useServerFn`; the handler body is stripped
from the client bundle by Vite's `createServerFn` transform.

### `src/lib/food-catalog.ts`

Generated from `model-service/item_catalog.csv`. Provides the typeahead
for "specific item" in the retailer drawer and supplies shelf-life
days when known. Used to keep new inventory rows aligned with the
model's training vocabulary.

### `src/lib/utils.ts`

`cn()` (clsx + tailwind-merge), `formatDate`, `daysUntil`, and
`haversineMiles` (used for store ↔ food-bank distance in the UI).

### `src/hooks/use-auth.ts`

Subscribes once to `supabase.auth.onAuthStateChange` and exposes
`{ session, user, profile, loading }`. Also listens for the in-app
`durare:profile-updated` custom event so the settings dialog can
force a profile refetch without round-tripping through auth.

### `src/components/app-shell.tsx`

The signed-in chrome: logo + title, role-dependent nav links, the
user's name + role chip, settings gear, sign-out, mobile bottom nav,
and footer. Renders `<SettingsDialog />` mounted at the shell so it's
available from any page.

### `src/components/prediction-card.tsx`

Renders one forecast: title, surplus + units, confidence chip,
`<ConfidenceBar />`, distance, days-to-expiry, target pickup date,
collapsible **Why this forecast?**, and the **Confirm Pickup** CTA
which mounts `<ConfirmPickupModal />`.

### `src/components/confirm-pickup-modal.tsx`

Pre-fills quantity and target date from the prediction; the
coordinator can adjust both. On submit, calls `confirmPickup()` and
invalidates the relevant queries.

### `src/components/pickup-details-popover.tsx`

The shared info popover, used identically on `/retailer`,
`/deliveries`, and `/pickups`. Accepts a `Pickup` and a `viewer:
"retailer" | "coordinator"` and renders the counterpart's contact
block + the pickup's logistics.

### `src/components/location-picker.tsx`

Lazy-loads the Google Maps JS API on first interaction using the
browser Maps key surfaced through the Lovable connector
(`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`). Provides Places
Autocomplete predictions, a draggable map marker, and a "use my
location" button. Returns `{ name, address, lat, lng }`.

### `src/components/settings-dialog.tsx`

Reads the current profile + linked store / food bank, lets the user
edit display name, organisation name, and address. Saves through
`updateProfileName` + `updateStore` / `updateFoodBank`, then fires
`durare:profile-updated`.

### `src/components/confidence-bar.tsx`

Tiny visual: renders the [`confidence_low`, `confidence_high`] band
with the `predicted_surplus_qty` marker.

### `src/components/ui/`

Standard shadcn/ui primitives — do not modify unless restyling the
entire theme. All colours come from the CSS variables in
`src/styles.css`.

---

## 7. Data model

All tables live in `public` with RLS enabled and `GRANT`s issued to
`authenticated` + `service_role`. The full schema is in
`supabase/migrations/` (14 timestamped files); the consolidated
picture is:

### Tables

| Table                  | Purpose                                                            | Owner mutates  |
| ---------------------- | ------------------------------------------------------------------ | -------------- |
| `stores`               | Retailer location (name, address, lat/lng, state, type)            | Retailer       |
| `food_banks`           | Food-bank location (name, address, lat/lng, capacity, cold storage)| Coordinator    |
| `items`                | Catalog item (name, category, shelf-life days)                     | Retailer (insert via `findOrCreateItem`) |
| `profiles`             | Auth user → role + `store_id` / `food_bank_id`                     | Owner only; role/links locked by trigger |
| `inventory_snapshots`  | Point-in-time stock (`qty_on_hand`, `expiry_date`, catalog refs)   | Owning store's retailer |
| `predictions`          | Raw model output (`sales_q10/50/90`, `attribution`, `qty_on_hand`) | `service_role` only (via server fn) |
| `pickups`              | Claimed rescues (`status` = `confirmed` / `completed`, `confirmed_by`) | Owning food bank's coordinator |
| `daily_sales`          | Historical sales (reserved for richer lag features)                | Service role   |

### Enums & helpers

- `app_role` — `'retailer' | 'coordinator'`.
- `has_role(_user_id, _role)` — `SECURITY DEFINER`; the canonical role
  check used both in RLS policies and in the `triggerModelRun` server
  function.
- `current_user_store()` / `current_user_food_bank()` — `SECURITY
  DEFINER` helpers that return the caller's linked org id without
  triggering recursive RLS on `profiles`.
- `prevent_profile_privilege_escalation()` — `BEFORE UPDATE` trigger
  that raises if `role`, `store_id`, `food_bank_id`, or `id` change.

### RLS posture (highlights)

- `stores`, `food_banks`, `items`, `inventory_snapshots`, `predictions`,
  `pickups` are all readable by any `authenticated` user (cross-org
  visibility is what enables the marketplace).
- `inventory_snapshots` writes are gated to the owning store's retailer.
- `pickups` INSERT requires the coordinator's `food_bank_id` to match
  the row AND `has_role(auth.uid(),'coordinator')`. UPDATE additionally
  requires `food_bank_id = current_user_food_bank()`.
- `predictions` INSERT is restricted to `service_role` only.
- `profiles` SELECT is owner-only by default, plus a narrow policy that
  lets a counterpart read the limited contact info of someone listed in
  one of their pickups' `confirmed_by`.
- `stores` / `food_banks` INSERT requires the matching role; UPDATE
  requires ownership (the row id must match `current_user_*`).

### Data flow

```text
  Retailer ── adds inventory_snapshot ──►  predictions feed (after model run)
                                                   │
                                                   ▼
                                   Coordinator dashboard (forecast cards)
                                                   │
                       Confirm Pickup ◄────────────┘
                                                   ▼
                                  pickups (status=confirmed)
                                       │              │
                Retailer sees "Claimed"│              │ Coordinator
                                       │              │ /pickups (pending)
                                       └─────┬────────┘
                                             ▼
                          Coordinator marks completed
                                             │
                                             ▼
                            pickups.status = 'completed'
                              │                       │
              Retailer Deliveries tab          Coordinator pickups
                                                  (lower group)
```

---

## 8. Setup & running locally

### Prerequisites

- **Bun** ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`).
  npm works too — just substitute `npm install` / `npm run dev`.
- Access to the project's **Lovable Cloud** environment (Supabase
  URL + publishable key). The published app uses Lovable Cloud; you
  do not need a separate Supabase project unless you're forking.
- (Optional) A running **model service** — see §9.
- (Optional) A **Google Maps Browser API key** for the location
  picker (provisioned via the Lovable connector in the deployed app).

### Environment variables

The repo's `.env` already contains the public Supabase config injected
by Lovable Cloud:

```ini
# Client-visible (Vite replaces at build time)
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY=...
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID=...

# Server-only (process.env inside server functions)
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # never exposed to the browser
MODEL_SERVICE_URL=https://your-model-service.onrender.com
MODEL_SERVICE_API_KEY=...            # matches the model service
```

**Never** rename a service-only key to `VITE_*`. **Never** read
secrets at module scope in files imported by the browser.

### Install & run

```bash
bun install
bun run dev      # vite dev — http://localhost:8080
bun run build    # production build
bun run preview  # serve the build
bun run lint
```

### Database migrations

SQL migrations live in `supabase/migrations/` and are applied to the
linked Lovable Cloud project automatically. If you fork to your own
Supabase project, apply them in timestamp order — the schema is
self-contained (enum, tables, GRANTs, RLS policies, helper functions,
trigger). Do not edit `src/integrations/supabase/types.ts` by hand;
it's regenerated from the schema.

### First-run seeding

There is no seed script — the app expects you to:

1. Sign up two test accounts (one retailer, one coordinator) from
   `/auth`, each with their own organisation + address.
2. As the retailer, add a few inventory rows (or upload the CSV
   template).
3. As the coordinator, click **Refresh predictions**. The model
   service must be reachable; if not, the dashboard remains empty.

---

## 9. The model service (`model-service/`)

A standalone FastAPI app, deployable to Render via the included
`render.yaml` Blueprint or any Docker host. It is intentionally
separate from the web app so the model can be retrained, swapped, or
scaled without redeploying the front end.

- `POST /predict` — accepts `{ rows: PredictRow[] }`, authenticated by
  the `X-API-Key` header. Returns three quantiles + `attribution` per
  row. See `model-service/README.md` for the request/response
  schema and the two supported model layouts (`multiquantile` or three
  single-quantile boosters).
- `GET /health` — readiness probe (`{ ok, model_version, layout }`).
- Required files in the folder before deploy:
  - `xgboost_model.json` (or `_q10/_q50/_q90.json` for the `three`
    layout)
  - `encoders.json` — label-encoder mappings exported from training
  - `item_catalog.csv` — used both by the service (shelf-life lookup)
    and copied into the web app as `src/lib/food-catalog.ts`.

Render free tier sleeps after ~15 min idle; the first request after
sleep takes ~30 s while the dyno spins up.

---

## 10. Non-obvious gotchas

- **Predictions list shows only the latest run.** `fetchPredictions()`
  reads every future-expiry row, then filters to the `created_at` of
  the newest row — so historical model runs are kept in the table for
  audit but never appear in the UI.
- **Confidence is band-width relative.** A wide `q10–q90` interval
  shrinks the recommended pickup buffer to 1 day; a tight one
  stretches it to 3. This is a deliberate "trust the model less when
  it's less certain" choice, implemented entirely in
  `derivePrediction()`.
- **Target date is clamped.** Recommendations never fall outside
  `[snapshot_date, expiry_date − 1]`, even if the buffer math would
  push them earlier than today or onto the expiry day itself.
- **Deleting inventory also deletes predictions.** This is intentional
  so a retailer pulling an item immediately removes it from every
  coordinator's dashboard. Pickups are *not* deleted (they're history).
- **Removing a claimed item is disabled, not silent-cancel.** If a
  retailer needs to back out a claimed item, that flow is explicitly
  out of scope for now (see `.lovable/plan.md`).
- **Profile contact info is restricted.** A coordinator can only read
  a retailer profile (and vice versa) if they share a `pickups` row.
  This is enforced by the "read pickup partner profiles" SELECT
  policy on `profiles`.
- **`role` / `store_id` / `food_bank_id` are immutable post sign-up.**
  The privilege-escalation trigger raises on any change. To switch
  roles, create a new account.
- **No Edge Functions.** All server logic is `createServerFn`. Adding a
  webhook would mean a TanStack server route under
  `src/routes/api/public/*` with signature verification — not a
  Supabase Edge Function.
- **The browser Maps key is loaded lazily.** The Maps script tag is
  injected only when `LocationPicker` mounts. Don't move the loader
  to `__root.tsx` — it would block SSR and add latency to every page.
- **`useAuth` uses a custom event for live updates.** When the
  settings dialog mutates the profile, it dispatches
  `durare:profile-updated` so the hook can re-read without bouncing
  the session. There is currently no realtime subscription on
  `profiles`.
- **Leaked-password protection is not enabled by default.** Turn it on
  in the Lovable Cloud auth settings (Email → Password HIBP Check) if
  you're going to production.
- **The "Produce" filter chip was removed from `/retailer`.** Items do
  not have a reliable produce/non-produce tag, so the filter was
  dropped rather than mislead users.
- **TanStack Start specifics.** Do *not* create `src/pages/`,
  `src/routes/_app/`, or Next/Remix-style layouts — file-based routing
  is rooted at `src/routes/__root.tsx`. `routeTree.gen.ts` is
  auto-generated; never edit it by hand.

---

## 11. Glossary

- **Snapshot** — a row in `inventory_snapshots`; what a store has on
  hand at a point in time, with its expiry.
- **Forecast / prediction** — a row in `predictions`; raw quantile
  output from the model for one `(store, item, snapshot, expiry)`.
- **Surplus** — `qty_on_hand − q50`; predicted unsold units at expiry.
- **Pickup** — a claimed rescue; `confirmed` until it happens,
  `completed` after.
- **Delivery** — a pickup whose `status='completed'`, shown to the
  retailer for audit.
- **Coordinator** — food-bank user who claims and schedules pickups.
- **Retailer** — store user who logs inventory.
- **Drivers** — the plain-English "why this forecast?" sentence built
  from the model's attribution JSON.

---

© 2026 Durare. Foresight & Stewardship.