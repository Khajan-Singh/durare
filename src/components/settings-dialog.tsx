import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker, type PickedLocation } from "@/components/location-picker";
import type { Profile } from "@/hooks/use-auth";
import {
  fetchFoodBanks,
  fetchStores,
  updateFoodBank,
  updateProfileName,
  updateStore,
} from "@/lib/data";

export function SettingsDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
}) {
  const qc = useQueryClient();
  const isRetailer = profile.role === "retailer";

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
    enabled: open && isRetailer,
  });
  const banksQuery = useQuery({
    queryKey: ["food_banks"],
    queryFn: fetchFoodBanks,
    enabled: open && !isRetailer,
  });

  const myStore = storesQuery.data?.find((s) => s.id === profile.store_id) ?? null;
  const myBank = banksQuery.data?.find((b) => b.id === profile.food_bank_id) ?? null;

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [orgName, setOrgName] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed form values whenever the dialog opens or the underlying data loads.
  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.display_name ?? "");
    const org = isRetailer ? myStore : myBank;
    if (org) {
      setOrgName(org.name);
      setLocation({
        name: org.name,
        address: org.address ?? "",
        lat: org.lat,
        lng: org.lng,
      });
    }
  }, [open, profile, isRetailer, myStore, myBank]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Your name is required");
      return;
    }
    if (!orgName.trim()) {
      toast.error("Location name is required");
      return;
    }
    if (!location) {
      toast.error("Pick a location from the map");
      return;
    }
    setSaving(true);
    try {
      await updateProfileName(profile.id, displayName.trim());
      if (isRetailer && profile.store_id) {
        await updateStore(profile.store_id, {
          name: orgName.trim(),
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        });
      } else if (!isRetailer && profile.food_bank_id) {
        await updateFoodBank(profile.food_bank_id, {
          name: orgName.trim(),
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        });
      }
      toast.success("Settings updated");
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["food_banks"] });
      // Refresh the profile in the auth hook by triggering a session update.
      // The hook re-reads on auth state change; the simplest path is a soft
      // refetch of any profile-dependent queries.
      qc.invalidateQueries({ queryKey: ["profile"] });
      onOpenChange(false);
      // Force a router-level data refresh so the header name updates.
      window.dispatchEvent(new Event("durare:profile-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Update your name, the {isRetailer ? "store" : "food bank"} name, and address.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your name
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isRetailer ? "Store name" : "Food bank name"}
            </Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              maxLength={120}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Address
            </Label>
            <LocationPicker
              value={location}
              onChange={(loc) => {
                setLocation(loc);
                if (loc) setOrgName((prev) => prev || loc.name);
              }}
              placeholder="Search address or place name…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}