"use client";

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { MarketSignal } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { TrendSparkline } from "@/components/trend-sparkline";

const MOVE_GREEN = "#3ca848";
const MOVE_CORAL = "#f05448";
const MOVE_NAVY_MUTED = "#7c85a6";

export function SignalCard({ signal }: { signal: MarketSignal }) {
  const Icon = signal.trend === "up" ? ArrowUp : signal.trend === "down" ? ArrowDown : ArrowRight;
  const color = signal.trend === "down" ? MOVE_CORAL : signal.trend === "up" ? MOVE_GREEN : MOVE_NAVY_MUTED;

  return (
    <article className="rounded-md border border-edge-soft bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{signal.name}</h3>
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-ink-faint underline-offset-4 hover:text-green-ink hover:underline"
            >
              {signal.source}
            </a>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">{signal.source}</p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-lg font-bold" style={{ color }}>
            {signal.value ?? "NA"}
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs text-ink-faint">{signal.unit}</p>
        </div>
      </div>
      <TrendSparkline data={signal.history} color={color} />
      <p className="mt-3 text-sm leading-5 text-ink-muted">
        <span className="font-semibold text-ink">What it means: </span>
        {signal.plainEnglish}
      </p>
      {/* "cached" is the normal healthy state (header carries the freshness
          label), so only the genuine problem states get a per-signal badge. */}
      {signal.dataMode === "demo" || signal.dataMode === "unavailable" ? (
        <div className="mt-3">
          <StatusBadge kind={signal.dataMode === "unavailable" ? "danger" : "warning"}>
            {signal.dataMode === "demo" ? "demo data" : "source unavailable"}
          </StatusBadge>
        </div>
      ) : null}
    </article>
  );
}
