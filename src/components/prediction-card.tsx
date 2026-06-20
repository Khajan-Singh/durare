import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
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
    bar: string;
    tagBg: string;
    tagText: string;
    bandFill: string;
    bandPoint: string;
    button: string;
    label: string;
  }> = {
    primary: {
      bar: "bg-primary",
      tagBg: "bg-primary-soft",
      tagText: "text-primary-soft-foreground",
      bandFill: "bg-primary-soft",
      bandPoint: "bg-primary",
      button: "bg-primary text-primary-foreground hover:bg-primary/90",
      label: "On track",
    },
    warning: {
      bar: "bg-warning",
      tagBg: "bg-warning-soft",
      tagText: "text-warning-soft-foreground",
      bandFill: "bg-warning-soft",
      bandPoint: "bg-warning",
      button: "bg-primary text-primary-foreground hover:bg-primary/90",
      label: "Expiring soon",
    },
    urgent: {
      bar: "bg-destructive",
      tagBg: "bg-destructive-soft",
      tagText: "text-destructive-soft-foreground",
      bandFill: "bg-destructive-soft",
      bandPoint: "bg-destructive",
      button: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      label: "Urgent",
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
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Left accent bar communicates urgency without dyeing the whole card */}
      <div className={cn("absolute inset-y-0 left-0 w-1", s.bar)} aria-hidden />

      <div className="flex flex-col p-6 pl-7">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{prediction.item.category}</span>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  s.tagBg,
                  s.tagText,
                )}
              >
                {s.label}
              </span>
            </div>
            <h3 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">
              {prediction.item.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{prediction.store.name}</p>
          </div>
          {isNearest && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Nearest
            </div>
          )}
        </div>

        <div className="mb-5 flex items-baseline gap-3">
          <span className="font-mono-tabular text-5xl font-medium leading-none text-foreground">
            {point}
          </span>
          <span className="text-sm text-muted-foreground">units predicted surplus</span>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Confidence range</span>
            <span className="font-mono-tabular text-foreground">
              {prediction.confidence_low}–{prediction.confidence_high}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-confidence-track">
            <div
              className={cn("absolute top-0 h-full rounded-sm", s.bandFill)}
              style={{ left: `${lowPct}%`, width: `${widthPct}%` }}
            />
            <div
              className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-0.5", s.bandPoint)}
              style={{ left: `calc(${pointPct}% - 1px)` }}
            />
          </div>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-xs text-muted-foreground">Ready date</dt>
          <dt className="text-xs text-muted-foreground">Distance</dt>
          <dd className="font-mono-tabular text-foreground">{formatDate(prediction.target_date)}</dd>
          <dd className="font-mono-tabular text-foreground">
            {distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : "—"}
          </dd>
        </dl>

        <details
          className="mb-5 border-t border-border pt-3"
          open={open}
          onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground transition hover:text-foreground">
            <span>Why this forecast?</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {prediction.drivers ?? "No driver explanation provided by the model."}
          </p>
        </details>

        <Button
          onClick={onReview}
          className={cn("mt-auto h-11 w-full rounded-md text-sm font-medium", s.button)}
        >
          {tone === "urgent" ? "Route immediately" : tone === "warning" ? "Priority pickup" : "Review & confirm pickup"}
        </Button>
      </div>
    </div>
  );
}
