import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PredictionCard } from "@/components/prediction-card";
import { ConfirmPickupModal } from "@/components/confirm-pickup-modal";
import { useAuth } from "@/hooks/use-auth";
import {
  confirmPickup,
  fetchFoodBanks,
  refreshPredictions,
  type PredictionWithRefs,
} from "@/lib/data";
import { haversineMiles } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coordinator")({
  component: CoordinatorDashboard,
});

type SortKey = "qty" | "date" | "distance";

function CoordinatorDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const foodBanksQuery = useQuery({
    queryKey: ["food_banks"],
    queryFn: fetchFoodBanks,
  });

  const predictionsQuery = useQuery({
    queryKey: ["predictions"],
    queryFn: refreshPredictions,
  });

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
    const sorted = [...withDistance].sort((a, b) => {
      if (sort === "qty") return b.p.predicted_surplus_qty - a.p.predicted_surplus_qty;
      if (sort === "distance") {
        const ad = a.distance ?? Infinity;
        const bd = b.distance ?? Infinity;
        return ad - bd;
      }
      return a.p.target_date.localeCompare(b.p.target_date);
    });
    return sorted;
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Predicted pickup plan
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            ~{totalUnits} units of surplus forecast for the coming days
          </h1>
          <p className="mt-1 text-muted-foreground">
            {myFoodBank
              ? `Distances are measured from ${myFoodBank.name}.`
              : "Set your food bank in your profile to see distances."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort: Readiness date</SelectItem>
              <SelectItem value="qty">Sort: Quantity</SelectItem>
              <SelectItem value="distance">Sort: Distance</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["predictions"] });
              toast.message("Refreshing forecasts…");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh forecasts
          </Button>
        </div>
      </header>

      {predictionsQuery.isLoading ? (
        <SkeletonGrid />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl border border-border bg-card/60" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-medium">No surplus predicted yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        When the forecasting model publishes new predictions, the plan for the
        coming days will show up here.
      </p>
    </div>
  );
}