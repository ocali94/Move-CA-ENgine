import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function SourceChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-edge bg-surface px-2.5 py-1 text-xs text-ink-muted",
        className,
      )}
    >
      <FileText className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
