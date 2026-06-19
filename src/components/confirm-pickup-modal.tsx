import { useState } from "react";
import { Sparkles, Info, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

  const range = Math.max(1, prediction.confidence_high - prediction.confidence_low);
  const confidence = Math.max(50, Math.round(100 - (range / prediction.predicted_surplus_qty) * 100));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setAcknowledged(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl rounded-3xl">
        <DialogTitle className="sr-only">Confirm pickup</DialogTitle>
        <DialogDescription className="sr-only">
          Review the AI prediction details before scheduling this pickup.
        </DialogDescription>

        {/* Hero image */}
        <div className="relative h-44 w-full overflow-hidden bg-secondary">
          <img
            alt=""
            className="h-full w-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkMi9kUFRkKr1UU86-pnmjRABtryUB1jktf1-M_T8EPQJlon8dVb6D2oRaSJDxtrS7vklYidt8mHjK0pYMgzGbYttz9nza3jqcQ1KW3Nc154np91gLrlUXjDtnRKWnnxbRSKWGzKMW5RR2aiqYeKQAfcKPzfAMTVc725APj1bTTI-PioaDtbnOj3QaRePjS_zY9qSDTx2IiKzg2XdmTo2t-4vdPaEKR1Zwdb1OQ6UgKDOZ2LhgB0ep94Kbo-l0aBGPbPZnbtii6N4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          <div className="absolute bottom-4 left-6">
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-warning px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-warning-foreground">
              <Sparkles className="h-3 w-3" />
              AI Prediction
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-primary">
              Confirm Predicted Pickup
            </h2>
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Partner</p>
              <p className="mt-1 font-bold text-primary">{prediction.store.name}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Predicted Item</p>
              <p className="mt-1 font-bold text-primary">
                {prediction.predicted_surplus_qty} units of {prediction.item.name}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                Prediction Confidence
              </div>
              <span className="text-lg font-extrabold text-primary">{confidence}%</span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Ready <span className="font-semibold text-foreground">{formatDate(prediction.target_date)}</span>
              {" · "}Range {prediction.confidence_low}&ndash;{prediction.confidence_high} units.
            </p>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-warning-soft bg-warning-soft/40 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="text-sm leading-relaxed text-warning-foreground">
              <p className="mb-1 font-bold">AI recommends, human decides.</p>
              <p>
                You confirm food safety, capacity, and cold-storage readiness before scheduling.
              </p>
            </div>
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

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={onConfirm}
              disabled={!acknowledged || submitting}
              className="h-12 w-full gap-2 rounded-xl text-base font-bold shadow-md"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Confirming…" : "Confirm & Schedule Pickup"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full font-medium text-muted-foreground"
            >
              Dismiss for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}