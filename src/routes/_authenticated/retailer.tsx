import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  addInventorySnapshot,
  fetchInventoryForStore,
  fetchItems,
  fetchStores,
} from "@/lib/data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/retailer")({
  component: RetailerDashboard,
});

function RetailerDashboard() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", profile?.store_id],
    queryFn: () => fetchInventoryForStore(profile!.store_id!),
    enabled: !!profile?.store_id,
  });

  const myStore = storesQuery.data?.find((s) => s.id === profile?.store_id);

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.store_id) {
      toast.error("No store linked to your account");
      return;
    }
    if (!itemId || !qty || !expiry) return;
    setSaving(true);
    try {
      await addInventorySnapshot({
        store_id: profile.store_id,
        item_id: itemId,
        qty_on_hand: Number(qty),
        expiry_date: expiry,
      });
      toast.success("Inventory updated");
      setItemId("");
      setQty("");
      setExpiry("");
      qc.invalidateQueries({ queryKey: ["inventory", profile.store_id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          Retailer
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {myStore?.name ?? "Your store"} inventory
        </h1>
        <p className="mt-1 text-muted-foreground">
          Log current produce stock and expiry dates. Durare's forecasting model
          uses this data to predict donatable surplus.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Add / update an item</h2>
        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="space-y-1.5 sm:col-span-5">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an item" />
              </SelectTrigger>
              <SelectContent>
                {itemsQuery.data?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="ml-1 text-muted-foreground">· {i.category}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Qty on hand</Label>
            <Input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Expiry date</Label>
            <Input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end sm:col-span-1">
            <Button type="submit" disabled={saving} className="w-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 text-sm font-medium">
          Current snapshots
        </div>
        {inventoryQuery.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : !inventoryQuery.data?.length ? (
          <div className="p-10 text-center text-muted-foreground">
            No inventory logged yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">Item</th>
                <th className="px-5 py-2 font-medium">Qty</th>
                <th className="px-5 py-2 font-medium">Expires</th>
                <th className="px-5 py-2 font-medium">Days left</th>
              </tr>
            </thead>
            <tbody>
              {inventoryQuery.data.map((row) => {
                const d = daysUntil(row.expiry_date);
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.items?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.items?.category}
                      </div>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{row.qty_on_hand}</td>
                    <td className="px-5 py-3">{formatDate(row.expiry_date)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs",
                          d <= 1 && "bg-urgent text-urgent-foreground",
                          d === 2 && "bg-warning text-warning-foreground",
                          d > 2 && "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {d}d
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}