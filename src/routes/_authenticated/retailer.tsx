import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Lightbulb, MoreVertical, Sparkles, Leaf, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import {
  addInventorySnapshot,
  fetchInventoryForStore,
  fetchStores,
  findOrCreateItem,
} from "@/lib/data";
import { OVERALL_CATEGORIES, itemsForOverall } from "@/lib/food-catalog";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/retailer")({
  component: RetailerDashboard,
});

type FilterKey = "all" | "near" | "produce";

function RetailerDashboard() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", profile?.store_id],
    queryFn: () => fetchInventoryForStore(profile!.store_id!),
    enabled: !!profile?.store_id,
  });

  const myStore = storesQuery.data?.find((s) => s.id === profile?.store_id);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overall, setOverall] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const rows = (inventoryQuery.data ?? []).filter((row) => {
    if (filter === "all") return true;
    if (filter === "near") return daysUntil(row.expiry_date) <= 2;
    if (filter === "produce") return row.items?.category?.toLowerCase() === "produce";
    return true;
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.store_id) {
      toast.error("No store linked to your account");
      return;
    }
    if (!overall || !itemName || !qty || !expiry) {
      toast.error("Pick a category and a specific item");
      return;
    }
    setSaving(true);
    try {
      const item = await findOrCreateItem({ name: itemName, category: overall });
      await addInventorySnapshot({
        store_id: profile.store_id,
        item_id: item.id,
        qty_on_hand: Number(qty),
        expiry_date: expiry,
      });
      toast.success("Inventory updated");
      setOverall("");
      setItemName("");
      setQty("");
      setExpiry("");
      setDrawerOpen(false);
      qc.invalidateQueries({ queryKey: ["inventory", profile.store_id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">Store Inventory Snapshot</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Foresight &amp; Stewardship for your perishable stock at{" "}
            <span className="font-semibold text-foreground">{myStore?.name ?? "your store"}</span>.
          </p>
        </div>
        <Button className="h-12 gap-2 rounded-xl px-6 font-bold shadow-sm" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4" /> Add Inventory Item
        </Button>
      </header>

      <section className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All Items
            </FilterChip>
            <FilterChip active={filter === "near"} onClick={() => setFilter("near")}>
              Near Expiry
            </FilterChip>
            <FilterChip active={filter === "produce"} onClick={() => setFilter("produce")}>
              Produce
            </FilterChip>
          </div>
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{rows.length}</span> items
          </div>
        </div>

        {inventoryQuery.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-bold text-primary">No inventory yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add an item to start feeding the forecasting model.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-low text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Item Name</th>
                  <th className="px-6 py-3 font-semibold">Qty on Hand</th>
                  <th className="px-6 py-3 font-semibold">Expiry Date</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const d = daysUntil(row.expiry_date);
                  const tone = d <= 2 ? "urgent" : d <= 4 ? "warn" : "ok";
                  const styles =
                    tone === "urgent"
                      ? {
                          chip: "bg-destructive-soft text-destructive-soft-foreground",
                          dot: "bg-destructive",
                          icon: "bg-destructive-soft text-destructive",
                        }
                      : tone === "warn"
                        ? {
                            chip: "bg-warning-soft text-warning-soft-foreground",
                            dot: "bg-warning",
                            icon: "bg-warning-soft text-warning-foreground",
                          }
                        : {
                            chip: "bg-primary-soft text-primary-soft-foreground",
                            dot: "bg-primary",
                            icon: "bg-primary-soft text-primary-soft-foreground",
                          };

                  return (
                    <tr key={row.id} className="group transition hover:bg-secondary">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", styles.icon)}>
                            <Leaf className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{row.items?.name}</div>
                            <div className="text-xs text-muted-foreground">{row.items?.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{row.qty_on_hand} units</td>
                      <td className="px-6 py-4 text-sm">{formatDate(row.expiry_date)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                            styles.chip,
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
                          {d <= 0 ? "Expired" : `${d} ${d === 1 ? "Day" : "Days"} Left`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-muted-foreground transition hover:text-primary">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI Insight */}
      <section className="card-elevated relative overflow-hidden bg-primary p-6 text-primary-foreground">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <Sparkles className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold">Forecast Insight</h3>
            <p className="text-sm opacity-90">
              Items expiring in 2 days are surfaced to coordinators automatically. Keep entries fresh — better data,
              sharper predictions, less waste.
            </p>
          </div>
          <Button
            variant="secondary"
            className="bg-card font-bold text-primary hover:bg-card/90"
            onClick={() => setDrawerOpen(true)}
          >
            Add Item
          </Button>
        </div>
      </section>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-surface-low p-6">
              <h2 className="text-xl font-extrabold text-primary">Add Inventory Item</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-high"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <SearchableCombobox
                label="Overall Category"
                placeholder="Pick a category"
                searchPlaceholder="Search categories…"
                value={overall}
                options={OVERALL_CATEGORIES}
                onChange={(v) => {
                  setOverall(v);
                  setItemName("");
                }}
              />
              <SearchableCombobox
                label="Specific Item"
                placeholder={overall ? "Pick an item" : "Pick an overall category first"}
                searchPlaceholder="Search items…"
                value={itemName}
                options={overall ? itemsForOverall(overall) : []}
                disabled={!overall}
                onChange={setItemName}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quantity
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    placeholder="0"
                    onChange={(e) => setQty(e.target.value)}
                    required
                    className="h-12 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Expiry Date
                  </Label>
                  <Input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    required
                    className="h-12 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border bg-surface-low p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="text-sm italic text-muted-foreground">
                  Items added here are automatically synced with partner pickup forecasts.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 rounded-lg font-bold"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="h-12 flex-1 rounded-lg font-bold">
                  {saving ? "Adding…" : "Add Item"}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition",
        active
          ? "bg-primary-soft text-primary-soft-foreground"
          : "bg-surface-high text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function SearchableCombobox({
  label,
  placeholder,
  searchPlaceholder,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition",
              "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")}
                    />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
