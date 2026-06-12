"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  ActivityItem,
  CallPrepBrief,
  CampaignSignal,
  DemandPulse,
  DemandPulseDriver,
  ForecastReferenceSource,
  KnowledgeReference,
  LeadQualificationResult,
  MarketSignal,
  ProposalProject,
} from "@/lib/types";
import { makeId } from "@/lib/utils";

export type AppState = {
  leads: LeadQualificationResult[];
  callPrepBriefs: CallPrepBrief[];
  proposalProjects: ProposalProject[];
  references: KnowledgeReference[];
  activity: ActivityItem[];
  latestDemandPulse?: DemandPulse;
  latestCampaignSignal?: CampaignSignal;
};

const storageKey = "move-ca-engine-state-v1";
const stateUpdatedEvent = "move-ca-state-updated";
const fallbackDate = "1970-01-01T00:00:00.000Z";

export const emptyState: AppState = {
  leads: [],
  callPrepBriefs: [],
  proposalProjects: [],
  references: [],
  activity: [],
};

export function readAppState(): AppState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? normalizeStoredState({ ...emptyState, ...JSON.parse(raw) }) : emptyState;
  } catch {
    return emptyState;
  }
}

export function writeAppState(state: AppState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

type AppStateSnapshot = {
  state: AppState;
  loaded: boolean;
};

const serverSnapshot: AppStateSnapshot = {
  state: emptyState,
  loaded: false,
};

let currentSnapshot: AppStateSnapshot = serverSnapshot;

function getClientSnapshot(): AppStateSnapshot {
  if (typeof window === "undefined") return serverSnapshot;
  if (!currentSnapshot.loaded) {
    currentSnapshot = {
      state: readAppState(),
      loaded: true,
    };
  }
  return currentSnapshot;
}

function subscribeToAppState(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = () => {
    currentSnapshot = {
      state: readAppState(),
      loaded: true,
    };
    callback();
  };

  window.addEventListener(stateUpdatedEvent, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(stateUpdatedEvent, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function useAppState() {
  const snapshot = useSyncExternalStore(subscribeToAppState, getClientSnapshot, () => serverSnapshot);

  const update = useCallback((updater: (state: AppState) => AppState) => {
    const current = getClientSnapshot().state;
    const next = updater(current);
    currentSnapshot = {
      state: next,
      loaded: true,
    };
    writeAppState(next);
    window.dispatchEvent(new Event(stateUpdatedEvent));
  }, []);

  return { state: snapshot.state, update, loaded: snapshot.loaded };
}

export function addActivity(
  state: AppState,
  module: ActivityItem["module"],
  title: string,
  detail: string,
): AppState {
  return {
    ...state,
    activity: [
      {
        id: makeId("activity"),
        createdAt: new Date().toISOString(),
        module,
        title,
        detail,
      },
      ...state.activity,
    ].slice(0, 40),
  };
}

export function exportStateJson(state: AppState) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      warning:
        "V1 saves projects in this browser. Keep this JSON if you want a backup or need to move devices.",
      state,
    },
    null,
    2,
  );
}

export function downloadText(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeStoredState(state: AppState): AppState {
  return {
    ...state,
    leads: Array.isArray(state.leads) ? state.leads : [],
    callPrepBriefs: Array.isArray(state.callPrepBriefs) ? state.callPrepBriefs : [],
    proposalProjects: Array.isArray(state.proposalProjects) ? state.proposalProjects : [],
    references: Array.isArray(state.references) ? state.references : [],
    activity: Array.isArray(state.activity) ? state.activity : [],
    latestDemandPulse: state.latestDemandPulse ? normalizeStoredDemandPulse(state.latestDemandPulse) : undefined,
    latestCampaignSignal: state.latestCampaignSignal ? normalizeStoredCampaignSignal(state.latestCampaignSignal) : undefined,
  };
}

function normalizeStoredDemandPulse(pulse: Partial<DemandPulse>): DemandPulse {
  const signals = Array.isArray(pulse.signals) ? pulse.signals.map(normalizeStoredSignal) : [];
  const drivers = Array.isArray(pulse.drivers) ? pulse.drivers : buildStoredDrivers(signals);

  return {
    score: typeof pulse.score === "number" ? pulse.score : null,
    status: isDemandStatus(pulse.status) ? pulse.status : "unavailable",
    trend: isTrend(pulse.trend) ? pulse.trend : "unavailable",
    changeLabel: typeof pulse.changeLabel === "string" ? pulse.changeLabel : "Unavailable",
    summary: typeof pulse.summary === "string" ? pulse.summary : "Market data is unavailable.",
    quickSummary:
      typeof pulse.quickSummary === "string"
        ? pulse.quickSummary
        : "This saved market snapshot predates the upgraded forecasting summary. Refresh market data for the full read.",
    updatedAt: typeof pulse.updatedAt === "string" ? pulse.updatedAt : fallbackDate,
    history: Array.isArray(pulse.history) ? pulse.history.filter(isHistoryPoint) : [],
    drivers,
    referenceSources: Array.isArray(pulse.referenceSources)
      ? pulse.referenceSources.filter(isReferenceSource)
      : buildStoredReferences(signals),
    signals,
    dataMode: isDataMode(pulse.dataMode) ? pulse.dataMode : "cached",
  };
}

function normalizeStoredSignal(signal: Partial<MarketSignal>): MarketSignal {
  return {
    id: typeof signal.id === "string" ? signal.id : makeId("signal"),
    name: typeof signal.name === "string" ? signal.name : "Unknown signal",
    value: typeof signal.value === "number" ? signal.value : null,
    unit: signal.unit,
    trend: isTrend(signal.trend) ? signal.trend : "unavailable",
    trendLabel: typeof signal.trendLabel === "string" ? signal.trendLabel : "Unavailable",
    updatedAt: typeof signal.updatedAt === "string" ? signal.updatedAt : fallbackDate,
    source: typeof signal.source === "string" ? signal.source : "Unknown source",
    sourceUrl: signal.sourceUrl,
    forecastWeight: typeof signal.forecastWeight === "number" ? signal.forecastWeight : undefined,
    history: Array.isArray(signal.history) ? signal.history.filter(isSignalHistoryPoint) : [],
    plainEnglish: typeof signal.plainEnglish === "string" ? signal.plainEnglish : "No explanation available.",
    scoreContribution: typeof signal.scoreContribution === "number" ? signal.scoreContribution : null,
    dataMode:
      signal.dataMode === "live" || signal.dataMode === "cached" || signal.dataMode === "demo" || signal.dataMode === "unavailable"
        ? signal.dataMode
        : undefined,
  };
}

function normalizeStoredCampaignSignal(campaign: Partial<CampaignSignal>): CampaignSignal | undefined {
  // Snapshots saved by the pre-upgrade app used a different shape; drop them
  // so the page fetches a fresh campaign signal instead of rendering blanks.
  if (!Array.isArray(campaign.whatChangedThisWeek) || !Array.isArray(campaign.campaignAngles)) {
    return undefined;
  }

  return {
    id: typeof campaign.id === "string" ? campaign.id : makeId("campaign"),
    createdAt: typeof campaign.createdAt === "string" ? campaign.createdAt : fallbackDate,
    headline: typeof campaign.headline === "string" ? campaign.headline : "Campaign signal unavailable",
    whatChangedThisWeek: arrayOfStrings(campaign.whatChangedThisWeek),
    whatItMeansForDtc: arrayOfStrings(campaign.whatItMeansForDtc),
    campaignAngles: arrayOfStrings(campaign.campaignAngles),
    riskLevel: campaign.riskLevel === "low" || campaign.riskLevel === "medium" || campaign.riskLevel === "high" ? campaign.riskLevel : "medium",
    confidenceNote: typeof campaign.confidenceNote === "string" ? campaign.confidenceNote : "Refresh market data for an updated confidence note.",
    generation: campaign.generation,
  };
}

function buildStoredDrivers(signals: MarketSignal[]): DemandPulseDriver[] {
  return signals
    .filter((signal) => typeof signal.scoreContribution === "number")
    .map((signal) => {
      const score = signal.scoreContribution ?? 50;
      return {
        signalId: signal.id,
        label: `${signal.name}: ${signal.value ?? "NA"}${signal.unit ? ` ${signal.unit}` : ""}`,
        impact: score >= 58 ? "positive" : score <= 45 ? "negative" : "neutral",
        reason: `${signal.trendLabel}. ${signal.plainEnglish}`,
      } satisfies DemandPulseDriver;
    })
    .slice(0, 4);
}

function buildStoredReferences(signals: MarketSignal[]): ForecastReferenceSource[] {
  return [
    ...signals.map((signal) => ({
      label: signal.name,
      type: "public_data" as const,
      source: signal.source,
      url: signal.sourceUrl,
      updatedAt: signal.updatedAt,
    })),
    { label: "Demand Pulse Rules", type: "move_reference", source: "content/market-signals/demand-pulse-rules.md" },
    { label: "Campaign Signal Rules", type: "move_reference", source: "content/market-signals/campaign-signal-rules.md" },
    { label: "Move Market Signals Playbook", type: "move_reference", source: "content/playbooks/move-market-signals-rules.md" },
  ];
}

function isTrend(value: unknown): value is DemandPulse["trend"] {
  return value === "up" || value === "down" || value === "flat" || value === "unavailable";
}

function isDemandStatus(value: unknown): value is DemandPulse["status"] {
  return value === "heating" || value === "stable" || value === "cooling" || value === "risk_off" || value === "unavailable";
}

function isDataMode(value: unknown): value is DemandPulse["dataMode"] {
  return value === "live" || value === "cached" || value === "demo" || value === "unavailable";
}

function isHistoryPoint(point: unknown): point is { date: string; score: number } {
  return Boolean(point) && typeof point === "object" && typeof (point as { date?: unknown }).date === "string" && typeof (point as { score?: unknown }).score === "number";
}

function isSignalHistoryPoint(point: unknown): point is { date: string; value: number } {
  return Boolean(point) && typeof point === "object" && typeof (point as { date?: unknown }).date === "string" && typeof (point as { value?: unknown }).value === "number";
}

function isReferenceSource(source: unknown): source is ForecastReferenceSource {
  return Boolean(source) && typeof source === "object" && typeof (source as { label?: unknown }).label === "string" && typeof (source as { source?: unknown }).source === "string";
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
