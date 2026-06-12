import { cn } from "@/lib/utils";

export function CircularGauge({
  value,
  label,
  sublabel,
  size = 132,
  className,
}: {
  value: number | null;
  label: string;
  sublabel?: string;
  size?: number;
  className?: string;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--edge)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f05448" />
            <stop offset="100%" stopColor="#3ca848" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold text-ink">{value ?? "NA"}</div>
        <div className="text-xs font-semibold text-ink-muted">{label}</div>
        {sublabel ? <div className="mt-1 text-xs text-green-ink">{sublabel}</div> : null}
      </div>
    </div>
  );
}
