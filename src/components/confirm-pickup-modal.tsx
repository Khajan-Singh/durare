import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfidenceBar } from "./confidence-bar";
import type { PredictionWithRefs } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export function ConfirmPickupModal({
  prediction,
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  prediction: PredictionWithRefs | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!prediction) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setAcknowledged(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm pickup</DialogTitle>
          <DialogDescription>
            You are scheduling a pickup based on a forecast. Review the details
            before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <div className="flex justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Item
                </div>
                <div className="font-medium">{prediction.item.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Store
                </div>
                <div className="font-medium">{prediction.store.name}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Predicted quantity
              </div>
              <ConfidenceBar
                low={prediction.confidence_low}
                point={prediction.predicted_surplus_qty}
                high={prediction.confidence_high}
                className="mt-1"
              />
            </div>
            <div className="mt-3 text-sm">
              Ready{" "}
              <span className="font-medium">
                {formatDate(prediction.target_date)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/15 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <p className="text-warning-foreground">
              <strong>Durare predicts and recommends — it does NOT decide whether to dispatch.</strong>{" "}
              You confirm food safety, capacity, and cold-storage readiness before scheduling this pickup.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <span>
              I've reviewed safety, capacity, and cold-storage requirements for this pickup.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!acknowledged || submitting}>
            {submitting ? "Confirming…" : "Confirm pickup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}