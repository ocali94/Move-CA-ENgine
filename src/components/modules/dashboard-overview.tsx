"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  Clock3,
  Globe2,
  PackageCheck,
  PhoneCall,
  Target,
} from "lucide-react";
import { useEffect } from "react";
import { ActionButton } from "@/components/action-button-group";
import { CircularGauge } from "@/components/circular-gauge";
import { EmptyState } from "@/components/empty-state";
import { InsightRow } from "@/components/insight-row";
import { ProgressStepper } from "@/components/progress-stepper";
import { SourceChip } from "@/components/source-chip";
import { StatusBadge } from "@/components/status-badge";
import { addActivity, useAppState } from "@/lib/client-storage";
import { formatDateTime } from "@/lib/utils";
import type { CampaignSignal, DemandPulse } from "@/lib/types";

export function DashboardOverview() {
  const { state, update, loaded } = useAppState();
  const latestLead = state.leads[0];
  const latestBrief = state.callPrepBriefs[0];
  const latestProject = state.proposalProjects[0];
  const pulse = state.latestDemandPulse;

  useEffect(() => {
    if (!loaded || pulse) return;
    fetch("/api/market-signals/latest")
      .then((res) => res.json())
      .then((data: { pulse: DemandPulse; campaignSignal: CampaignSignal }) => {
        update((current) =>
          addActivity(
            { ...current, latestDemandPulse: data.pulse, latestCampaignSignal: data.campaignSignal },
            "market",
            "Market Signals refreshed",
            data.pulse.summary,
          ),
        );
      })
      .catch(() => undefined);
  }, [loaded, pulse, update]);

  const approvedSections = latestProject?.sections.filter((section) => section.status === "locked").length ?? 0;
  const activeSection = latestProject?.sections.find((section) => section.content && section.status !== "locked");

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.9fr_.9fr]">
        <div className="move-panel rounded-md p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black text-ink">Proposal Studio</h1>
              <p className="mt-1 text-sm text-ink-muted">Flagship workflow with approval gates and source context.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge kind="warning">Human approval required</StatusBadge>
              <StatusBadge kind="info">Proposal library referenced</StatusBadge>
            </div>
          </div>
          <ProgressStepper
            active={Math.min(approvedSections + 2, 6)}
            steps={[
              { label: "Upload Notes", status: latestProject?.rawDiscoveryText ? "done" : "active" },
              { label: "Extract Facts", status: latestProject?.extractedFacts ? "done" : "pending" },
              ...Array.from({ length: 5 }, (_, index) => ({
                label: index === 4 ? "Export" : `Section ${index + 1}`,
                status: (index < approvedSections ? "done" : index === approvedSections ? "active" : "pending") as
                  | "done"
                  | "active"
                  | "pending",
              })),
            ]}
          />
          <div className="mt-5 rounded-md border border-edge-soft bg-surface p-5">
            {latestProject ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-ink-muted">Current active proposal</p>
                    <h2 className="mt-1 text-xl font-black text-ink">{latestProject.clientName}</h2>
                  </div>
                  <StatusBadge kind={activeSection ? "warning" : approvedSections === 7 ? "success" : "neutral"}>
                    {activeSection ? "Draft waiting" : approvedSections === 7 ? "Ready to export" : "In progress"}
                  </StatusBadge>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-ink-muted">
                  {activeSection?.content.slice(0, 390) ||
                    latestProject.extractedFacts?.servicePathRationale ||
                    "Extract discovery facts, then generate Section 1 to begin the approval workflow."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <SourceChip>Local playbooks and selected references</SourceChip>
                  <Link href="/dashboard/proposal-studio">
                    <ActionButton>
                      Open Proposal Studio
                      <ArrowRight className="h-4 w-4" />
                    </ActionButton>
                  </Link>
                </div>
              </>
            ) : (
              <EmptyState
                title="No active proposal yet"
                body="Start Proposal Studio to paste discovery notes, extract facts, and draft Section 1."
              />
            )}
          </div>
        </div>
        <div className="move-panel rounded-md p-5">
          <h2 className="text-lg font-black text-ink">Extracted Discovery Insights</h2>
          {latestProject?.extractedFacts ? (
            <div className="mt-4">
              <InsightRow icon={BadgeDollarSign} label="Revenue Range" value={latestProject.extractedFacts.revenue ?? "TBD"} />
              <InsightRow icon={PackageCheck} label="SKU Count" value={latestProject.extractedFacts.skuCount ?? "TBD"} />
              <InsightRow
                icon={Clock3}
                label="Timeline"
                value={latestProject.extractedFacts.urgencySignals.slice(0, 3).join(", ") || "Verify"}
              />
              <InsightRow
                icon={Globe2}
                label="Regions"
                value={latestProject.extractedFacts.productionRegions.join(", ") || "Verify"}
              />
              <InsightRow
                icon={BarChart3}
                label="Budget Signals"
                value={latestProject.extractedFacts.budgetSignals.join(", ") || "TBD"}
              />
              <Link href="/dashboard/proposal-studio">
                <ActionButton variant="secondary" className="mt-4 w-full">View full discovery extract</ActionButton>
              </Link>
            </div>
          ) : (
            <EmptyState title="No extracted facts" body="Paste discovery notes in Proposal Studio to populate this card." />
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="move-panel rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink">
              <Target className="h-5 w-5 text-green-ink" />
              Lead Qualifier
            </h2>
            <Link href="/dashboard/lead-qualifier" className="text-sm font-semibold text-green-ink">View details</Link>
          </div>
          {latestLead ? (
            <div className="grid gap-4 md:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
              <CircularGauge value={latestLead.fitScore} label="Fit Score" sublabel={latestLead.fitVerdict.replace("_", " ")} />
              <div className="space-y-3">
                {Object.entries(latestLead.icpChecks).slice(0, 4).map(([key, check]) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={check.pass ? "mt-0.5 h-4 w-4 text-green-ink" : "mt-0.5 h-4 w-4 text-warn"} />
                    <span className="text-ink-muted">{key.replace(/([A-Z])/g, " $1")}</span>
                  </div>
                ))}
                <div className="rounded-md border border-coral/25 bg-coral/10 p-3 text-sm text-ink-muted">
                  <strong className="text-coral-ink">Hook:</strong> {latestLead.personalizationHook}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No lead scored" body="Paste a brand or URL to generate a scored verdict and CRM summary." />
          )}
        </div>

        <div className="move-panel rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink">
              <PhoneCall className="h-5 w-5 text-green-ink" />
              Call Prep Engine
            </h2>
            <Link href="/dashboard/call-prep" className="text-sm font-semibold text-green-ink">View details</Link>
          </div>
          {latestBrief ? (
            <div className="space-y-4">
              <StatusBadge kind="info">Battle card ready</StatusBadge>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {latestBrief.painMap.slice(0, 4).map((pain) => (
                  <div key={pain.category} className="rounded-md border border-edge-soft bg-surface p-3">
                    <p className="font-bold text-ink">{pain.severity}</p>
                    <p className="mt-1 text-ink-muted">{pain.category.replace("_", " ")}</p>
                  </div>
                ))}
              </div>
              <ol className="space-y-2 text-sm text-ink-muted">
                {latestBrief.diagnosticQuestions.slice(0, 3).map((question) => (
                  <li key={question.order}>{question.order}. {question.question}</li>
                ))}
              </ol>
            </div>
          ) : (
            <EmptyState title="No battle card" body="Paste intake answers to generate a one-page discovery brief." />
          )}
        </div>

        <div className="move-panel rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink">
              <BarChart3 className="h-5 w-5 text-warn" />
              Market Signals
            </h2>
            <Link href="/dashboard/market-signals" className="text-sm font-semibold text-green-ink">View details</Link>
          </div>
          {pulse ? (
            <div className="grid gap-4 md:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
              <CircularGauge value={pulse.score} label="Demand Pulse" sublabel={pulse.changeLabel} />
              <div className="space-y-3">
                <p className="text-sm leading-6 text-ink-muted">{pulse.summary}</p>
                {pulse.signals.slice(0, 2).map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between gap-3 border-t border-edge-soft pt-3 text-sm">
                    <span className="text-ink-muted">{signal.name}</span>
                    <span className={signal.trend === "down" ? "text-coral-ink" : "text-green-ink"}>
                      {signal.value ?? "NA"}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-ink-faint">Updated {formatDateTime(pulse.updatedAt)}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Loading market pulse" body="The app will use live public data, cached data, or a clearly labeled local demo." />
          )}
        </div>
      </section>
    </div>
  );
}
