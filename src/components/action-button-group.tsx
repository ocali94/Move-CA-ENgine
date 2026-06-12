import { cn } from "@/lib/utils";

export function ActionButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "border-green/55 bg-green/15 text-green-ink hover:bg-green/25",
    secondary: "border-edge bg-surface text-ink hover:bg-surface-2",
    danger: "border-coral/45 bg-coral/12 text-coral-ink hover:bg-coral/20",
    ghost: "border-edge-soft bg-transparent text-ink-muted hover:bg-surface",
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ActionButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
