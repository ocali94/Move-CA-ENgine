import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressStepper({
  steps,
  active,
}: {
  steps: readonly { label: string; status?: "done" | "active" | "locked" | "pending" }[];
  active?: number;
}) {
  return (
    <div className="flex items-start overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const state = step.status ?? (index < (active ?? 0) ? "done" : index === active ? "active" : "pending");
        return (
          <div key={step.label} className="flex min-w-28 flex-1 items-start">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border text-sm font-bold",
                  state === "done" && "border-green bg-green text-white",
                  state === "active" && "border-green bg-surface text-ink ring-4 ring-green/20",
                  state === "locked" && "border-edge bg-surface text-ink-faint",
                  state === "pending" && "border-edge bg-surface text-ink-muted",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className="max-w-24 text-center text-xs font-medium text-ink-muted">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className="mt-4 h-px flex-1 border-t border-dashed border-edge" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
