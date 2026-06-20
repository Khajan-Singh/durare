import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Store as StoreIcon, Sparkles, Calendar } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchFoodBanks,
  fetchPickupsForFoodBank,
  markPickupCompleted,
} from "@/lib/data";
import { cn, formatDate, haversineMiles } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pickups")({
  component: PickupsPage,
});

function PickupsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const foodBanksQuery = useQuery({ queryKey: ["food_banks"], queryFn: fetchFoodBanks });
  const pickupsQuery = useQuery({
    queryKey: ["pickups", profile?.food_bank_id],
    queryFn: () => fetchPickupsForFoodBank(profile!.food_bank_id!),
    enabled: !!profile?.food_bank_id,
  });

  const myBank = foodBanksQuery.data?.find((f) => f.id === profile?.food_bank_id) ?? null;

  const onComplete = async (id: string) => {
    try {
      await markPickupCompleted(id);
      toast.success("Pickup marked complete");
      qc.invalidateQueries({ queryKey: ["pickups", profile?.food_bank_id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update pickup");
    }
  };

  const rows = pickupsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-primary sm:text-5xl">
            Scheduled Pickups
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Manage confirmed rescues and finalize transitions. AI predictions help
            you stay ahead of potential waste.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
          <Calendar className="h-4 w-4 text-warning" />
          <span className="font-bold text-primary">
            {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </header>

      {/* List header (desktop) */}
      <div className="hidden grid-cols-12 gap-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:grid">
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Partner Store</div>
        <div className="col-span-3">Rescue Item</div>
        <div className="col-span-1 text-right">Qty</div>
        <div className="col-span-1 text-center">Distance</div>
        <div className="col-span-2 text-right">Action</div>
      </div>

      {pickupsQuery.isLoading ? (
        <div className="card-elevated p-10 text-center text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <h3 className="text-lg font-bold text-primary">No pickups scheduled yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Confirm a forecast on the dashboard and it'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const distance =
              myBank && row.stores
                ? haversineMiles(
                    { lat: myBank.lat, lng: myBank.lng },
                    { lat: row.stores.lat, lng: row.stores.lng },
                  )
                : null;
            const completed = row.status === "completed";
            return (
              <div
                key={row.id}
                className="card-elevated grid grid-cols-1 items-center gap-4 p-5 md:grid-cols-12"
              >
                <div className="md:col-span-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize",
                      completed
                        ? "bg-success/15 text-success"
                        : "bg-primary-soft text-primary-soft-foreground",
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 md:col-span-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
                    <StoreIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">{row.stores?.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(row.scheduled_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:col-span-3">
                  <span className="font-semibold text-primary">{row.items?.name}</span>
                  <Sparkles className="h-3.5 w-3.5 text-warning" />
                </div>
                <div className="md:col-span-1 md:text-right">
                  <span className="font-mono font-semibold text-primary">{row.quantity}</span>
                </div>
                <div className="md:col-span-1 md:text-center">
                  <span className="text-xs text-muted-foreground">
                    {distance !== null ? `${distance.toFixed(1)} mi` : "—"}
                  </span>
                </div>
                <div className="flex md:col-span-2 md:justify-end">
                  {!completed ? (
                    <Button
                      onClick={() => onComplete(row.id)}
                      variant="outline"
                      className="gap-2 rounded-lg font-bold hover:bg-primary hover:text-primary-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Completed
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}