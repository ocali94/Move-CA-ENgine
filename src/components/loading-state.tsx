import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Working" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin text-green-ink" />
      {label}
    </div>
  );
}
