## Goal

Add an "Upload CSV" button next to the "Add Item" button on the retailer dashboard so retailers can bulk-add inventory rows from a CSV that follows a fixed template.

## CSV template

I'll publish a downloadable template at `public/inventory-template.csv` with this exact header (one row per inventory item):

```text
category,item_name,quantity,expiry_date
Produce,Bananas,12,2026-06-25
Bakery,Sourdough Loaf,4,2026-06-22
```

Columns:
- `category` — one of the overall categories used in the app (Produce, Bakery, Dairy, etc.) from `OVERALL_CATEGORIES`.
- `item_name` — specific item name. If it matches a catalog entry under that category, we attach the catalog ids + shelf life; otherwise we fall back to `findOrCreateItem` like the manual flow.
- `quantity` — positive integer.
- `expiry_date` — ISO `YYYY-MM-DD`.

## UI changes (retailer.tsx only)

1. Add an "Upload CSV" button next to "Add Item" (both in the forecast insight section and likely the empty-state / header where Add Item appears) with a matching boxy style.
2. Button opens a small drawer/modal mirroring the existing Add Item drawer styling, containing:
   - A short description of the expected format.
   - A "Download template" link pointing to `/inventory-template.csv`.
   - A file input accepting `.csv`.
   - A preview list showing parsed rows with per-row validation status (ok / error reason).
   - "Import N items" submit button + Cancel.
3. On submit, iterate valid rows and call the same `findOrCreateItem` + `addInventorySnapshot` pair already used by the manual form, then invalidate the `["inventory", store_id]` query and toast a summary (e.g. "Imported 8 items, 1 skipped").

## Parsing

- Lightweight inline CSV parser (handles quoted fields, commas, CRLF) — no new dependency.
- Validate header row matches the template exactly; otherwise show an error and abort.
- Per-row validation: required fields present, quantity is a positive integer, date parses, category is known.

## Out of scope

- No schema/database changes — uses existing `items` and `inventory_snapshots` tables via existing `src/lib/data` helpers.
- No changes to daily sales, coordinator view, or other routes.
- No background job — import runs client-side sequentially with a progress toast.

## Files touched

- `src/routes/_authenticated/retailer.tsx` — new button, new drawer, parser, import handler.
- `public/inventory-template.csv` — new downloadable template.
