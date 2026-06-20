import { cn } from "@/lib/utils";

/**
 * Renders the predicted point estimate with its uncertainty band.
 * The band spans confidence_low → confidence_high; the marker shows the point estimate.
 * Visible everywhere a prediction is shown.
 */
export function ConfidenceBar({
  low,
  point,
  high,
  scaleMax,
  className,
}: {
  low: number;
  point: number;
  high: number;
  scaleMax?: number;
  className?: string;
}) {
  const max = scaleMax ?? Math.max(high * 1.1, point * 1.2, 10);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const bandLeft = pct(low);
  const bandWidth = `${Math.min(100, ((high - low) / max) * 100)}%`;
  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-2 w-full rounded-sm bg-confidence-track overflow-hidden">
        <div
          className="absolute top-0 h-full bg-confidence-band rounded-sm"
          style={{ left: bandLeft, width: bandWidth }}
          aria-label={`Confidence range ${low} to ${high} units`}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-confidence-point"
          style={{ left: `calc(${pct(point)} - 1px)` }}
          aria-label={`Point estimate ${point} units`}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground font-mono-tabular">
        <span>{low}</span>
        <span className="text-foreground">{point} units</span>
        <span>{high}</span>
      </div>
    </div>
  );
}