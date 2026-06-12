import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-dashed border-edge p-6 text-center", className)}>
      <Inbox className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>
    </div>
  );
}
