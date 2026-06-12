import type { LucideIcon } from "lucide-react";

export function InsightRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[22px_1fr_auto] items-start gap-3 border-b border-edge-soft py-3 last:border-0">
      <Icon className="mt-0.5 h-5 w-5 text-green-ink" />
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="max-w-60 text-right text-sm text-ink-muted">{value}</span>
    </div>
  );
}
