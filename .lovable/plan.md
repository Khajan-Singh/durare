## Goal
Wire pickups into the retailer view end-to-end: claim state, completion (Deliveries history), and an info popup on both sides — with the coordinator dashboard hiding anything already claimed and the pickups page sorting completed items to the bottom.

## State model (single source of truth: `pickups` table)

For any retailer inventory row, derive status from the most recent matching pickup `(store_id, item_id)`:
- no pickup → **Available**
- pickup.status = `confirmed` → **Claimed**
- pickup.status = `completed` → **Delivered** (no longer shown on inventory tab)

The coordinator's forecast list filters out any prediction `(store_id, item_id)` that already has a non-cancelled pickup. So claiming one removes it from every coordinator's dashboard — not just the one who claimed.

## Database changes (one migration)

1. Allow authenticated users to read minimal contact info for any profile (needed so retailers can see the coordinator who claimed an item, and coordinators can see retailer contacts). New SELECT policy on `profiles` for `authenticated`, alongside the existing "own profile" policy.
2. Add an `address` text column to `food_banks` (currently only lat/lng/name) so the popup can show a real street address. Existing rows stay null; new entries will populate it from the location picker if available, otherwise it shows "Coordinates only".
3. No schema change on `pickups` — `status` already supports `confirmed` / `completed`. Confirm RLS already lets authenticated read all pickups (it does), so retailers can see pickups against their store.

## Data layer (`src/lib/data.ts`)

Add:
- `fetchPickupsForStore(storeId)` — pickups joined with `items`, `food_banks`, and `confirmed_by_profile:profiles!confirmed_by(display_name,email)`.
- `fetchActivePickupKeys()` — returns `Set<"storeId|itemId">` of pickups in `confirmed` or `completed`, used by coordinator to hide claimed forecasts.
- Extend `fetchPickupsForFoodBank` to include the same joins so the coordinator popup can render food-bank/coordinator info too.
- Extend `Pickup` type with `food_banks` and `confirmed_by_profile` shapes.

## Retailer page (`src/routes/_authenticated/retailer.tsx`)

- Query pickups for the store; build a `pickupByItemId` map.
- Filter inventory rows: drop rows whose latest pickup is `completed` (those move to Deliveries).
- Add a **Claimed** column between Status and the actions menu:
  - Available: subtle muted dot + "Available".
  - Claimed: primary-toned pill "Claimed by …" that's a button opening a popover/dialog with: coordinator display name + email, food bank name + address (or coords), scheduled date, qty, distance from store.
- Disable the "Remove item" action on claimed rows (or warn that the coordinator will lose the scheduled pickup) — safest is to disable and explain.

## Deliveries tab (new, retailer-only)

- New route `src/routes/_authenticated/deliveries.tsx` showing all `completed` pickups for the retailer's store. Columns: Item, Qty, Picked up on (scheduled_date), Food bank, Coordinator, Info (popover with the same details card).
- Add "Deliveries" link to retailer nav in `src/components/app-shell.tsx` (icon: `PackageCheck`).
- Inventory snapshot stays in DB (kept for historical model data) but is hidden from the retailer's inventory list once delivered — completion is what removes it from the live view, not deletion.

## Coordinator dashboard (`src/routes/_authenticated/coordinator.tsx`)

- Query `fetchActivePickupKeys()`; in the `rows` memo, filter out any prediction whose `(store_id, item_id)` is already in the set. So as soon as one coordinator confirms, the card disappears for everyone.
- Recompute the per-store "Forecasts / Units / Soonest" tiles from the filtered set so the retailer cards reflect what's actually still actionable.
- After successful confirm, invalidate both `["pickups"]` and `["predictions"]` (and the new `["active_pickup_keys"]` query) so the card vanishes immediately for the confirming user too.

## Pickups page (`src/routes/_authenticated/pickups.tsx`)

- Sort: pending (`confirmed`) first by `scheduled_date` asc, then `completed` at the bottom by `scheduled_date` desc. Add a faint divider row "Completed" between the two groups.
- Replace the bare item name with an **Info** button (uses the same `Info` icon) that opens a popover showing: store name + address-ish detail (lat/lng or store name), item, qty, scheduled date, distance, the prediction drivers if still available (look up by store_id+item_id from the predictions cache; fall back to "Forecast details unavailable" when the prediction has been pruned).

## Shared popup component

- Extract `PickupDetailsPopover` (new file `src/components/pickup-details-popover.tsx`) used by retailer inventory, retailer deliveries, and coordinator pickups page. It accepts a `Pickup` and a `viewer: "retailer" | "coordinator"` and renders the relevant counterpart's info card.

## Flow recap

1. Retailer adds item → Available.
2. Model predicts surplus → appears on coordinator dashboards.
3. Coordinator confirms → pickup row created (`confirmed`). Forecast disappears from every coordinator dashboard. Retailer row flips to "Claimed by {coordinator}" with popover. Pickup shows in Pickups page (top group).
4. Coordinator clicks "Mark Completed" → pickup `status='completed'`. Pickups page drops it to the bottom group. Retailer's inventory row disappears and the item appears under the new Deliveries tab.

## Out of scope (call out, don't build now)
- Cancelling a claimed pickup (returning the item to Available).
- Retailer being able to mark deliveries themselves.
- Editing scheduled date or quantity after confirmation.

Let me know if you want any of those bundled in, or if "remove item" on a claimed row should silently cancel the pickup instead of being disabled.
