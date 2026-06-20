import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Calendar, ArrowDownNarrowWide, Navigation, Store as StoreIcon, X, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PredictionCard } from "@/components/prediction-card";
import { ConfirmPickupModal } from "@/components/confirm-pickup-modal";
import { useAuth } from "@/hooks/use-auth";
import {
  confirmPickup,
  fetchFoodBanks,
  fetchPredictions,
  fetchStores,
  runModelAndRefresh,
  type PredictionWithRefs,
  type Store,
} from "@/lib/data";
import { cn, haversineMiles } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coordinator")({
  component: CoordinatorDashboard,
});

type SortKey = "qty" | "date" | "distance";
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
type Radius = typeof RADIUS_OPTIONS[number];

function CoordinatorDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const foodBanksQuery = useQuery({ queryKey: ["food_banks"], queryFn: fetchFoodBanks });
  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const predictionsQuery = useQuery({ queryKey: ["predictions"], queryFn: fetchPredictions });

  const runModel = useMutation({
    mutationFn: runModelAndRefresh,
    onSuccess: (data) => {
      qc.setQueryData(["predictions"], data);
      toast.success(`Forecasts refreshed (${data.length} predictions).`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to run model");
    },
  });

  const myFoodBank = foodBanksQuery.data?.find((f) => f.id === profile?.food_bank_id) ?? null;

  const [sort, setSort] = useState<SortKey>("date");
  const [radius, setRadius] = useState<Radius>(50);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selected, setSelected] = useState<PredictionWithRefs | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rows = useMemo(() => {
    const preds = predictionsQuery.data ?? [];
    const withDistance = preds.map((p) => ({
      p,
      distance: myFoodBank
        ? haversineMiles(
            { lat: myFoodBank.lat, lng: myFoodBank.lng },
            { lat: p.store.lat, lng: p.store.lng },
          )
        : null,
    }));
    const filtered = withDistance.filter((r) => {
      if (myFoodBank && r.distance !== null && r.distance > radius) return false;
      if (selectedStoreId && r.p.store.id !== selectedStoreId) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "qty") return b.p.predicted_surplus_qty - a.p.predicted_surplus_qty;
      if (sort === "distance") {
        const ad = a.distance ?? Infinity;
        const bd = b.distance ?? Infinity;
        return ad - bd;
      }
      return a.p.target_date.localeCompare(b.p.target_date);
    });
  }, [predictionsQuery.data, myFoodBank, sort, radius, selectedStoreId]);

  // All retailers in the system, with per-store distance + prediction aggregates.
  // Includes stores with zero forecasts so coordinators can still see who's reachable.
  type StoreRow = {
    store: Store;
    distance: number | null;
    forecasts: number;
    units: number;
    soonest: string | null;
  };
  const allStoreRows = useMemo<StoreRow[]>(() => {
    const stores = storesQuery.data ?? [];
    const preds = predictionsQuery.data ?? [];
    return stores.map((store) => {
      const storePreds = preds.filter((p) => p.store.id === store.id);
      const distance = myFoodBank
        ? haversineMiles(
            { lat: myFoodBank.lat, lng: myFoodBank.lng },
            { lat: store.lat, lng: store.lng },
          )
        : null;
      const soonest = storePreds.length
        ? storePreds.reduce((m, p) => (p.target_date < m ? p.target_date : m), storePreds[0].target_date)
        : null;
      return {
        store,
        distance,
        forecasts: storePreds.length,
        units: storePreds.reduce((s, p) => s + p.predicted_surplus_qty, 0),
        soonest,
      };
    });
  }, [storesQuery.data, predictionsQuery.data, myFoodBank]);

  const nearbyStores = useMemo(() => {
    return allStoreRows
      .filter((r) => !myFoodBank || r.distance === null || r.distance <= radius)
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [allStoreRows, myFoodBank, radius]);

  const selectedStore = selectedStoreId
    ? allStoreRows.find((r) => r.store.id === selectedStoreId) ?? null
    : null;

  const nearestStoreId = useMemo(() => {
    const withDist = rows.filter((r) => r.distance !== null);
    if (!withDist.length) return null;
    return withDist.reduce((min, r) =>
      (r.distance ?? Infinity) < (min.distance ?? Infinity) ? r : min,
    ).p.store.id;
  }, [rows]);

  const totalUnits = rows.reduce((s, r) => s + r.p.predicted_surplus_qty, 0);

  const onConfirm = async () => {
    if (!selected || !profile?.food_bank_id || !user) return;
    setSubmitting(true);
    try {
      await confirmPickup({
        food_bank_id: profile.food_bank_id,
        store_id: selected.store.id,
        item_id: selected.item.id,
        scheduled_date: selected.target_date,
        quantity: selected.predicted_surplus_qty,
        confirmed_by: user.id,
      });
      toast.success("Pickup confirmed");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["pickups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not confirm pickup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Predicted pickup plan
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            {selectedStore ? (
              <>
                Viewing <span className="text-foreground">{selectedStore.store.name}</span>
                {selectedStore.distance !== null && (
                  <> · {selectedStore.distance.toFixed(1)} mi from {myFoodBank?.name ?? "you"}</>
                )}
              </>
            ) : (
              <>
                AI-generated forecasts for the next 72 hours.
                {myFoodBank && (
                  <>
                    {" "}Distances measured from{" "}
                    <span className="text-foreground">{myFoodBank.name}</span>.
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SortPill icon={<Calendar className="h-4 w-4" />} label="Readiness" active={sort === "date"} onClick={() => setSort("date")} />
          <SortPill icon={<ArrowDownNarrowWide className="h-4 w-4" />} label="Quantity" active={sort === "qty"} onClick={() => setSort("qty")} />
          <SortPill icon={<Navigation className="h-4 w-4" />} label="Distance" active={sort === "distance"} onClick={() => setSort("distance")} />
          <Button
            variant="outline"
            className="rounded-md"
            disabled={runModel.isPending}
            onClick={() => {
              toast.message("Running forecasting model…");
              runModel.mutate(undefined);
            }}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", runModel.isPending && "animate-spin")} />
            {runModel.isPending ? "Running…" : "Refresh"}
          </Button>
        </div>
      </header>

      {/* Radius selector */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Search radius</span>
        {RADIUS_OPTIONS.map((r) => (
          <SortPill
            key={r}
            icon={<Navigation className="h-4 w-4" />}
            label={`${r} mi`}
            active={radius === r}
            onClick={() => setRadius(r)}
          />
        ))}
        {!myFoodBank && (
          <span className="text-xs text-muted-foreground">
            Set your food bank location to filter by distance.
          </span>
        )}
      </section>

      {/* Summary strip */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Within {radius} mi · next 72h</p>
          <p className="mt-1 font-display text-3xl font-medium text-foreground">
            <span className="font-mono-tabular">~{totalUnits}</span>{" "}
            <span className="text-muted-foreground">units of surplus predicted</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 sm:max-w-md">
          <Stat label="Forecasts" value={String(rows.length)} />
          <Stat label="Retailers" value={String(nearbyStores.length)} />
          <Stat label="Coverage" value="72h" />
        </div>
      </section>

      {/* Retailers within radius */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium text-foreground">
            Retailers within {radius} mi
            <span className="ml-2 text-sm text-muted-foreground">
              ({nearbyStores.length})
            </span>
          </h2>
          {selectedStoreId && (
            <button
              type="button"
              onClick={() => setSelectedStoreId(null)}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-xs text-primary hover:bg-secondary/70"
            >
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
          )}
        </div>
        {storesQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading retailers…</div>
        ) : nearbyStores.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {(storesQuery.data ?? []).length === 0
              ? "No retailers registered yet."
              : `No retailers within ${radius} mi. Try a larger radius.`}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nearbyStores.map((s) => {
              const active = selectedStoreId === s.store.id;
              return (
                <button
                  key={s.store.id}
                  type="button"
                  onClick={() =>
                    setSelectedStoreId((cur) => (cur === s.store.id ? null : s.store.id))
                  }
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    active
                      ? "border-primary bg-primary-soft/40"
                      : "border-border bg-card hover:border-primary/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-primary-soft p-2 text-primary-soft-foreground">
                        <StoreIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {s.store.name}
                        </p>
                        {s.distance !== null && (
                          <p className="text-xs text-muted-foreground font-mono-tabular">
                            {s.distance.toFixed(1)} mi away
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniStat label="Forecasts" value={String(s.forecasts)} />
                    <MiniStat label="Units" value={String(s.units)} />
                    <MiniStat label="Soonest" value={s.soonest ? s.soonest.slice(5) : "—"} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {predictionsQuery.isLoading ? (
        <SkeletonGrid />
      ) : rows.length === 0 ? (
        <EmptyState selectedStoreName={selectedStore?.store.name ?? null} />
      ) : (
        <section className="space-y-6">
          {/* Featured: the soonest / first row gets the full card */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Next pickup</p>
            <PredictionCard
              prediction={rows[0].p}
              distanceMiles={rows[0].distance}
              isNearest={rows[0].p.store.id === nearestStoreId}
              onReview={() => setSelected(rows[0].p)}
            />
          </div>

          {rows.length > 1 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {rows.length - 1} more forecast{rows.length - 1 === 1 ? "" : "s"}
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {rows.slice(1).map(({ p, distance }) => (
                  <PredictionRow
                    key={p.id}
                    prediction={p}
                    distanceMiles={distance}
                    isNearest={p.store.id === nearestStoreId}
                    onReview={() => setSelected(p)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <ConfirmPickupModal
        prediction={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onConfirm={onConfirm}
        submitting={submitting}
      />
    </div>
  );
}

function SortPill({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono-tabular text-2xl text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono-tabular text-sm text-foreground leading-tight">{value}</p>
    </div>
  );
}

function PredictionRow({
  prediction,
  distanceMiles,
  isNearest,
  onReview,
}: {
  prediction: PredictionWithRefs;
  distanceMiles: number | null;
  isNearest?: boolean;
  onReview: () => void;
}) {
  const days = (() => {
    const t = new Date(prediction.target_date).getTime();
    return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  })();
  const tone = days <= 0 ? "bg-destructive" : days <= 1 ? "bg-warning" : "bg-primary";

  return (
    <button
      type="button"
      onClick={onReview}
      className="group relative grid w-full grid-cols-12 items-center gap-4 px-5 py-4 text-left transition hover:bg-secondary/40"
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", tone)} aria-hidden />
      <div className="col-span-12 sm:col-span-4">
        <p className="text-xs text-muted-foreground">{prediction.item.category}</p>
        <p className="font-display text-base font-medium text-foreground leading-tight">
          {prediction.item.name}
        </p>
        <p className="text-xs text-muted-foreground">{prediction.store.name}</p>
      </div>
      <div className="col-span-4 sm:col-span-2">
        <p className="text-[10px] text-muted-foreground">Surplus</p>
        <p className="font-mono-tabular text-lg text-foreground leading-tight">
          {prediction.predicted_surplus_qty}
          <span className="ml-1 text-xs text-muted-foreground">units</span>
        </p>
      </div>
      <div className="col-span-4 sm:col-span-2">
        <p className="text-[10px] text-muted-foreground">Range</p>
        <p className="font-mono-tabular text-sm text-muted-foreground">
          {prediction.confidence_low}–{prediction.confidence_high}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-2">
        <p className="text-[10px] text-muted-foreground">Ready</p>
        <p className="font-mono-tabular text-sm text-foreground">
          {prediction.target_date.slice(5)}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-2">
        {isNearest && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <MapPin className="h-3 w-3" /> Nearest
          </span>
        )}
        <span className="font-mono-tabular text-sm text-foreground">
          {distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : "—"}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card/60" />
      ))}
    </div>
  );
}

function EmptyState({ selectedStoreName }: { selectedStoreName: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-12 text-center">
      <h3 className="font-display text-xl font-medium text-foreground">
        {selectedStoreName ? `No active forecasts for ${selectedStoreName}` : "No surplus predicted yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {selectedStoreName
          ? "This retailer has no AI-predicted surplus right now. Check back, widen your radius, or select another retailer above."
          : "When the forecasting model publishes new predictions, the plan for the coming days will show up here."}
      </p>
    </div>
  );
}