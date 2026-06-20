import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Lightbulb, MoreVertical, Sparkles, Leaf, Check, ChevronsUpDown, Upload, Download, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import {
  addInventorySnapshot,
  deleteInventorySnapshot,
  fetchInventoryForStore,
  fetchPickupsForStore,
  fetchStores,
  findOrCreateItem,
  type Pickup,
} from "@/lib/data";
import { PickupDetailsPopover } from "@/components/pickup-details-popover";
import { OVERALL_CATEGORIES, itemsForOverall, itemByName } from "@/lib/food-catalog";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/retailer")({
  component: RetailerDashboard,
});

type FilterKey = "all" | "near" | "produce";

type ParsedCsvRow = {
  category: string;
  item_name: string;
  quantity: string;
  expiry_date: string;
  error?: string;
};

const CSV_TEMPLATE = `category,item_name,quantity,expiry_date
Produce,Bananas,12,2026-06-25
Bakery,Sourdough Loaf,4,2026-06-22
`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((v) => v.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.some((v) => v.trim() !== "")) rows.push(cur); }
  return rows;
}

function RetailerDashboard() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", profile?.store_id],
    queryFn: () => fetchInventoryForStore(profile!.store_id!),
    enabled: !!profile?.store_id,
  });
  const pickupsQuery = useQuery({
    queryKey: ["pickups_for_store", profile?.store_id],
    queryFn: () => fetchPickupsForStore(profile!.store_id!),
    enabled: !!profile?.store_id,
  });

  // Latest pickup per item_id for this store. Completed rows are filtered out
  // of the inventory list (they appear on the Deliveries tab); confirmed rows
  // drive the "Claimed" column.
  const pickupByItemId = new Map<string, Pickup>();
  for (const p of pickupsQuery.data ?? []) {
    const existing = pickupByItemId.get(p.item_id);
    if (!existing || p.scheduled_date > existing.scheduled_date) {
      pickupByItemId.set(p.item_id, p);
    }
  }

  const myStore = storesQuery.data?.find((s) => s.id === profile?.store_id);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overall, setOverall] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  // CSV import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [importing, setImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const closeCsvDrawer = () => {
    setCsvOpen(false);
    setCsvRows([]);
    setCsvFileName("");
    setCsvError("");
    if (csvFileRef.current) csvFileRef.current.value = "";
  };

  const rows = (inventoryQuery.data ?? [])
    .filter((row) => {
      // Hide items that have already been delivered — they live on the
      // Deliveries tab now.
      const pk = pickupByItemId.get(row.item_id);
      if (pk?.status === "completed") return false;
      return true;
    })
    .filter((row) => {
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
      const catalogEntry = itemByName(overall, itemName);
      const item = await findOrCreateItem({
        name: itemName,
        category: overall,
        shelf_life_days: catalogEntry?.shelf_life_days,
      });
      await addInventorySnapshot({
        store_id: profile.store_id,
        item_id: item.id,
        qty_on_hand: Number(qty),
        expiry_date: expiry,
        catalog_item_id: catalogEntry?.item_id,
        catalog_category_id: catalogEntry?.category_id,
        shelf_life_days: catalogEntry?.shelf_life_days,
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

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCsvFile = async (file: File) => {
    setCsvFileName(file.name);
    setCsvError("");
    setCsvRows([]);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) { setCsvError("CSV is empty"); return; }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const expected = ["category", "item_name", "quantity", "expiry_date"];
    if (expected.some((h, i) => header[i] !== h)) {
      setCsvError(`Header must be: ${expected.join(",")}`);
      return;
    }
    const parsed: ParsedCsvRow[] = rows.slice(1).map((r) => {
      const row: ParsedCsvRow = {
        category: (r[0] ?? "").trim(),
        item_name: (r[1] ?? "").trim(),
        quantity: (r[2] ?? "").trim(),
        expiry_date: (r[3] ?? "").trim(),
      };
      if (!row.category || !row.item_name || !row.quantity || !row.expiry_date) {
        row.error = "Missing field";
      } else if (!OVERALL_CATEGORIES.includes(row.category)) {
        row.error = `Unknown category "${row.category}"`;
      } else if (!/^\d+$/.test(row.quantity) || Number(row.quantity) <= 0) {
        row.error = "Quantity must be a positive integer";
      } else if (isNaN(Date.parse(row.expiry_date))) {
        row.error = "Invalid date (use YYYY-MM-DD)";
      }
      return row;
    });
    setCsvRows(parsed);
  };

  const onImportCsv = async () => {
    if (!profile?.store_id) return toast.error("No store linked");
    const valid = csvRows.filter((r) => !r.error);
    if (valid.length === 0) return toast.error("No valid rows to import");
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const r of valid) {
      try {
        const catalogEntry = itemByName(r.category, r.item_name);
        const item = await findOrCreateItem({
          name: r.item_name,
          category: r.category,
          shelf_life_days: catalogEntry?.shelf_life_days,
        });
        await addInventorySnapshot({
          store_id: profile.store_id,
          item_id: item.id,
          qty_on_hand: Number(r.quantity),
          expiry_date: r.expiry_date,
          catalog_item_id: catalogEntry?.item_id,
          catalog_category_id: catalogEntry?.category_id,
          shelf_life_days: catalogEntry?.shelf_life_days,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false);
    const skipped = csvRows.length - valid.length;
    toast.success(`Imported ${ok} item${ok === 1 ? "" : "s"}${fail ? `, ${fail} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}`);
    qc.invalidateQueries({ queryKey: ["inventory", profile.store_id] });
    setCsvOpen(false);
    setCsvRows([]);
    setCsvFileName("");
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Store Inventory Snapshot</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Foresight &amp; Stewardship for your perishable stock at{" "}
            <span className="font-semibold text-foreground">{myStore?.name ?? "your store"}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-12 gap-2 rounded-sm px-5 font-bold"
            onClick={() => setCsvOpen(true)}
          >
            <Upload className="h-4 w-4" /> Upload CSV
          </Button>
          <Button className="h-12 gap-2 rounded-sm px-6 font-bold shadow-sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Add Inventory Item
          </Button>
        </div>
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
                  <th className="px-6 py-3 font-semibold">Claimed</th>
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
                            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-semibold",
                            styles.chip,
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
                          {d <= 0 ? "Expired" : `${d} ${d === 1 ? "Day" : "Days"} Left`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const pk = pickupByItemId.get(row.item_id);
                          if (!pk || pk.status !== "confirmed") {
                            return (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                Available
                              </span>
                            );
                          }
                          const who =
                            pk.confirmed_by_profile?.display_name ??
                            pk.food_banks?.name ??
                            "a coordinator";
                          return (
                            <PickupDetailsPopover
                              pickup={pk}
                              viewer="retailer"
                              trigger={
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-sm bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground transition hover:bg-primary-soft/80"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Claimed by {who}
                                </button>
                              }
                            />
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="rounded-sm p-1 text-muted-foreground transition hover:bg-surface-high hover:text-primary"
                              aria-label="Item actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="z-[70] w-44 p-1">
                            {(() => {
                              const pk = pickupByItemId.get(row.item_id);
                              const isClaimed = pk?.status === "confirmed";
                              return (
                            <button
                              type="button"
                              disabled={isClaimed}
                              onClick={async () => {
                                if (!profile?.store_id) return;
                                if (isClaimed) return;
                                if (!confirm(`Remove "${row.items?.name}" from inventory? This also clears its forecasts for coordinators.`)) return;
                                try {
                                  await deleteInventorySnapshot({
                                    id: row.id,
                                    store_id: profile.store_id,
                                    item_id: row.item_id,
                                  });
                                  toast.success("Item removed");
                                  qc.invalidateQueries({ queryKey: ["inventory", profile.store_id] });
                                  qc.invalidateQueries({ queryKey: ["predictions"] });
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Could not remove");
                                }
                              }}
                              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-semibold text-destructive transition hover:bg-destructive-soft disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
                              title={isClaimed ? "This item is already claimed by a coordinator" : undefined}
                            >
                              <Trash2 className="h-4 w-4" /> Remove item
                            </button>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
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
            <h3 className="text-lg font-bold">Forecast Insight</h3>
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
              <h2 className="text-xl font-bold text-primary">Add Inventory Item</h2>
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
                options={overall ? itemsForOverall(overall).map((i) => i.name) : []}
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

      {/* CSV Upload Drawer */}
      {csvOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={closeCsvDrawer} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-surface-low p-6">
              <h2 className="text-xl font-bold text-primary">Bulk Upload Inventory</h2>
              <button
                onClick={closeCsvDrawer}
                className="rounded-sm p-2 text-muted-foreground transition hover:bg-surface-high"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="rounded-sm border border-border bg-surface-low p-4 text-sm">
                <p className="font-semibold text-foreground">Expected columns</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">category, item_name, quantity, expiry_date</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dates use YYYY-MM-DD. Category must match an existing app category (e.g. Produce, Bakery).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-9 gap-2 rounded-sm font-semibold"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4" /> Download template
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CSV file</Label>
                <div
                  onClick={() => csvFileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) onCsvFile(f);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-primary/25 bg-primary/5 p-8 text-center transition hover:border-primary/40 hover:bg-primary/10"
                >
                  <Upload className="h-8 w-8 text-primary/50" />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-primary">Choose a file</span> or drag it here
                  </p>
                  {csvFileName && (
                    <p className="text-xs text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{csvFileName}</span>
                    </p>
                  )}
                </div>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onCsvFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {csvError && (
                <div className="rounded-sm border border-destructive bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
                  {csvError}
                </div>
              )}

              {csvRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview — {csvRows.filter((r) => !r.error).length} valid / {csvRows.length} total
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-sm border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-low text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Item</th>
                          <th className="px-3 py-2 font-semibold">Qty</th>
                          <th className="px-3 py-2 font-semibold">Expiry</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvRows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <div className="font-semibold">{r.item_name}</div>
                              <div className="text-xs text-muted-foreground">{r.category}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{r.quantity}</td>
                            <td className="px-3 py-2 text-xs">{r.expiry_date}</td>
                            <td className="px-3 py-2">
                              {r.error ? (
                                <span className="text-xs font-semibold text-destructive">{r.error}</span>
                              ) : (
                                <span className="text-xs font-semibold text-primary">Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-border p-6">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-sm font-bold"
                onClick={closeCsvDrawer}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importing || csvRows.filter((r) => !r.error).length === 0}
                className="h-12 flex-1 rounded-sm font-bold"
                onClick={onImportCsv}
              >
                {importing ? "Importing…" : `Import ${csvRows.filter((r) => !r.error).length} items`}
              </Button>
            </div>
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
        <PopoverContent className="z-[80] w-[--radix-popover-trigger-width] p-0" align="start">
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
