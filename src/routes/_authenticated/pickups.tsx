import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchPickupsForFoodBank, markPickupCompleted } from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pickups")({
  component: PickupsPage,
});

function PickupsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const pickupsQuery = useQuery({
    queryKey: ["pickups", profile?.food_bank_id],
    queryFn: () => fetchPickupsForFoodBank(profile!.food_bank_id!),
    enabled: !!profile?.food_bank_id,
  });

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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Scheduled pickups</h1>
        <p className="mt-1 text-muted-foreground">
          Confirmed pickups you've scheduled. Mark them complete after collection.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        {pickupsQuery.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-medium">No pickups scheduled yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Confirm a forecast on the dashboard and it'll appear here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">Item</th>
                <th className="px-5 py-2 font-medium">Store</th>
                <th className="px-5 py-2 font-medium">Qty</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{row.items?.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {row.stores?.name}
                  </td>
                  <td className="px-5 py-3 tabular-nums">~{row.quantity}</td>
                  <td className="px-5 py-3">{formatDate(row.scheduled_date)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        row.status === "completed"
                          ? "bg-success text-success-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {row.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => onComplete(row.id)}>
                        Mark complete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}