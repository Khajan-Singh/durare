import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, Calendar, ArrowDownNarrowWide, Navigation, Store as StoreIcon, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PredictionCard } from "@/components/prediction-card";
import { ConfirmPickupModal } from "@/components/confirm-pickup-modal";
import { useAuth } from "@/hooks/use-auth";
import {
  confirmPickup,
  fetchFoodBanks,
  refreshPredictions,
  type PredictionWithRefs,
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
  const predictionsQuery = useQuery({ queryKey: ["predictions"], queryFn: refreshPredictions });

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

  // Per-store aggregates within radius (ignores selectedStoreId so all chips remain visible)
  const nearbyStores = useMemo(() => {
    const preds = predictionsQuery.data ?? [];
    const byStore = new Map<
      string,
      {
        store: PredictionWithRefs["store"];
        distance: number | null;
        forecasts: number;
        units: number;
        soonest: string;
      }
    >();
    for (const p of preds) {
      const distance = myFoodBank
        ? haversineMiles(
            { lat: myFoodBank.lat, lng: myFoodBank.lng },
            { lat: p.store.lat, lng: p.store.lng },
          )
        : null;
      if (myFoodBank && distance !== null && distance > radius) continue;
      const existing = byStore.get(p.store.id);
      if (existing) {
        existing.forecasts += 1;
        existing.units += p.predicted_surplus_qty;
        if (p.target_date < existing.soonest) existing.soonest = p.target_date;
      } else {
        byStore.set(p.store.id, {
          store: p.store,
          distance,
          forecasts: 1,
          units: p.predicted_surplus_qty,
          soonest: p.target_date,
        });
      }
    }
    return Array.from(byStore.values()).sort(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
  }, [predictionsQuery.data, myFoodBank, radius]);

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
          <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
            Predicted Pickup Plan
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            AI-generated forecasts for the next 72 hours.
            {myFoodBank && (
              <>
                {" "}Distances from <span className="font-semibold text-foreground">{myFoodBank.name}</span>.
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
            className="rounded-full"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["predictions"] });
              toast.message("Refreshing forecasts…");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      {/* Radius selector */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Search radius
        </span>
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
      <section className="card-elevated durare-glow flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Within {radius} mi · next 72h
          </p>
          <p className="mt-1 text-2xl font-extrabold text-primary">
            ~{totalUnits} units of surplus predicted
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:max-w-md sm:flex-1">
          <Stat label="Forecasts" value={String(rows.length)} />
          <Stat label="Retailers" value={String(nearbyStores.length)} />
          <Stat label="Coverage" value="72h" />
        </div>
      </section>

      {/* Retailers within radius */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-primary">
            Retailers within {radius} mi
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              ({nearbyStores.length})
            </span>
          </h2>
          {selectedStoreId && (
            <button
              type="button"
              onClick={() => setSelectedStoreId(null)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary hover:bg-secondary/70"
            >
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
          )}
        </div>
        {nearbyStores.length === 0 ? (
          <div className="card-elevated p-6 text-sm text-muted-foreground">
            No retailers with forecasts in this radius yet.
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
                    "rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-primary bg-primary-soft/40 shadow-sm"
                      : "border-border bg-card/80 hover:border-primary/60 hover:bg-primary-soft/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary-soft p-2 text-primary-soft-foreground">
                        <StoreIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary leading-tight">
                          {s.store.name}
                        </p>
                        {s.distance !== null && (
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {s.distance.toFixed(1)} mi away
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Forecasts" value={String(s.forecasts)} />
                    <MiniStat label="Units" value={String(s.units)} />
                    <MiniStat label="Soonest" value={s.soonest.slice(5)} />
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
        <EmptyState />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ p, distance }) => (
            <PredictionCard
              key={p.id}
              prediction={p}
              distanceMiles={distance}
              isNearest={p.store.id === nearestStoreId}
              onReview={() => setSelected(p)}
            />
          ))}
        </div>
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-surface-high text-primary hover:bg-secondary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 p-3 text-center backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card/60" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-elevated flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-primary">No surplus predicted yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        When the forecasting model publishes new predictions, the plan for the
        coming days will show up here.
      </p>
    </div>
  );
}