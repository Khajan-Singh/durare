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
 * it only reads rows the external AI model populates here. Re-point this
 * function (e.g. to trigger the model) without touching components.
 */
export async function fetchPredictions(): Promise<PredictionWithRefs[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, item:items(*), store:stores(*)")
    .gte("target_date", new Date().toISOString().slice(0, 10))
    .order("target_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PredictionWithRefs[];
}

export async function refreshPredictions(): Promise<PredictionWithRefs[]> {
  // Placeholder for a future "trigger model run" call. For now, just re-query.
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
}): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .insert({ name: input.name, lat: input.lat, lng: input.lng, type: input.type ?? "grocery" })
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