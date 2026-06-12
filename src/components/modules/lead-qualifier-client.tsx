"use client";

import { CheckCircle2, Clipboard, Copy, Flag, Globe2, Search, Target, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/action-button-group";
import { CircularGauge } from "@/components/circular-gauge";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GenerationFooter, reportLlmActivity } from "@/components/llm-status";
import { LoadingState } from "@/components/loading-state";
import { StatusBadge } from "@/components/status-badge";
import { addActivity, useAppState } from "@/lib/client-storage";
import type { GenerationMeta, LeadQualificationResult, WebsiteFetchNotice } from "@/lib/types";

type LeadForm = {
  brandName: string;
  website: string;
  notes: string;
  websiteCopy: string;
  leadList: string;
};

const initialForm: LeadForm = {
  brandName: "",
  website: "",
  notes: "",
  websiteCopy: "",
  leadList: "",
};

function findUrl(form: LeadForm): string | null {
  const direct = form.website.trim();
  if (direct) return direct;
  const match = `${form.notes}\n${form.leadList}`.match(/https?:\/\/[^\s"'<>]+|(?:www\.)[a-z0-9-]+\.[a-z0-9.-]+\S*/i);
  return match?.[0] ?? null;
}

export function LeadQualifierClient() {
  const { state, update } = useAppState();
  const [form, setForm] = useState<LeadForm>(initialForm);
  const [result, setResult] = useState<LeadQualificationResult | null>(state.leads[0] ?? null);
  const [generation, setGeneration] = useState<GenerationMeta | null>(null);
  const [fetchNotice, setFetchNotice] = useState<WebsiteFetchNotice | null>(null);
  const [phase, setPhase] = useState<"idle" | "fetching" | "scoring">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFetchNotice(null);

    // Auto-fetch the website server-side when the input looks like a URL.
    // A failed fetch never blocks scoring; it just shows a notice.
    let fetchedWebsiteText = "";
    const url = findUrl(form);
    if (url) {
      setPhase("fetching");
      try {
        const response = await fetch("/api/fetch-website", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await response.json();
        if (data.ok) {
          fetchedWebsiteText = data.text;
          setFetchNotice({ attempted: true, ok: true, url: data.url, title: data.title, chars: data.text.length });
        } else {
          setFetchNotice({ attempted: true, ok: false, url, error: data.error });
        }
      } catch {
        setFetchNotice({ attempted: true, ok: false, url, error: "The site could not be reached." });
      }
    }

    setPhase("scoring");
    try {
      const response = await fetch("/api/lead-qualifier/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, fetchedWebsiteText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Lead qualification failed.");
      setResult(data.result);
      setGeneration(data.generation ?? null);
      reportLlmActivity(data.generation);
      update((current) =>
        addActivity(
          { ...current, leads: [data.result, ...current.leads.filter((lead) => lead.id !== data.result.id)] },
          "lead",
          `Qualified ${data.result.brandName}`,
          `${data.result.fitScore}/100 ${data.result.fitVerdict.replace("_", " ")}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lead qualification failed.");
    } finally {
      setPhase("idle");
    }
  }

  function updateField<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <section className="move-panel rounded-md p-5">
        <div className="mb-5">
          <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
            <Target className="h-6 w-6 text-green-ink" />
            Lead Qualifier
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Paste a brand, URL, lead list, or website copy. URLs are fetched live and scored against Move&apos;s ICP.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name">
              <input
                value={form.brandName}
                onChange={(event) => updateField("brandName", event.target.value)}
                className="move-input"
                placeholder="Example Brand Co"
              />
            </Field>
            <Field label="Website URL (fetched automatically)">
              <input
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
                className="move-input"
                placeholder="https://example.com"
              />
            </Field>
          </div>
          <Field label="Pasted notes">
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={6}
              className="move-input leading-6"
              placeholder="Paste lead notes, LinkedIn context, ecommerce signals, or research observations."
            />
          </Field>
          <Field label="Website copy or product page text (optional)">
            <textarea
              value={form.websiteCopy}
              onChange={(event) => updateField("websiteCopy", event.target.value)}
              rows={5}
              className="move-input leading-6"
              placeholder="Optional: paste homepage or product text. Used together with the live website fetch."
            />
          </Field>
          <Field label="Optional short lead list">
            <textarea
              value={form.leadList}
              onChange={(event) => updateField("leadList", event.target.value)}
              rows={3}
              className="move-input leading-6"
              placeholder="One brand per line for quick context. V1 scores the primary pasted brand."
            />
          </Field>
          {error ? <ErrorState message={error} /> : null}
          <ActionButtonGroup>
            <ActionButton type="submit" disabled={phase !== "idle"}>
              <Search className="h-4 w-4" />
              Analyze lead
            </ActionButton>
            <ActionButton type="button" variant="ghost" onClick={() => setForm(initialForm)}>
              Clear input
            </ActionButton>
            {phase === "fetching" ? <LoadingState label="Fetching the website" /> : null}
            {phase === "scoring" ? <LoadingState label="Scoring against Move ICP" /> : null}
          </ActionButtonGroup>
          <WebsiteFetchBanner notice={fetchNotice} />
        </form>
      </section>

      <section className="move-panel rounded-md p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-ink">Qualification Output</h2>
            <p className="mt-1 text-sm text-ink-muted">Clear input, scored output, next action.</p>
          </div>
          {result ? <StatusBadge kind={result.fitScore >= 75 ? "success" : result.fitScore >= 55 ? "warning" : "danger"}>{result.fitVerdict.replace("_", " ")}</StatusBadge> : null}
        </div>
        {result ? (
          <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
            <CircularGauge value={result.fitScore} label="Fit Score" sublabel={result.fitVerdict.replace("_", " ")} size={170} />
            <div className="space-y-5">
              <Panel title="Reasons behind score">
                <ul className="space-y-2 text-sm leading-6 text-ink-muted">
                  {result.scoreReasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-ink" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="ICP checks">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(result.icpChecks).map(([key, check]) => (
                    <div key={key} className="rounded-md border border-edge-soft bg-surface p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold capitalize text-ink">
                        {check.pass ? <CheckCircle2 className="h-4 w-4 text-green-ink" /> : <TriangleAlert className="h-4 w-4 text-warn" />}
                        {key.replace(/([A-Z])/g, " $1")}
                      </div>
                      <p className="text-xs leading-5 text-ink-muted">{check.reason}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Disqualifiers and pain signals">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-coral-ink">
                      <Flag className="h-4 w-4" />
                      Flags
                    </p>
                    <p className="text-sm leading-6 text-ink-muted">
                      {result.disqualifierFlags.length ? result.disqualifierFlags.join(", ") : "No hard disqualifier found in supplied context."}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-bold text-green-ink">Pain signals</p>
                    <p className="text-sm leading-6 text-ink-muted">{result.painSignals.join(" ")}</p>
                  </div>
                </div>
              </Panel>
              <Panel title="Personalization hook">
                <p className="text-sm leading-6 text-ink-muted">{result.personalizationHook}</p>
              </Panel>
              <Panel title="CRM-ready summary">
                <p className="text-sm leading-6 text-ink-muted">{result.crmSummary}</p>
                <ActionButton
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => navigator.clipboard.writeText(result.crmSummary)}
                >
                  <Copy className="h-4 w-4" />
                  Copy summary
                </ActionButton>
              </Panel>
              <Panel title="Recommended next action">
                <StatusBadge kind="info">
                  <Clipboard className="h-3.5 w-3.5" />
                  {result.recommendedNextAction.replace("_", " ")}
                </StatusBadge>
              </Panel>
              <GenerationFooter generation={generation} />
            </div>
          </div>
        ) : (
          <EmptyState title="No score yet" body="Run the analyzer to produce a fit score, reasons, ICP checks, disqualifiers, hook, and next action." />
        )}
      </section>
    </div>
  );
}

function WebsiteFetchBanner({ notice }: { notice: WebsiteFetchNotice | null }) {
  if (!notice?.attempted) return null;
  if (notice.ok) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-green/35 bg-green/10 px-3 py-2 text-xs font-semibold text-green-ink">
        <Globe2 className="h-3.5 w-3.5 shrink-0" />
        Fetched {notice.title ? `"${notice.title}"` : notice.url} ({notice.chars?.toLocaleString()} characters of site text used in the analysis).
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      Couldn&apos;t reach the site ({notice.error}). Scoring continued on pasted text only.
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-edge-soft bg-surface p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-[0.08em] text-ink-faint">{title}</h3>
      {children}
    </div>
  );
}
