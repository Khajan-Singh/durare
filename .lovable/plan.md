## 1. Auto-redirect after signup

Today after signup the user has to wait for the auth state + profile fetch to land before the page redirects. I'll make signup explicitly navigate to the correct dashboard the moment the account, org, and profile rows are created, so it feels instant — no second sign-in step.

- In `src/routes/auth.tsx`, after the successful `profiles.insert`, call `navigate({ to: role === "retailer" ? "/retailer" : "/coordinator" })`.
- Keep the existing `useEffect` redirect as a fallback for the sign-in flow.

## 2. Coordinator dashboard: nearby retailers

Right now the coordinator page just lists raw prediction cards with a distance number. I'll restructure it so a coordinator can:

1. See a **radius selector** (10 / 25 / 50 / 100 miles, default 50) anchored on their food bank's location.
2. Browse a **list of retailers within that radius**, each shown as a card with:
   - Store name + distance
   - Number of upcoming forecasts
   - Total predicted surplus units (next 72h)
   - Soonest pickup date
   - Mini "view forecasts" action that filters the prediction grid below to just that store
3. Below the retailer list, the existing prediction grid stays, but it's filtered by (a) the radius and (b) the optionally-selected store.

Layout:

```text
┌──────────────────────────────────────────────────┐
│ Header + radius pills (10/25/50/100 mi) + sort   │
├──────────────────────────────────────────────────┤
│ Summary strip (units, retailers, forecasts)      │
├──────────────────────────────────────────────────┤
│ Retailers within 50 mi    [clear filter]         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│ │ Store A │ │ Store B │ │ Store C │  ← clickable │
│ │ 4.2 mi  │ │ 11 mi   │ │ 28 mi   │              │
│ │ 3 fcsts │ │ 1 fcst  │ │ 2 fcsts │              │
│ │ 42 u    │ │ 12 u    │ │ 18 u    │              │
│ └─────────┘ └─────────┘ └─────────┘              │
├──────────────────────────────────────────────────┤
│ Prediction cards (filtered)                      │
└──────────────────────────────────────────────────┘
```

## Technical details

- `src/routes/auth.tsx`: add the explicit `navigate(...)` call inside `onSignUp` after `profiles.insert` succeeds.
- `src/routes/_authenticated/coordinator.tsx`:
  - Add `radiusMiles` state (default 50) and `selectedStoreId` state.
  - Compute distance for every prediction's store using the existing `haversineMiles` util and the coordinator's `myFoodBank` coords.
  - Derive a `nearbyStores` array: unique stores with distance ≤ radius, plus per-store aggregates (forecast count, total predicted qty, soonest target_date).
  - Add a `RadiusPills` component (10/25/50/100). Disable when `myFoodBank` is null and show a hint.
  - Add a `RetailerCard` grid section above the prediction grid. Clicking a card toggles `selectedStoreId`; an active card highlights.
  - Filter the prediction grid by radius and (if set) `selectedStoreId`.
  - Update the summary strip to reflect the radius (units / stores / forecasts within radius).
- No DB or schema changes. No new dependencies.

## Out of scope (ask later if needed)
- Drawing the radius / retailers on an actual Google Map (the current page is a list view; happy to add map view as a follow-up).
- Letting a coordinator "claim" or message a retailer beyond the existing pickup-confirm flow.
