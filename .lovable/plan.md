
## Problem

On the signup screen, the "Your store" (retailer) and "Your food bank" (coordinator) dropdowns are unselectable because the `stores` / `food_banks` tables are empty in this environment — there's nothing to pick. Even when populated, forcing users to choose from a fixed list doesn't match the real workflow: a retailer signing up *is* registering their store location, and a coordinator is registering their food bank's location.

## Solution

Replace both dropdowns with a **Google Places address search + map preview**. The user types their store/food bank name or address, picks a real location from autocomplete (biased to "near me" when geolocation is granted), sees a small map confirming the pin, and on submit we create a new `stores` or `food_banks` row from that location and link the profile to it. This also feeds the lat/lng the coordinator dashboard already uses for distance calculations.

## Scope of changes

### 1. Google Maps connector
- Verify the Google Maps Platform connector is linked (it appears available in this workspace). If not, prompt to connect it during build.
- Use `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` for the browser Maps JS + Places API (New) Autocomplete.

### 2. New component: `LocationPicker`
`src/components/location-picker.tsx`
- Text input using Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions` (debounced, session token).
- "Use my location" button → `navigator.geolocation` to bias suggestions and recenter the map.
- Small Google Map (~200px tall) with a marker at the selected place.
- Returns `{ name, address, lat, lng }` to the parent on selection.
- Uses `google.maps.Marker` (not AdvancedMarkerElement) and no `mapId`, per Maps connector rules.

### 3. Signup flow (`src/routes/auth.tsx`)
- Remove the `<Select>` of existing stores/food banks.
- For retailer: render `<LocationPicker label="Your store" />`. Also keep a "Store name" input (e.g. "Whole Foods – Mission St") since Places gives a name but the user may want to override.
- For coordinator: render `<LocationPicker label="Your food bank" />` plus a "Food bank name" input.
- On submit, BEFORE calling `supabase.auth.signUp`:
  - Retailer: insert into `public.stores` (name, lat, lng, type='grocery') and capture the new id.
  - Coordinator: insert into `public.food_banks` (name, lat, lng, capacity=0, cold_storage=false) and capture the new id.
- Then run the existing signup + profile insert with the new id.

### 4. Data layer (`src/lib/data.ts`)
- Add `createStore({ name, lat, lng })` and `createFoodBank({ name, lat, lng })` helpers wrapping the inserts. Components don't talk to Supabase directly for writes.

### 5. RLS / grants (migration)
The current `stores` and `food_banks` tables likely only allow read. To let a signing-up user create their own row, we need either:
- An anon-callable RPC (`create_store_for_signup`, `create_food_bank_for_signup`) marked `SECURITY DEFINER` that inserts and returns the new id, OR
- Allow `INSERT` for `authenticated` and run the inserts AFTER `supabase.auth.signUp` resolves (the user is signed in immediately when email confirmations are off).

I'll go with the second option (simpler, no new RPC): add `INSERT` policies on `stores` and `food_banks` for `authenticated` role, and grant `INSERT` to `authenticated`. Order in signup becomes: signUp → insert store/foodbank → insert profile with the new id.

### 6. Cleanup
- Remove the `fetchStores` / `fetchFoodBanks` calls from `auth.tsx` (no longer needed there).
- Keep them elsewhere — coordinator dashboard still lists stores for distance calcs.

## Out of scope
- No changes to coordinator dashboard, retailer dashboard, or pickups page.
- No de-duplication of stores (two retailers picking the same address create two rows) — can be added later if needed.
- No reverse-geocoding fallback if Places returns no results.

## Open question
Should the user be able to **also** join an existing store/food bank that someone else already registered (so two coordinators at the same food bank share inventory)? For now I'll assume **no — every signup creates a fresh row**, matching the "this is my location" framing. Let me know if you'd rather show a "this address is already registered — join them?" prompt.
