"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Database,
  FileText,
  Megaphone,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActionButton } from "@/components/action-button-group";
import { CircularGauge } from "@/components/circular-gauge";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GenerationFooter, reportLlmActivity } from "@/components/llm-status";
import { LoadingState } from "@/components/loading-state";
import { SignalCard } from "@/components/signal-card";
import { StatusBadge } from "@/components/status-badge";
import { addActivity, useAppState } from "@/lib/client-storage";
import type { DemandPulse } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const MOVE_GREEN = "#3ca848";
const MOVE_CORAL = "#f05448";

export function MarketSignalsClient() {
  const { state, update, loaded } = useAppState();
  const pulse = state.latestDemandPulse;
  const campaign = state.latestCampaignSignal;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-signals/latest");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Market Signals refresh failed.");
      reportLlmActivity(data.campaignSignal?.generation);
      update((current) =>
        addActivity(
          { ...current, latestDemandPulse: data.pulse, latestCampaignSignal: data.campaignSignal },
          "market",
          "Market Signals refreshed",
          data.pulse.summary,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Market Signals refresh failed.");
    } finally {
      setLoading(false);
    }
  }, [update]);

  useEffect(() => {
    if (loaded && !pulse) {
      const timer = window.setTimeout(() => {
        void refresh();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loaded, pulse, refresh]);

  return (
    <div className="space-y-5">
      <section className="move-panel rounded-md p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
              <BarChart3 className="h-6 w-6 text-green-ink" />
              Market Signals
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
              The demand environment Move&apos;s clients sell into, tied to public market references and Move&apos;s internal campaign rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {pulse ? (
              <StatusBadge kind={pulse.dataMode === "live" ? "success" : pulse.dataMode === "cached" ? "warning" : pulse.dataMode === "demo" ? "warning" : "danger"}>
                {pulse.dataMode === "live"
                  ? "live data"
                  : pulse.dataMode === "cached"
                    ? "cached data"
                    : pulse.dataMode === "demo"
                      ? "demo data (dev only)"
                      : "data unavailable"}
              </StatusBadge>
            ) : null}
            <ActionButton type="button" onClick={refresh} disabled={loading}>
              <RefreshCcw className="h-4 w-4" />
              Refresh market data
            </ActionButton>
          </div>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {loading && !pulse ? <LoadingState label="Fetching market signals" /> : null}

      {pulse ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="move-panel rounded-md p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-ink">Demand Pulse</h2>
                  <p className="mt-1 text-sm text-ink-muted">One team-readable number blending all six signals.</p>
                </div>
                <StatusBadge kind={pulse.status === "risk_off" || pulse.status === "cooling" ? "danger" : pulse.status === "unavailable" ? "neutral" : "success"}>
                  {pulse.status.replace("_", " ")}
                </StatusBadge>
              </div>
              <div className="grid place-items-center">
                <CircularGauge value={pulse.score} label="Demand Pulse" sublabel={pulse.changeLabel} size={220} />
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-ink">
                <PulseTrendIcon trend={pulse.trend} />
                {pulse.trend === "down" ? "Trending down" : pulse.trend === "up" ? "Trending up" : pulse.trend === "flat" ? "Holding steady" : "No trend available"}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{pulse.summary}</p>
              <p className="mt-4 text-xs text-ink-faint">Updated {formatDateTime(pulse.updatedAt)}</p>
            </div>

            <div className="grid gap-5">
              <QuickDataSummary pulse={pulse} />
              <DemandPulseTrendChart history={pulse.history ?? []} />
            </div>
          </section>

          <section className="move-panel rounded-md p-5">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-ink">Signal Inputs</h2>
                <p className="mt-1 text-sm text-ink-muted">Current values, direction, sparkline history, and what each one means in plain English.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(pulse.signals ?? []).map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </section>

          <ForecastReferenceBasis pulse={pulse} />

          <section className="move-panel rounded-md p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-ink">
                  <Megaphone className="h-5 w-5 text-green-ink" />
                  Campaign Signal
                </h2>
                <p className="mt-1 text-sm text-ink-muted">This week&apos;s campaign brief, written from the numbers above and nothing else.</p>
              </div>
              {campaign ? <StatusBadge kind={campaign.riskLevel === "high" ? "danger" : campaign.riskLevel === "medium" ? "warning" : "success"}>{campaign.riskLevel} risk</StatusBadge> : null}
            </div>
            {campaign ? (
              <div className="space-y-5">
                <div className="rounded-md border border-edge-soft bg-surface p-4">
                  <h3 className="text-lg font-black text-ink">{campaign.headline}</h3>
                  <p className="mt-2 text-xs text-ink-faint">{campaign.confidenceNote}</p>
                </div>
                <div className="grid gap-5 lg:grid-cols-3">
                  <CampaignBlock title="What changed this week" items={campaign.whatChangedThisWeek ?? []} />
                  <CampaignBlock title="What it means for $1M to $50M DTC brands" items={campaign.whatItMeansForDtc ?? []} />
                  <CampaignBlock title="What Move should campaign on now" items={campaign.campaignAngles ?? []} />
                </div>
                <GenerationFooter generation={campaign.generation} />
              </div>
            ) : (
              <EmptyState title="No campaign signal yet" body="Refresh market data to generate a campaign signal from the fetched numbers." />
            )}
          </section>
        </>
      ) : (
        <EmptyState title="Market data unavailable" body="Refresh once connectivity is back. The dashboard never invents numbers." />
      )}
    </div>
  );
}

function PulseTrendIcon({ trend }: { trend: DemandPulse["trend"] }) {
  if (trend === "up") return <ArrowUp className="h-5 w-5" style={{ color: MOVE_GREEN }} />;
  if (trend === "down") return <ArrowDown className="h-5 w-5" style={{ color: MOVE_CORAL }} />;
  return <ArrowRight className="h-5 w-5 text-ink-faint" />;
}

function QuickDataSummary({ pulse }: { pulse: DemandPulse }) {
  const drivers = pulse.drivers ?? [];
  const strongestPositive = drivers.find((driver) => driver.impact === "positive");
  const strongestNegative = drivers.find((driver) => driver.impact === "negative");

  return (
    <section className="move-panel rounded-md p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink">Quick Data Summary</h2>
          <p className="mt-1 text-sm text-ink-muted">The short read for demand forecasting.</p>
        </div>
        <PulseTrendIcon trend={pulse.trend} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryMetric label="Current pulse" value={pulse.score === null ? "NA" : `${pulse.score}/100`} />
        <SummaryMetric label="Trend direction" value={pulse.changeLabel} />
        <SummaryMetric label="Strongest positive driver" value={strongestPositive?.label ?? "No clear positive driver"} />
        <SummaryMetric label="Strongest negative driver" value={strongestNegative?.label ?? "No clear negative driver"} />
      </div>
      <p className="mt-4 rounded-md border border-edge-soft bg-surface p-4 text-sm leading-6 text-ink-muted">
        {pulse.quickSummary ?? pulse.summary}
      </p>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-edge-soft bg-surface p-3">
      <p className="text-xs font-semibold text-ink-faint">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-ink">{value}</p>
    </div>
  );
}

function DemandPulseTrendChart({ history }: { history: DemandPulse["history"] }) {
  const chartData = history.map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  return (
    <section className="move-panel rounded-md p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-xl font-black text-ink">Demand Pulse Trend</h2>
        <p className="text-sm text-ink-muted">Blended historical score from each market signal&apos;s normalized history and forecast weight.</p>
      </div>
      {chartData.length ? (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} minTickGap={18} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} />
              <Tooltip
                cursor={{ stroke: MOVE_GREEN, strokeOpacity: 0.35 }}
                contentStyle={{ background: "var(--chart-tip-bg)", border: "1px solid var(--edge)", borderRadius: 8, color: "var(--chart-tip-ink)" }}
                labelStyle={{ color: "var(--chart-tip-ink)" }}
              />
              <Line type="monotone" dataKey="score" name="Demand Pulse" stroke={MOVE_GREEN} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: MOVE_GREEN }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-md border border-edge-soft bg-surface p-4 text-sm text-ink-muted">
          No historical points are available yet.
        </div>
      )}
    </section>
  );
}

function ForecastReferenceBasis({ pulse }: { pulse: DemandPulse }) {
  const references = pulse.referenceSources ?? [];
  const publicSources = references.filter((source) => source.type === "public_data");
  const moveReferences = references.filter((source) => source.type === "move_reference");

  return (
    <section className="move-panel rounded-md p-5">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black text-ink">Forecast Reference Basis</h2>
          <p className="mt-1 text-sm text-ink-muted">The sources behind the demand read and campaign angle rules.</p>
        </div>
        {pulse.dataMode === "demo" ? <StatusBadge kind="warning">demo values, dev only</StatusBadge> : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <ReferenceGroup icon={<Database className="h-5 w-5 text-green-ink" />} title="Public data sources" references={publicSources} />
        <ReferenceGroup icon={<FileText className="h-5 w-5 text-green-ink" />} title="Internal Move references" references={moveReferences} />
      </div>
      {pulse.dataMode === "demo" ? (
        <p className="mt-4 text-xs text-ink-faint">Demo mode uses local sample values; these references show the real basis used when live or cached data is available.</p>
      ) : null}
    </section>
  );
}

function ReferenceGroup({
  icon,
  title,
  references,
}: {
  icon: ReactNode;
  title: string;
  references: DemandPulse["referenceSources"];
}) {
  return (
    <div className="rounded-md border border-edge-soft bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-black text-ink">{title}</h3>
      </div>
      <div className="space-y-3">
        {references.map((reference) => (
          <div key={`${reference.type}-${reference.label}`} className="border-t border-edge-soft pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-semibold text-ink">{reference.label}</p>
            {reference.url ? (
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-words text-xs text-ink-faint underline-offset-4 hover:text-green-ink hover:underline"
              >
                {reference.source}
              </a>
            ) : (
              <p className="mt-1 break-words text-xs text-ink-faint">{reference.source}</p>
            )}
            {reference.updatedAt ? <p className="mt-1 text-xs text-ink-faint">Latest reading {formatDateTime(reference.updatedAt)}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-edge-soft bg-surface p-4">
      <h3 className="mb-3 text-sm font-black text-ink">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-ink-muted">
        {(items ?? []).map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
