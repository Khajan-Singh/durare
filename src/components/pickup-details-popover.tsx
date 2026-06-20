import { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Calendar, Mail, MapPin, Package, Store as StoreIcon, User } from "lucide-react";
import type { Pickup } from "@/lib/data";
import { formatDate, haversineMiles } from "@/lib/utils";

type Viewer = "retailer" | "coordinator";

export function PickupDetailsPopover({
  pickup,
  viewer,
  trigger,
}: {
  pickup: Pickup;
  viewer: Viewer;
  trigger: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="z-[70] w-80 p-0">
        <PickupDetailsCard pickup={pickup} viewer={viewer} />
      </PopoverContent>
    </Popover>
  );
}

export function PickupDetailsCard({
  pickup,
  viewer,
}: {
  pickup: Pickup;
  viewer: Viewer;
}) {
  const distance =
    pickup.stores && pickup.food_banks
      ? haversineMiles(
          { lat: pickup.stores.lat, lng: pickup.stores.lng },
          { lat: pickup.food_banks.lat, lng: pickup.food_banks.lng },
        )
      : null;

  const statusTone =
    pickup.status === "completed"
      ? "bg-success/15 text-success"
      : "bg-primary-soft text-primary-soft-foreground";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {viewer === "retailer" ? "Pickup details" : "Confirmed pickup"}
          </p>
          <p className="mt-0.5 text-base font-bold text-primary">
            {pickup.items?.name ?? "Item"}
          </p>
          <p className="text-xs text-muted-foreground">
            {pickup.quantity} units · {formatDate(pickup.scheduled_date)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}
        >
          {pickup.status}
        </span>
      </div>

      {viewer === "retailer" ? (
        <Section
          icon={<Building2 className="h-4 w-4" />}
          title="Food bank"
          primary={pickup.food_banks?.name ?? "—"}
          secondary={pickup.food_banks?.address ?? "Address not on file"}
        />
      ) : (
        <Section
          icon={<StoreIcon className="h-4 w-4" />}
          title="Retailer"
          primary={pickup.stores?.name ?? "—"}
          secondary={pickup.stores?.address ?? "Address not on file"}
        />
      )}

      <Section
        icon={<User className="h-4 w-4" />}
        title={viewer === "retailer" ? "Coordinator" : "Confirmed by"}
        primary={
          pickup.confirmed_by_profile?.display_name ??
          pickup.confirmed_by_profile?.email ??
          "Unknown coordinator"
        }
        secondary={pickup.confirmed_by_profile?.email ?? null}
        secondaryIcon={<Mail className="h-3 w-3" />}
      />

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Stat icon={<Package className="h-3.5 w-3.5" />} label="Qty" value={String(pickup.quantity)} />
        <Stat icon={<Calendar className="h-3.5 w-3.5" />} label="Date" value={pickup.scheduled_date.slice(5)} />
        <Stat
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Distance"
          value={distance !== null ? `${distance.toFixed(1)} mi` : "—"}
        />
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  primary,
  secondary,
  secondaryIcon,
}: {
  icon: ReactNode;
  title: string;
  primary: string;
  secondary?: string | null;
  secondaryIcon?: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface-low p-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="truncate text-sm font-bold text-primary">{primary}</p>
        {secondary && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            {secondaryIcon}
            <span className="truncate">{secondary}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}