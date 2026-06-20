import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, Info, Building2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { fetchPickupsForStore } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { PickupDetailsPopover } from "@/components/pickup-details-popover";

export const Route = createFileRoute("/_authenticated/deliveries")({
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const { profile } = useAuth();
  const pickupsQuery = useQuery({
    queryKey: ["pickups_for_store", profile?.store_id],
    queryFn: () => fetchPickupsForStore(profile!.store_id!),
    enabled: !!profile?.store_id,
  });

  const rows = (pickupsQuery.data ?? [])
    .filter((p) => p.status === "completed")
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
  const uniqueBanks = new Set(rows.map((r) => r.food_bank_id)).size;

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            Deliveries
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Historical record of items rescued from your store and successfully
            delivered to partner food banks.
          </p>
        </div>
        <div className="flex gap-3">
          <Stat label="Completed pickups" value={String(rows.length)} />
          <Stat label="Units rescued" value={String(totalUnits)} />
          <Stat label="Food banks" value={String(uniqueBanks)} />
        </div>
      </header>

      {pickupsQuery.isLoading ? (
        <div className="card-elevated p-10 text-center text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <PackageCheck className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-primary">No completed deliveries yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Once a coordinator marks a scheduled pickup as completed, it'll show
            up here for your records.
          </p>
        </div>
      ) : (
        <section className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-low text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Item</th>
                  <th className="px-6 py-3 font-semibold">Qty</th>
                  <th className="px-6 py-3 font-semibold">Picked up on</th>
                  <th className="px-6 py-3 font-semibold">Food bank</th>
                  <th className="px-6 py-3 font-semibold">Coordinator</th>
                  <th className="px-6 py-3 text-right font-semibold">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-secondary">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{row.items?.name}</div>
                      <div className="text-xs text-muted-foreground">{row.items?.category}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-foreground">
                      {row.quantity} units
                    </td>
                    <td className="px-6 py-4 text-sm">{formatDate(row.scheduled_date)}</td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.food_banks?.name ?? "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {row.confirmed_by_profile?.display_name ??
                        row.confirmed_by_profile?.email ??
                        "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <PickupDetailsPopover
                        pickup={row}
                        viewer="retailer"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-sm border border-input bg-background px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-accent"
                          >
                            <Info className="h-3.5 w-3.5" /> Details
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2 text-center shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">{value}</p>
    </div>
  );
}