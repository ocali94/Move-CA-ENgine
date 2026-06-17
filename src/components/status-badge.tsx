import { CheckCircle2, Clock3, Info, Lock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusKind } from "@/lib/types";

const styles: Record<StatusKind, string> = {
  success: "border-green/45 bg-green/12 text-green-ink",
  warning: "border-warn/45 bg-warn/12 text-warn",
  danger: "border-coral/45 bg-coral/12 text-coral-ink",
  info: "border-navy/30 bg-navy/8 text-ink-muted dark:border-edge dark:bg-surface",
  neutral: "border-edge bg-surface text-ink-muted",
};

const icons = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: TriangleAlert,
  info: Info,
  neutral: Clock3,
};

export function StatusBadge({
  children,
  kind = "neutral",
  icon,
  className,
  title,
}: {
  children: React.ReactNode;
  kind?: StatusKind;
  icon?: "lock" | "none";
  className?: string;
  title?: string;
}) {
  const Icon = icon === "lock" ? Lock : icon === "none" ? null : icons[kind];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium",
        styles[kind],
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}
