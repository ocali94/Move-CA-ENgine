"use client";

import { ClipboardCopy, Globe2, HelpCircle, PhoneCall, ShieldCheck, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/action-button-group";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GenerationFooter, reportLlmActivity } from "@/components/llm-status";
import { LoadingState } from "@/components/loading-state";
import { StatusBadge } from "@/components/status-badge";
import { addActivity, useAppState } from "@/lib/client-storage";
import type { CallPrepBrief, GenerationMeta, WebsiteFetchNotice } from "@/lib/types";

type CallForm = {
  companyName: string;
  website: string;
  intake: string;
  revenue: string;
  skuCount: string;
  annualPoValue: string;
  sellingPlatforms: string;
  warehouseSetup: string;
  foundUs: string;
  notes: string;
};

const initialForm: CallForm = {
  companyName: "",
  website: "",
  intake: "",
  revenue: "",
  skuCount: "",
  annualPoValue: "",
  sellingPlatforms: "",
  warehouseSetup: "",
  foundUs: "",
  notes: "",
};

/**
 * The intake form usually contains the brand's website. Use the explicit
 * field first, then look for a URL inside the pasted intake answers.
 */
function findWebsite(form: CallForm): string | null {
  const direct = form.website.trim();
  if (direct) return direct;
  const match = `${form.intake}\n${form.notes}`.match(/https?:\/\/[^\s"'<>]+|(?:www\.)[a-z0-9-]+\.[a-z0-9.-]+\S*/i);
  return match?.[0] ?? null;
}

export function CallPrepClient() {
  const { state, update } = useAppState();
  const [form, setForm] = useState<CallForm>(initialForm);
  const [brief, setBrief] = useState<CallPrepBrief | null>(state.callPrepBriefs[0] ?? null);
  const [generation, setGeneration] = useState<GenerationMeta | null>(null);
  const [fetchNotice, setFetchNotice] = useState<WebsiteFetchNotice | null>(null);
  const [phase, setPhase] = useState<"idle" | "fetching" | "building">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFetchNotice(null);

    let fetchedWebsiteText = "";
    const url = findWebsite(form);
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

    setPhase("building");
    try {
      const response = await fetch("/api/call-prep/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, fetchedWebsiteText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Call prep failed.");
      setBrief(data.brief);
      setGeneration(data.generation ?? null);
      reportLlmActivity(data.generation);
      update((current) =>
        addActivity(
          { ...current, callPrepBriefs: [data.brief, ...current.callPrepBriefs.filter((item) => item.id !== data.brief.id)] },
          "call",
          `Built battle card for ${data.brief.companyName}`,
          data.brief.probableServicePath,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call prep failed.");
    } finally {
      setPhase("idle");
    }
  }

  function updateField<K extends keyof CallForm>(key: K, value: CallForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <section className="move-panel rounded-md p-5">
        <div className="mb-5">
          <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
            <PhoneCall className="h-6 w-6 text-green-ink" />
            Call Prep Engine
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Paste booking form answers and context. The website found in the intake is scanned live and combined into a one-page battle card.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Company name" value={form.companyName} onChange={(value) => updateField("companyName", value)} placeholder="Example Brand Co" />
            <Input label="Website" value={form.website} onChange={(value) => updateField("website", value)} placeholder="https://example.com" />
            <Input label="Revenue" value={form.revenue} onChange={(value) => updateField("revenue", value)} placeholder="$10M to $25M" />
            <Input label="SKU count" value={form.skuCount} onChange={(value) => updateField("skuCount", value)} placeholder="150 to 300 SKUs" />
            <Input label="Annual PO value" value={form.annualPoValue} onChange={(value) => updateField("annualPoValue", value)} placeholder="$2M" />
            <Input label="Selling platforms" value={form.sellingPlatforms} onChange={(value) => updateField("sellingPlatforms", value)} placeholder="Shopify, Amazon, wholesale" />
          </div>
          <Input label="Warehouse or 3PL setup" value={form.warehouseSetup} onChange={(value) => updateField("warehouseSetup", value)} placeholder="US 3PL, internal warehouse, split fulfillment" />
          <Input label="How they found Move" value={form.foundUs} onChange={(value) => updateField("foundUs", value)} placeholder="Referral, website, partner, outbound" />
          <TextArea label="Booking form or intake answers" value={form.intake} onChange={(value) => updateField("intake", value)} rows={7} />
          <TextArea label="Free-form notes or website context" value={form.notes} onChange={(value) => updateField("notes", value)} rows={4} />
          {error ? <ErrorState message={error} /> : null}
          <ActionButtonGroup>
            <ActionButton type="submit" disabled={phase !== "idle"}>
              Generate battle card
            </ActionButton>
            <ActionButton type="button" variant="ghost" onClick={() => setForm(initialForm)}>
              Clear input
            </ActionButton>
            {phase === "fetching" ? <LoadingState label="Scanning the brand website" /> : null}
            {phase === "building" ? <LoadingState label="Building call prep" /> : null}
          </ActionButtonGroup>
          <WebsiteFetchBanner notice={fetchNotice} />
        </form>
      </section>

      <section className="move-panel rounded-md p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink">Battle Card</h2>
            <p className="mt-1 text-sm text-ink-muted">Snapshot, pain map, diagnostic sequence, service path, next call angle.</p>
          </div>
          {brief ? <StatusBadge kind="success">Battle card ready</StatusBadge> : null}
        </div>
        {brief ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Brand snapshot">
                <dl className="grid gap-3 text-sm">
                  <Row label="Company" value={brief.brandSnapshot.companyName} />
                  <Row label="Category" value={brief.brandSnapshot.category ?? "Verify"} />
                  <Row label="Products" value={brief.brandSnapshot.products.join(", ") || "Verify"} />
                  <Row label="Channels" value={brief.brandSnapshot.channels.join(", ") || "Verify"} />
                  <Row label="Complexity" value={brief.brandSnapshot.operationalComplexity} />
                  <Row label="Regions" value={brief.brandSnapshot.likelyProductionRegions.join(", ") || "Verify"} />
                </dl>
              </Panel>
              <Panel title="Recommended service path">
                <div className="space-y-3">
                  <StatusBadge kind="info">{brief.probableServicePath}</StatusBadge>
                  <p className="text-sm leading-6 text-ink-muted">{brief.suggestedCallAngle}</p>
                  <p className="text-xs text-ink-faint">Confidence: {brief.servicePathConfidence}/100</p>
                </div>
              </Panel>
            </div>

            <Panel title="Likely pain map">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {brief.painMap.map((pain) => (
                  <div key={pain.category} className="rounded-md border border-edge-soft bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold capitalize text-ink">{pain.category.replace("_", " ")}</p>
                      <StatusBadge kind={pain.severity === "high" ? "danger" : pain.severity === "medium" ? "warning" : "success"} className="min-h-6 px-2 py-0.5">
                        {pain.severity}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-muted">{pain.reason}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Diagnostic questions">
              <ol className="grid gap-3 lg:grid-cols-2">
                {brief.diagnosticQuestions.map((question) => (
                  <li key={question.order} className="rounded-md border border-edge-soft bg-surface p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green/15 text-sm font-bold text-green-ink">
                        {question.order}
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-6 text-ink">{question.question}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-faint">{question.whyAsk}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Things to verify">
                <List icon={<ShieldCheck className="h-4 w-4 text-green-ink" />} items={brief.thingsToVerify} />
              </Panel>
              <Panel title="Things to avoid">
                <List icon={<HelpCircle className="h-4 w-4 text-warn" />} items={brief.thingsToAvoid} />
              </Panel>
            </div>

            <Panel title="Copy-ready summary">
              <p className="text-sm leading-6 text-ink-muted">{brief.copyReadySummary}</p>
              <ActionButton
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => navigator.clipboard.writeText(brief.copyReadySummary)}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy summary
              </ActionButton>
            </Panel>
            <GenerationFooter generation={generation} />
          </div>
        ) : (
          <EmptyState title="No battle card yet" body="Paste intake answers to generate a call prep brief in 60 seconds." />
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
        Scanned {notice.title ? `"${notice.title}"` : notice.url} ({notice.chars?.toLocaleString()} characters of site text combined with the intake).
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      Couldn&apos;t reach the site ({notice.error}). The battle card uses pasted text only.
    </p>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="move-input"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="move-input leading-6"
      />
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-edge-soft pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="max-w-64 text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function List({ items, icon }: { items: string[]; icon: React.ReactNode }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-ink-muted">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1">{icon}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}
