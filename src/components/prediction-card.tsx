import { useState } from "react";
import { ChevronDown, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PredictionWithRefs } from "@/lib/data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

type Tone = "primary" | "warning" | "urgent";

export function PredictionCard({
  prediction,
  distanceMiles,
  isNearest,
  onReview,
}: {
  prediction: PredictionWithRefs;
  distanceMiles: number | null;
  isNearest?: boolean;
  onReview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const days = daysUntil(prediction.target_date);

  const tone: Tone = days <= 0 ? "urgent" : days <= 1 ? "warning" : "primary";

  const toneStyles: Record<Tone, {
    border: string;
    chipBg: string;
    chipText: string;
    numText: string;
    bandTrack: string;
    bandFill: string;
    bandPoint: string;
    button: string;
    ribbon?: { bg: string; text: string };
  }> = {
    primary: {
      border: "border-border",
      chipBg: "bg-secondary",
      chipText: "text-secondary-foreground",
      numText: "text-primary",
      bandTrack: "bg-secondary",
      bandFill: "bg-primary-soft",
      bandPoint: "bg-primary",
      button: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
    warning: {
      border: "border-warning-soft",
      chipBg: "bg-warning-soft",
      chipText: "text-warning-soft-foreground",
      numText: "text-warning-foreground",
      bandTrack: "bg-warning-soft/60",
      bandFill: "bg-warning/40",
      bandPoint: "bg-warning",
      button: "bg-warning text-warning-foreground hover:brightness-105",
      ribbon: { bg: "bg-warning", text: "text-warning-foreground" },
    },
    urgent: {
      border: "border-destructive-soft",
      chipBg: "bg-destructive-soft",
      chipText: "text-destructive-soft-foreground",
      numText: "text-destructive",
      bandTrack: "bg-destructive-soft/50",
      bandFill: "bg-destructive-soft",
      bandPoint: "bg-destructive",
      button: "bg-destructive text-destructive-foreground hover:brightness-105",
      ribbon: { bg: "bg-destructive", text: "text-destructive-foreground" },
    },
  };
  const s = toneStyles[tone];

  const range = Math.max(1, prediction.confidence_high - prediction.confidence_low);
  const point = prediction.predicted_surplus_qty;
  const max = prediction.confidence_high * 1.15;
  const lowPct = (prediction.confidence_low / max) * 100;
  const widthPct = (range / max) * 100;
  const pointPct = (point / max) * 100;

  return (
    <div className={cn("card-elevated relative flex flex-col p-6", "border-2", s.border)}>
      {s.ribbon && (
        <div
          className={cn(
            "absolute -top-3 right-6 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm",
            s.ribbon.bg,
            s.ribbon.text,
          )}
        >
          {tone === "urgent" ? "Urgent" : "Expiring Soon"}
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className={cn("inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s.chipBg, s.chipText)}>
            {prediction.item.category}
          </span>
          <h3 className="mt-2 text-xl font-bold text-primary">{prediction.item.name}</h3>
          <p className="text-sm text-muted-foreground">{prediction.store.name}</p>
        </div>
        {isNearest && (
          <div className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Nearest
          </div>
        )}
      </div>

      <div className="mb-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Predicted Surplus
        </p>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-[40px] font-extrabold leading-none", s.numText)}>{point}</span>
          <span className="text-base text-muted-foreground">units</span>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Confidence Range</span>
          <span className="font-bold text-foreground">
            {prediction.confidence_low}&ndash;{prediction.confidence_high}
          </span>
        </div>
        <div className={cn("relative h-6 overflow-hidden rounded-full px-1", s.bandTrack)}>
          <div
            className={cn("absolute top-1 h-4 rounded-full", s.bandFill)}
            style={{ left: `${lowPct}%`, width: `${widthPct}%` }}
          />
          <div
            className={cn("absolute top-0 h-6 w-1.5 rounded-full shadow", s.bandPoint)}
            style={{ left: `calc(${pointPct}% - 3px)` }}
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Tile label="Ready Date" value={formatDate(prediction.target_date)} tone={tone === "urgent" ? "urgent" : "neutral"} />
        <Tile
          label="Distance"
          value={distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : "—"}
        />
      </div>

      <details className="mb-5 group" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm text-primary transition hover:bg-secondary">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-warning" />
            Why this forecast?
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </summary>
        <div className="mt-2 rounded-lg bg-secondary p-3 text-sm italic text-muted-foreground">
          {prediction.drivers ?? "No driver explanation provided by the model."}
        </div>
      </details>

      <Button
        onClick={onReview}
        className={cn("mt-auto h-12 w-full rounded-xl text-sm font-bold shadow-sm", s.button)}
      >
        {tone === "urgent" ? "Route Immediately" : tone === "warning" ? "Priority Pickup" : "Review & Confirm Pickup"}
      </Button>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "urgent";
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        tone === "urgent" ? "bg-destructive-soft/40" : "bg-secondary",
      )}
    >
      <p
        className={cn(
          "text-[11px] uppercase tracking-wide",
          tone === "urgent" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-bold",
          tone === "urgent" ? "text-destructive" : "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}