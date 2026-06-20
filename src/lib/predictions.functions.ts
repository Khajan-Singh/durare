import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type PredictRow = {
  store_id: string;
  item_id: string;
  category: string;
  state: string;
  snapshot_date: string;
  expiry_date: string;
  qty_on_hand: number;
  is_promo?: boolean;
  sales_history?: Array<{ date: string; units: number }>;
};

type PredictResult = PredictRow & {
  sales_q10: number;
  sales_q50: number;
  sales_q90: number;
  attribution: Json;
};

type PredictResponse = {
  predictions: PredictResult[];
  model_version: string;
};

/**
 * Trigger a model run: pulls latest inventory snapshots, calls the external
 * forecasting service, and inserts raw quantile rows into the predictions
 * table. The app derives all UI values from those raw rows in src/lib/data.ts.
 */
export const triggerModelRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const baseUrl = process.env.MODEL_SERVICE_URL;
    const apiKey = process.env.MODEL_SERVICE_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error("MODEL_SERVICE_URL or MODEL_SERVICE_API_KEY not configured");
    }

    const { supabase } = context;

    // Pull current inventory snapshots joined with store + item metadata.
    const { data: inv, error: invErr } = await supabase
      .from("inventory_snapshots")
      .select(
        "store_id, item_id, qty_on_hand, expiry_date, date, items(id, category), stores(id, state)"
      );
    if (invErr) throw invErr;
    if (!inv || inv.length === 0) {
      return { inserted: 0, model_version: null as string | null };
    }

    const rows: PredictRow[] = inv
      .filter((r) => r.items && r.stores && r.expiry_date)
      .map((r) => ({
        store_id: r.store_id,
        item_id: r.item_id,
        category: (r.items as { category: string }).category,
        state: (r.stores as { state: string | null }).state ?? "",
        snapshot_date: r.date,
        expiry_date: r.expiry_date as string,
        qty_on_hand: Number(r.qty_on_hand),
        is_promo: false,
        sales_history: [],
      }));

    if (rows.length === 0) {
      return { inserted: 0, model_version: null as string | null };
    }

    const url = baseUrl.replace(/\/+$/, "") + "/predict";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ rows }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Model service ${resp.status}: ${text.slice(0, 300)}`);
    }
    const body = (await resp.json()) as PredictResponse;

    const inserts = body.predictions.map((p) => ({
      store_id: p.store_id,
      item_id: p.item_id,
      category: p.category,
      state: p.state,
      snapshot_date: p.snapshot_date,
      expiry_date: p.expiry_date,
      qty_on_hand: p.qty_on_hand,
      sales_q10: p.sales_q10,
      sales_q50: p.sales_q50,
      sales_q90: p.sales_q90,
      attribution: p.attribution ?? {},
      model_version: body.model_version,
    }));

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("predictions").insert(inserts);
      if (insErr) throw insErr;
    }

    return { inserted: inserts.length, model_version: body.model_version };
  });