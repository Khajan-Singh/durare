import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "./confidence-bar";
import type { PredictionWithRefs } from "@/lib/data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

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
  const urgent = days <= 1;
  const warn = days === 2;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {prediction.item.name}
            </h3>
            <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-wide">
              {prediction.item.category}
            </Badge>
            {isNearest && (
              <Badge className="rounded-full bg-success text-success-foreground hover:bg-success">
                Nearest
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            from <span className="font-medium text-foreground">{prediction.store.name}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-foreground">
            ~{prediction.predicted_surplus_qty}
          </div>
          <div className="text-xs text-muted-foreground">predicted units</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Confidence range
        </div>
        <ConfidenceBar
          low={prediction.confidence_low}
          point={prediction.predicted_surplus_qty}
          high={prediction.confidence_high}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            urgent && "bg-urgent text-urgent-foreground",
            warn && "bg-warning text-warning-foreground",
            !urgent && !warn && "bg-secondary text-secondary-foreground",
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          Ready {formatDate(prediction.target_date)}
          <span className="opacity-80">· in {days}d</span>
        </div>
        {distanceMiles !== null && (
          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {distanceMiles.toFixed(1)} mi away
          </div>
        )}
        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          {prediction.model_version ?? "model"}
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Why this forecast?
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <div className="mt-2 rounded-xl bg-secondary/60 p-3 text-sm text-secondary-foreground">
            {prediction.drivers ?? "No driver explanation provided by the model."}
            <div className="mt-2 text-xs text-muted-foreground">
              These are the model's stated reasons. Forecasts are uncertain — treat the range as a planning guide, not a guarantee.
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <Button onClick={onReview} className="w-full sm:w-auto">
          Review &amp; Confirm Pickup
        </Button>
      </div>
    </div>
  );
}