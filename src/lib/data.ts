import { supabase } from "@/integrations/supabase/client";

export type Store = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
};

export type FoodBank = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  cold_storage: boolean;
};

export type Item = {
  id: string;
  name: string;
  category: string;
  shelf_life_days: number;
};

export type InventorySnapshot = {
  id: string;
  store_id: string;
  item_id: string;
  date: string;
  qty_on_hand: number;
  expiry_date: string;
  catalog_item_id: string | null;
  catalog_category_id: string | null;
  shelf_life_days: number | null;
  items?: Item | null;
};

export type Prediction = {
  id: string;
  store_id: string;
  item_id: string;
  target_date: string;
  predicted_surplus_qty: number;
  confidence_low: number;
  confidence_high: number;
  drivers: string | null;
  model_version: string | null;
  created_at: string;
};

export type PredictionWithRefs = Prediction & {
  item: Item;
  store: Store;
  days_to_expiry: number;
  confidence_label: "high" | "moderate" | "low";
};

export type PredictionAttribution = {
  recent_trend?: string;
  promo_active?: boolean;
  window_days?: string;
};

export type RawPrediction = {
  id: string;
  store_id: string;
  item_id: string;
  snapshot_date: string;
  expiry_date: string;
  qty_on_hand: number;
  sales_q10: number;
  sales_q50: number;
  sales_q90: number;
  attribution: PredictionAttribution | null;
  model_version: string | null;
  created_at: string;
  item: Item;
  store: Store;
};

export type Pickup = {
  id: string;
  food_bank_id: string;
  store_id: string;
  item_id: string;
  scheduled_date: string;
  quantity: number;
  status: string;
  confirmed_by: string | null;
  created_at: string;
  items?: Item | null;
  stores?: Store | null;
};

/**
 * Single data-access layer for predictions. The app NEVER computes a forecast;
 * the external AI model writes raw quantile rows and the app derives the
 * display fields (surplus, confidence band, target_date, drivers) here so
 * components consume a single uniform shape.
 */
export async function fetchPredictions(): Promise<PredictionWithRefs[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select(
      "id, store_id, item_id, snapshot_date, expiry_date, qty_on_hand, sales_q10, sales_q50, sales_q90, attribution, model_version, created_at, item:items(*), store:stores(*)",
    )
    .gte("expiry_date", new Date().toISOString().slice(0, 10))
    .order("expiry_date", { ascending: true });
  if (error) throw error;
  const raw = (data ?? []) as unknown as RawPrediction[];
  return raw
    .filter(
      (r) =>
        r.sales_q10 != null &&
        r.sales_q50 != null &&
        r.sales_q90 != null &&
        r.qty_on_hand != null &&
        r.snapshot_date &&
        r.expiry_date,
    )
    .map(derivePrediction);
}

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso + "T00:00:00").getTime();
  const t = new Date(toIso + "T00:00:00").getTime();
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDriverDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Derive the display fields from a raw model row, per the locked spec.
 * The model writes raw quantiles + attribution; everything below is computed.
 */
export function derivePrediction(raw: RawPrediction): PredictionWithRefs {
  const qty = Number(raw.qty_on_hand);
  const q10 = Number(raw.sales_q10);
  const q50 = Number(raw.sales_q50);
  const q90 = Number(raw.sales_q90);

  const predicted_surplus_qty = Math.round(qty - q50);
  const confidence_low = Math.round(qty - q90); // high sales → low surplus
  const confidence_high = Math.round(qty - q10); // low sales → high surplus

  const days_to_expiry = Math.max(daysBetween(raw.snapshot_date, raw.expiry_date), 0);

  const rel_width =
    (confidence_high - confidence_low) / Math.max(predicted_surplus_qty, 1);

  let buffer: number;
  let confidence_label: "high" | "moderate" | "low";
  if (rel_width < 0.6) {
    buffer = 3;
    confidence_label = "high";
  } else if (rel_width < 1.2) {
    buffer = 2;
    confidence_label = "moderate";
  } else {
    buffer = 1;
    confidence_label = "low";
  }

  // Clamp target_date to [snapshot_date, expiry_date − 1]
  const minTarget = raw.snapshot_date;
  const maxTarget = addDaysIso(raw.expiry_date, -1);
  let target_date = addDaysIso(raw.expiry_date, -buffer);
  if (target_date < minTarget) target_date = minTarget;
  if (target_date > maxTarget) target_date = maxTarget;

  const attr = raw.attribution ?? {};
  const causal: string[] = [];
  if (typeof attr.recent_trend === "string" && attr.recent_trend.trim()) {
    causal.push(`recent sell-through is trending ${attr.recent_trend.trim()}`);
  }
  if (typeof attr.promo_active === "boolean") {
    causal.push(attr.promo_active ? "a promotion is active" : "no promotion is active");
  }
  if (typeof attr.window_days === "string" && attr.window_days.trim()) {
    causal.push(`the window falls on ${attr.window_days.trim()}`);
  }

  const arithmetic = `~${Math.round(q50)} of ${Math.round(qty)} units expected to sell, leaving ~${predicted_surplus_qty} surplus (range ${confidence_low}–${confidence_high}).`;

  const confidenceSentence =
    causal.length > 0
      ? `Confidence is ${confidence_label} — ${causal.join(", ")}.`
      : `Confidence is ${confidence_label}.`;

  const pickupSentence = `Pickup recommended ${buffer} day${buffer === 1 ? "" : "s"} before expiry (${formatDriverDate(target_date)}).`;

  const drivers = `${arithmetic} ${confidenceSentence} ${pickupSentence}`;

  return {
    id: raw.id,
    store_id: raw.store_id,
    item_id: raw.item_id,
    target_date,
    predicted_surplus_qty,
    confidence_low,
    confidence_high,
    drivers,
    model_version: raw.model_version,
    created_at: raw.created_at,
    item: raw.item,
    store: raw.store,
    days_to_expiry,
    confidence_label,
  };
}

export async function refreshPredictions(): Promise<PredictionWithRefs[]> {
  return fetchPredictions();
}

export async function runModelAndRefresh(): Promise<PredictionWithRefs[]> {
  const { triggerModelRun } = await import("@/lib/predictions.functions");
  await triggerModelRun();
  return fetchPredictions();
}

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from("stores").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchFoodBanks(): Promise<FoodBank[]> {
  const { data, error } = await supabase.from("food_banks").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createStore(input: {
  name: string;
  lat: number;
  lng: number;
  type?: string;
  state?: string | null;
}): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      type: input.type ?? "grocery",
      state: input.state ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Store;
}

export async function createFoodBank(input: {
  name: string;
  lat: number;
  lng: number;
}): Promise<FoodBank> {
  const { data, error } = await supabase
    .from("food_banks")
    .insert({ name: input.name, lat: input.lat, lng: input.lng, capacity: 0, cold_storage: false })
    .select()
    .single();
  if (error) throw error;
  return data as FoodBank;
}

export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase.from("items").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchInventoryForStore(storeId: string): Promise<InventorySnapshot[]> {
  const { data, error } = await supabase
    .from("inventory_snapshots")
    .select("*, items(*)")
    .eq("store_id", storeId)
    .order("expiry_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as InventorySnapshot[];
}

export async function addInventorySnapshot(input: {
  store_id: string;
  item_id: string;
  qty_on_hand: number;
  expiry_date: string;
  catalog_item_id?: string;
  catalog_category_id?: string;
  shelf_life_days?: number;
}) {
  const { error } = await supabase.from("inventory_snapshots").insert({
    ...input,
    date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
}

export type DailySale = {
  id: string;
  store_id: string;
  catalog_item_id: string;
  sale_date: string;
  units_sold: number;
  created_at: string;
};

export async function fetchDailySalesForStore(storeId: string, limit = 200): Promise<DailySale[]> {
  const { data, error } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("store_id", storeId)
    .order("sale_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DailySale[];
}

export async function logDailySale(input: {
  store_id: string;
  catalog_item_id: string;
  sale_date: string;
  units_sold: number;
}) {
  const { error } = await supabase
    .from("daily_sales")
    .upsert(input, { onConflict: "store_id,catalog_item_id,sale_date" });
  if (error) throw error;
}

/**
 * Look up an item by (name, category). If it doesn't exist, create it.
 * Used by the retailer "Add Inventory" form so the catalog can grow as
 * stores log new SKUs from the food-catalog dropdowns.
 */
export async function findOrCreateItem(input: {
  name: string;
  category: string;
  shelf_life_days?: number;
}): Promise<Item> {
  const { data: existing, error: findErr } = await supabase
    .from("items")
    .select("*")
    .ilike("name", input.name)
    .ilike("category", input.category)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as Item;

  const { data, error } = await supabase
    .from("items")
    .insert({
      name: input.name,
      category: input.category,
      shelf_life_days: input.shelf_life_days ?? 7,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function fetchPickupsForFoodBank(foodBankId: string): Promise<Pickup[]> {
  const { data, error } = await supabase
    .from("pickups")
    .select("*, items(*), stores(*)")
    .eq("food_bank_id", foodBankId)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Pickup[];
}

export async function confirmPickup(input: {
  food_bank_id: string;
  store_id: string;
  item_id: string;
  scheduled_date: string;
  quantity: number;
  confirmed_by: string;
}) {
  const { error } = await supabase.from("pickups").insert({
    ...input,
    status: "confirmed",
  });
  if (error) throw error;
}

export async function markPickupCompleted(id: string) {
  const { error } = await supabase
    .from("pickups")
    .update({ status: "completed" })
    .eq("id", id);
  if (error) throw error;
}