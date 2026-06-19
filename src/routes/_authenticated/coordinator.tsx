import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, Calendar, ArrowDownNarrowWide, Navigation } from "lucide-react";
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

function CoordinatorDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const foodBanksQuery = useQuery({ queryKey: ["food_banks"], queryFn: fetchFoodBanks });
  const predictionsQuery = useQuery({ queryKey: ["predictions"], queryFn: refreshPredictions });

  const myFoodBank = foodBanksQuery.data?.find((f) => f.id === profile?.food_bank_id) ?? null;

  const [sort, setSort] = useState<SortKey>("date");
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
    return [...withDistance].sort((a, b) => {
      if (sort === "qty") return b.p.predicted_surplus_qty - a.p.predicted_surplus_qty;
      if (sort === "distance") {
        const ad = a.distance ?? Infinity;
        const bd = b.distance ?? Infinity;
        return ad - bd;
      }
      return a.p.target_date.localeCompare(b.p.target_date);
    });
  }, [predictionsQuery.data, myFoodBank, sort]);

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

      {/* Summary strip */}
      <section className="card-elevated durare-glow flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Forecast Window
          </p>
          <p className="mt-1 text-2xl font-extrabold text-primary">
            ~{totalUnits} units of surplus predicted
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:max-w-md sm:flex-1">
          <Stat label="Forecasts" value={String(rows.length)} />
          <Stat label="Stores" value={String(new Set(rows.map((r) => r.p.store.id)).size)} />
          <Stat label="Coverage" value="72h" />
        </div>
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