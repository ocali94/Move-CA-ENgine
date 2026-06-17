import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { CampaignSignal, DemandPulse, MarketSignal } from "@/lib/types";
import { clamp, makeId } from "@/lib/utils";

const cacheDir = path.join(process.cwd(), ".cache");
const cachePath = path.join(cacheDir, "market-signals.json");

const fredSeries = [
  {
    id: "UMCSENT",
    name: "US Consumer Sentiment",
    unit: "index",
    source: "FRED, University of Michigan",
    sourceUrl: "https://fred.stlouisfed.org/series/UMCSENT",
    forecastWeight: 1.2,
    higherIsBetter: true,
  },
  {
    id: "DSPIC96",
    name: "Real Disposable Income",
    unit: "billions chained 2017 dollars",
    source: "FRED, BEA",
    sourceUrl: "https://fred.stlouisfed.org/series/DSPIC96",
    forecastWeight: 1,
    higherIsBetter: true,
  },
  {
    id: "CPIENGSL",
    name: "Energy Costs",
    unit: "index",
    source: "FRED, BLS",
    sourceUrl: "https://fred.stlouisfed.org/series/CPIENGSL",
    forecastWeight: 0.85,
    higherIsBetter: false,
  },
  {
    id: "PSAVERT",
    name: "Personal Savings Rate",
    unit: "%",
    source: "FRED, BEA",
    sourceUrl: "https://fred.stlouisfed.org/series/PSAVERT",
    forecastWeight: 0.8,
    higherIsBetter: false,
  },
  {
    id: "UNRATE",
    name: "Unemployment",
    unit: "%",
    source: "FRED, BLS",
    sourceUrl: "https://fred.stlouisfed.org/series/UNRATE",
    forecastWeight: 1,
    higherIsBetter: false,
  },
];

const RATIO_ID = "XLY_XLP";
const signalIds = [...fredSeries.map((series) => series.id), RATIO_ID];

/**
 * Plain-English "what it means" lines, derived from the actual direction of
 * the data, written for someone with zero economics background.
 */
function plainEnglishFor(id: string, trend: MarketSignal["trend"]): string {
  const lines: Record<string, Record<"up" | "down" | "flat", string>> = {
    UMCSENT: {
      up: "US shoppers are feeling more confident, which supports spending on wants like DTC products.",
      down: "US shoppers are getting nervous and cutting back. Our clients' customers are spending less on wants.",
      flat: "Shopper confidence is holding steady, neither helping nor hurting discretionary brands right now.",
    },
    DSPIC96: {
      up: "Households have a little more real income to spend, which supports discretionary purchases.",
      down: "After inflation, households have less money in their pockets, so wants-based purchases get squeezed first.",
      flat: "Household spending power is flat, so demand support has to come from somewhere else.",
    },
    CPIENGSL: {
      up: "Energy bills are taking a bigger bite out of household budgets, leaving less for everything else.",
      down: "Energy costs are easing, which frees up a little household budget for other purchases.",
      flat: "Energy costs are stable, so they are not changing what shoppers can afford right now.",
    },
    PSAVERT: {
      up: "People are saving more of their paycheck, which usually means they are spending more carefully.",
      down: "People are saving less and letting more of their paycheck flow into spending.",
      flat: "Saving habits are unchanged, so this is not moving demand either way right now.",
    },
    UNRATE: {
      up: "More people are out of work, which is a direct risk to consumer demand.",
      down: "More people are working, which supports consumer spending.",
      flat: "The job market is steady, so employment is not the thing changing demand right now.",
    },
    XLY_XLP: {
      up: "Investors are favoring 'want' brands over 'need' brands, a positive signal for discretionary DTC.",
      down: "Money is flowing out of 'want' brands and into 'need' brands. The exact market our clients sell in is getting tougher.",
      flat: "The balance between 'want' and 'need' brands is unchanged this period.",
    },
  };
  const byTrend = lines[id];
  if (!byTrend) return "No explanation available for this signal.";
  if (trend === "unavailable") return "This data source could not be read, so no interpretation is shown.";
  return byTrend[trend];
}

export async function getMarketSignals(options?: { force?: boolean }): Promise<DemandPulse> {
  const ttlHours = Number(process.env.MARKET_DATA_CACHE_TTL_HOURS ?? "24");
  const cached = await readCache();

  // `force` (the Refresh button) skips the TTL and re-fetches the sources now;
  // normal loads reuse the cached snapshot within the TTL window.
  if (!options?.force && cached && Date.now() - new Date(cached.updatedAt).getTime() < ttlHours * 60 * 60 * 1000) {
    return normalizePulse(cached, "cached");
  }

  // Each source fetch is isolated: one dead provider can never take the
  // whole dashboard down. Failed signals fall back to the per-signal cache.
  const settled = await Promise.allSettled([
    ...fredSeries.map((series) => fetchFredSignal(series)),
    fetchDiscretionaryStaplesRatio(),
  ]);

  const cachedById = new Map((cached?.signals ?? []).map((signal) => [signal.id, signal]));
  const signals: MarketSignal[] = settled.map((result, index) => {
    const id = signalIds[index];
    if (result.status === "fulfilled") {
      return { ...result.value, dataMode: "live" as const };
    }
    const fromCache = cachedById.get(id);
    if (fromCache && fromCache.value !== null) {
      return { ...fromCache, dataMode: "cached" as const };
    }
    return unavailableSignal(id);
  });

  const liveCount = signals.filter((signal) => signal.dataMode === "live").length;

  if (liveCount === 0) {
    if (cached) {
      return normalizePulse(
        { ...cached, summary: "Market data refresh failed. Showing latest cached data." },
        "cached",
      );
    }
    if (process.env.NODE_ENV !== "production") {
      return calculateDemandPulse(demoSignals(), "demo");
    }
    return unavailablePulse();
  }

  const pulse = calculateDemandPulse(signals, liveCount === signals.length ? "live" : "cached");
  await writeCache(pulse).catch(() => undefined);
  return pulse;
}

/**
 * Deterministic Campaign Signal built only from fetched numbers. This is the
 * fallback; the API route upgrades it with the LLM when a key is configured.
 */
export function buildCampaignSignal(pulse: DemandPulse): CampaignSignal {
  const riskLevel: CampaignSignal["riskLevel"] =
    pulse.score === null ? "medium" : pulse.score < 45 ? "high" : pulse.score < 65 ? "medium" : "low";

  const whatChangedThisWeek = pulse.signals
    .filter((signal) => signal.value !== null && signal.trend !== "unavailable")
    .map(
      (signal) =>
        `${signal.name}: ${signal.value}${signal.unit === "%" ? "%" : signal.unit === "index" ? "" : signal.unit ? ` ${signal.unit}` : ""}, ${signal.trendLabel.toLowerCase()}.`,
    );

  const negativeDrivers = pulse.drivers.filter((driver) => driver.impact === "negative");
  const positiveDrivers = pulse.drivers.filter((driver) => driver.impact === "positive");

  const whatItMeansForDtc = [
    pulse.score !== null
      ? `Demand conditions for discretionary DTC sit at ${pulse.score}/100 and are ${pulse.changeLabel.toLowerCase()}. For $1M to $50M brands, that decides how aggressive the next inventory buy should be.`
      : "No reliable demand read is available, so $1M to $50M brands should treat forecasts cautiously this week.",
    negativeDrivers.length
      ? `The pressure is coming from ${negativeDrivers.map((driver) => driver.label.split(":")[0]).join(" and ")}. That shows up for brands as slower sell-through, cash tied up in stock, and tighter margins.`
      : "No single signal is dragging demand down hard right now, which gives brands a cleaner planning window.",
    positiveDrivers.length
      ? `${positiveDrivers[0].label.split(":")[0]} is the main offset, but it does not cancel the need for careful reorder logic.`
      : "With no strong positive offset, reorder decisions deserve an extra demand check before cash is committed.",
  ];

  const campaignAngles =
    riskLevel === "high"
      ? [
          "Campaign on margin protection: cost per unit, landed cost, and what happens if demand comes in 15 percent softer than forecast.",
          "Campaign on inventory risk: the next PO is a cash decision, not just a stock decision.",
          "Campaign on survival math over growth promises: help founders protect cash first.",
        ]
      : riskLevel === "medium"
        ? [
            "Campaign on operating control: tighten reorder logic before the next PO while demand is mixed.",
            "Campaign on visibility: a clear view of inventory, supplier timing, and landed cost beats instinct in an uneven market.",
          ]
        : [
            "Campaign on clean growth: use the stronger demand window to fix supplier, inventory, and logistics systems before pressure returns.",
            "Campaign on launch readiness: demand strength rewards brands whose operating layer can keep up.",
          ];

  const sentiment = pulse.signals.find((signal) => signal.id === "UMCSENT");
  const ratio = pulse.signals.find((signal) => signal.id === "XLY_XLP");
  const tweets = [
    pulse.score !== null
      ? `Demand conditions for discretionary DTC sit at ${pulse.score}/100 right now and are ${pulse.changeLabel.toLowerCase()}. If your next PO assumes last quarter's sell-through, that is a cash decision, not a stock decision.`
      : "",
    sentiment?.value != null && sentiment.trend !== "unavailable"
      ? `US consumer sentiment is at ${sentiment.value} and ${sentiment.trend === "down" ? "falling" : sentiment.trend === "up" ? "rising" : "flat"}. ${sentiment.trend === "down" ? "Shoppers cut wants before needs. Inventory discipline beats growth bets in this window." : "Watch what shoppers do with that confidence before scaling the next buy."}`
      : "",
    ratio?.value != null && ratio.trend === "down"
      ? `Money is rotating from "want" brands into "need" brands (XLY/XLP at ${ratio.value}). If you sell wants, protect margin first: landed cost, reorder logic, supplier terms.`
      : "",
    riskLevel === "high"
      ? "Founders ask us what to post in a soft market. Same thing we tell them about ops: stop selling growth, sell survival. Cost per unit, inventory risk, margin protection."
      : "A clear view of inventory, supplier timing, and landed cost beats instinct in a mixed market. Most brands have the data. Few have the operating rhythm.",
  ].filter(Boolean);

  return {
    id: makeId("campaign"),
    createdAt: new Date().toISOString(),
    headline:
      riskLevel === "high"
        ? "Demand is tight, campaign around margin protection"
        : riskLevel === "medium"
          ? "Demand is mixed, campaign around operating control"
          : "Demand has room, campaign around cleaner growth",
    whatChangedThisWeek,
    whatItMeansForDtc,
    campaignAngles,
    tweets,
    riskLevel,
    confidenceNote:
      pulse.dataMode === "live"
        ? "Based on live public data fetched by the app."
        : pulse.dataMode === "cached"
          ? "Based on cached public data because at least one source did not refresh in this request."
          : pulse.dataMode === "demo"
            ? "Demo data is shown for local development only. Do not quote these numbers."
            : "Market data is unavailable, so this guidance is qualitative only.",
  };
}

function calculateDemandPulse(signals: MarketSignal[], dataMode: DemandPulse["dataMode"]): DemandPulse {
  const enrichedSignals = enrichSignals(signals);
  const weightedScores = enrichedSignals
    .filter((signal) => typeof signal.scoreContribution === "number")
    .map((signal) => ({
      score: signal.scoreContribution as number,
      weight: signal.forecastWeight ?? 1,
    }));
  const totalWeight = weightedScores.reduce((total, item) => total + item.weight, 0);
  const score = totalWeight
    ? Math.round(weightedScores.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight)
    : null;
  const downCount = enrichedSignals.filter((signal) => signal.trend === "down").length;
  const upCount = enrichedSignals.filter((signal) => signal.trend === "up").length;
  const trend = score === null ? "unavailable" : downCount > upCount ? "down" : upCount > downCount ? "up" : "flat";
  const status =
    score === null ? "unavailable" : score < 40 ? "risk_off" : score < 58 ? "cooling" : score < 72 ? "stable" : "heating";
  const drivers = buildDrivers(enrichedSignals);
  const history = buildDemandPulseHistory(enrichedSignals);
  const summary =
    score === null
      ? "Market data is unavailable."
      : `Demand conditions for discretionary DTC are at ${score}/100 and ${trend === "down" ? "falling" : trend === "up" ? "improving" : "steady"}. ${
          status === "risk_off" || status === "cooling"
            ? "Founders are in a caution window: talk about cash, inventory risk, and margin protection."
            : "Conditions have room: talk about cleaner growth and operational readiness."
        }`;

  return {
    score,
    status,
    trend,
    changeLabel: trend === "down" ? "Cooling" : trend === "up" ? "Improving" : trend === "flat" ? "Stable" : "Unavailable",
    summary,
    quickSummary: buildQuickSummary(score, status, trend, drivers),
    updatedAt: new Date().toISOString(),
    history,
    drivers,
    referenceSources: buildReferenceSources(enrichedSignals),
    dataMode,
    signals: enrichedSignals,
  };
}

function unavailablePulse(): DemandPulse {
  return {
    score: null,
    status: "unavailable",
    trend: "unavailable",
    changeLabel: "Data unavailable",
    summary: "No market data could be fetched and no cache exists yet. Try refreshing once connectivity is back.",
    quickSummary: "No market data is available yet, so Move should avoid demand-forecasting claims.",
    updatedAt: new Date().toISOString(),
    history: [],
    drivers: [],
    referenceSources: buildReferenceSources([]),
    dataMode: "unavailable",
    signals: signalIds.map((id) => unavailableSignal(id)),
  };
}

function unavailableSignal(id: string): MarketSignal {
  const metadata = getSignalMetadata(id);
  const series = fredSeries.find((item) => item.id === id);
  return {
    id,
    name: series?.name ?? "Discretionary vs Staples Ratio",
    value: null,
    unit: series?.unit ?? "ratio",
    trend: "unavailable",
    trendLabel: "Unavailable",
    updatedAt: new Date().toISOString(),
    source: metadata.source,
    sourceUrl: metadata.sourceUrl,
    forecastWeight: metadata.forecastWeight,
    history: [],
    plainEnglish: plainEnglishFor(id, "unavailable"),
    scoreContribution: null,
    dataMode: "unavailable",
  };
}

async function fetchFredSignal(series: (typeof fredSeries)[number]): Promise<MarketSignal> {
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series.id}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`FRED failed for ${series.id}`);
  const csv = await response.text();
  const history = parseFredCsv(csv).slice(-24);
  const latest = history.at(-1);
  const previous = history.at(-2);
  const value = latest?.value ?? null;
  const delta = latest && previous ? latest.value - previous.value : 0;
  const trend = !latest || !previous ? "unavailable" : Math.abs(delta) < 0.01 ? "flat" : delta > 0 ? "up" : "down";
  const directionalDelta = series.higherIsBetter ? delta : -delta;
  const scoreContribution =
    value === null ? null : clamp(Math.round(55 + directionalDelta * (series.id === "DSPIC96" ? 0.05 : 4)), 0, 100);

  return {
    id: series.id,
    name: series.name,
    value,
    unit: series.unit,
    trend,
    trendLabel: trend === "up" ? "Up from prior reading" : trend === "down" ? "Down from prior reading" : "Flat",
    updatedAt: latest?.date ?? new Date().toISOString(),
    source: series.source,
    sourceUrl: series.sourceUrl,
    forecastWeight: series.forecastWeight,
    history,
    plainEnglish: plainEnglishFor(series.id, trend),
    scoreContribution,
  };
}

async function fetchDiscretionaryStaplesRatio(): Promise<MarketSignal> {
  const [xly, xlp] = await Promise.all([fetchYahooMonthlyCloses("XLY"), fetchYahooMonthlyCloses("XLP")]);
  const history = xly
    .slice(-24)
    .map((point, index) => {
      const staples = xlp[xlp.length - Math.min(24, xly.length) + index];
      return staples ? { date: point.date, value: Number((point.value / staples.value).toFixed(3)) } : null;
    })
    .filter((point): point is { date: string; value: number } => Boolean(point));
  const latest = history.at(-1);
  const previous = history.at(-2);
  if (!latest) throw new Error("Yahoo Finance returned no usable XLY/XLP data");
  const delta = latest && previous ? latest.value - previous.value : 0;
  const trend = !previous ? "unavailable" : Math.abs(delta) < 0.001 ? "flat" : delta > 0 ? "up" : "down";

  return {
    id: RATIO_ID,
    name: "Discretionary vs Staples Ratio",
    value: latest.value,
    unit: "ratio",
    trend,
    trendLabel: trend === "up" ? "Risk-on tilt" : trend === "down" ? "Moving toward staples" : "Flat",
    updatedAt: latest.date,
    source: "Yahoo Finance, XLY and XLP monthly closes",
    sourceUrl: "https://finance.yahoo.com/quote/XLY/",
    forecastWeight: 1.15,
    history,
    plainEnglish: plainEnglishFor(RATIO_ID, trend),
    scoreContribution: clamp(Math.round(50 + delta * 500), 0, 100),
  };
}

async function fetchYahooMonthlyCloses(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2y&interval=1mo`,
    {
      headers: { "user-agent": "Mozilla/5.0 (compatible; MoveCAEngine/1.0)" },
      next: { revalidate: 3600 },
    },
  );
  if (!response.ok) throw new Error(`Yahoo Finance failed for ${symbol}`);
  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      value: closes[index] as number,
    }))
    .filter((point) => Number.isFinite(point.value));
}

function parseFredCsv(csv: string) {
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(",");
      return { date, value: Number(value) };
    })
    .filter((point) => Number.isFinite(point.value));
}

async function readCache(): Promise<DemandPulse | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    return JSON.parse(raw) as DemandPulse;
  } catch {
    return null;
  }
}

async function writeCache(pulse: DemandPulse) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(pulse, null, 2));
}

function demoSignals(): MarketSignal[] {
  const now = new Date().toISOString();
  return [
    signal("UMCSENT", "US Consumer Sentiment", 68.2, "down", 42),
    signal("DSPIC96", "Real Disposable Income", 17520, "flat", 54),
    signal("CPIENGSL", "Energy Costs", 286.1, "up", 38),
    signal("PSAVERT", "Personal Savings Rate", 4.0, "up", 44),
    signal("UNRATE", "Unemployment", 4.1, "flat", 58),
    signal(RATIO_ID, "Discretionary vs Staples Ratio", 2.74, "down", 39),
  ].map((item) => ({ ...item, updatedAt: now, dataMode: "demo" as const }));
}

function signal(
  id: string,
  name: string,
  value: number,
  trend: MarketSignal["trend"],
  scoreContribution: number,
): MarketSignal {
  const metadata = getSignalMetadata(id);
  return {
    id,
    name,
    value,
    trend,
    trendLabel: trend === "up" ? "Up from prior reading" : trend === "down" ? "Down from prior reading" : "Flat",
    source: metadata.source,
    sourceUrl: metadata.sourceUrl,
    forecastWeight: metadata.forecastWeight,
    plainEnglish: plainEnglishFor(id, trend),
    scoreContribution,
    updatedAt: new Date().toISOString(),
    history: Array.from({ length: 12 }, (_, index) => ({
      date: `2026-${String(index + 1).padStart(2, "0")}-01`,
      value: Number((value + (index - 6) * 0.7).toFixed(2)),
    })),
  };
}

function normalizePulse(pulse: DemandPulse, dataMode: DemandPulse["dataMode"]): DemandPulse {
  const signals = (pulse.signals ?? []).map((item) => ({
    ...item,
    dataMode: item.dataMode === "live" ? ("cached" as const) : item.dataMode,
    plainEnglish: plainEnglishFor(item.id, item.trend),
  }));
  const normalized = calculateDemandPulse(signals, dataMode);
  return {
    ...normalized,
    summary: pulse.summary || normalized.summary,
    updatedAt: pulse.updatedAt || normalized.updatedAt,
  };
}

function enrichSignals(signals: MarketSignal[]) {
  return signals.map((signal) => {
    const metadata = getSignalMetadata(signal.id);
    const source = signal.source ?? metadata.source;
    return {
      ...signal,
      source: source.toLowerCase().includes("demo") ? metadata.source : source,
      sourceUrl: signal.sourceUrl ?? metadata.sourceUrl,
      forecastWeight: signal.forecastWeight ?? metadata.forecastWeight,
    };
  });
}

function getSignalMetadata(id: string) {
  const fred = fredSeries.find((series) => series.id === id);
  if (fred) {
    return {
      source: fred.source,
      sourceUrl: fred.sourceUrl,
      forecastWeight: fred.forecastWeight,
      higherIsBetter: fred.higherIsBetter,
    };
  }

  return {
    source: "Yahoo Finance, XLY and XLP monthly closes",
    sourceUrl: "https://finance.yahoo.com/quote/XLY/",
    forecastWeight: 1.15,
    higherIsBetter: true,
  };
}

function buildDemandPulseHistory(signals: MarketSignal[]) {
  const normalizedHistories = signals
    .map((signal) => normalizeSignalHistory(signal))
    .filter((series) => series.length > 0);
  const maxLength = Math.max(0, ...normalizedHistories.map((series) => series.length));

  return Array.from({ length: maxLength }, (_, index) => {
    const points = normalizedHistories
      .map((series) => series[series.length - maxLength + index])
      .filter((point): point is { date: string; score: number; weight: number } => Boolean(point));
    const totalWeight = points.reduce((total, point) => total + point.weight, 0);
    const score = totalWeight
      ? Math.round(points.reduce((total, point) => total + point.score * point.weight, 0) / totalWeight)
      : 0;
    return {
      date: points.at(-1)?.date ?? `Point ${index + 1}`,
      score,
    };
  }).filter((point) => point.score > 0);
}

function normalizeSignalHistory(signal: MarketSignal) {
  if (!signal.history.length) return [];

  const values = signal.history.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const { higherIsBetter } = getSignalMetadata(signal.id);

  return signal.history.map((point) => {
    const percentile = (point.value - min) / range;
    const score = Math.round((higherIsBetter ? percentile : 1 - percentile) * 100);
    return {
      date: point.date,
      score: clamp(score, 0, 100),
      weight: signal.forecastWeight ?? 1,
    };
  });
}

function buildDrivers(signals: MarketSignal[]) {
  return signals
    .filter((signal) => typeof signal.scoreContribution === "number")
    .map((signal) => {
      const score = signal.scoreContribution as number;
      const impact: "positive" | "negative" | "neutral" = score >= 58 ? "positive" : score <= 45 ? "negative" : "neutral";
      return {
        signalId: signal.id,
        label: `${signal.name}: ${signal.value ?? "NA"}${signal.unit ? ` ${signal.unit}` : ""}`,
        impact,
        reason: `${signal.trendLabel}. ${signal.plainEnglish}`,
        strength: Math.abs(score - 50) * (signal.forecastWeight ?? 1),
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4)
    .map((driver) => ({
      signalId: driver.signalId,
      label: driver.label,
      impact: driver.impact,
      reason: driver.reason,
    }));
}

function buildQuickSummary(
  score: number | null,
  status: DemandPulse["status"],
  trend: DemandPulse["trend"],
  drivers: DemandPulse["drivers"],
) {
  if (score === null) {
    return "No reliable market read is available yet. Refresh data before using this for demand forecasting.";
  }

  const negativeDrivers = drivers.filter((driver) => driver.impact === "negative").slice(0, 2);
  const positiveDrivers = drivers.filter((driver) => driver.impact === "positive").slice(0, 1);
  const pressure = negativeDrivers.length
    ? negativeDrivers.map((driver) => driver.label.split(":")[0]).join(" and ")
    : "the current signal mix";
  const support = positiveDrivers.length ? ` ${positiveDrivers[0].label.split(":")[0]} is the main offset.` : "";

  return `Demand Pulse is ${score}/100, ${status.replace("_", " ")}, and ${trend === "down" ? "moving lower" : trend === "up" ? "improving" : "broadly stable"}. Forecast read: ${pressure} should shape near-term demand assumptions for discretionary DTC.${support}`;
}

function buildReferenceSources(signals: MarketSignal[]) {
  const publicSources = signals.map((signal) => ({
    label: signal.name,
    type: "public_data" as const,
    source: signal.source,
    url: signal.sourceUrl,
    updatedAt: signal.updatedAt,
  }));

  return [
    ...publicSources,
    {
      label: "Demand Pulse Rules",
      type: "move_reference" as const,
      source: "content/market-signals/demand-pulse-rules.md",
    },
    {
      label: "Campaign Signal Rules",
      type: "move_reference" as const,
      source: "content/market-signals/campaign-signal-rules.md",
    },
    {
      label: "Move Market Signals Playbook",
      type: "move_reference" as const,
      source: "content/playbooks/move-market-signals-rules.md",
    },
  ];
}
