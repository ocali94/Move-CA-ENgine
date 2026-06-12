"use client";

import {
  Check,
  CheckCircle2,
  Download,
  FileUp,
  Lock,
  MessageSquareText,
  Pencil,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
  Unlock,
  Wand2,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/action-button-group";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GenerationFooter, reportLlmActivity } from "@/components/llm-status";
import { LoadingState } from "@/components/loading-state";
import { ProgressStepper } from "@/components/progress-stepper";
import { SourceChip } from "@/components/source-chip";
import { StatusBadge } from "@/components/status-badge";
import { addActivity, downloadText, useAppState } from "@/lib/client-storage";
import { checkConsistency, validateCompanionEmail, validateSection } from "@/lib/proposal-rules";
import type {
  CompanionEmail,
  DiscoveryExtraction,
  GenerationMeta,
  ProposalProject,
  ProposalSection,
  ValidationIssue,
} from "@/lib/types";
import { makeId } from "@/lib/utils";
import { createProposalProject } from "@/lib/workflows/proposal";

const sampleDiscovery = `Company: Example Brand Co
Website: https://example.com
Contact: Founder
Revenue: $10M to $25M
SKU count: 150 to 300 SKUs
Channels: Shopify, Amazon, retail
Warehouse: US 3PL with limited inventory visibility
Notes: They are launching new products quickly, but supplier lead times, MOQs, demand planning, and freight cost are creating friction. The founder is still involved in supply chain decisions and wants a clearer operating rhythm before the next purchase order.`;

export function ProposalStudioClient() {
  const { state, update } = useAppState();
  const [project, setProject] = useState<ProposalProject>(
    () => state.proposalProjects[0] ?? createProposalProject({ clientName: "Example Brand Co", rawDiscoveryText: sampleDiscovery }),
  );
  const [factsJson, setFactsJson] = useState("");
  const [chatInstruction, setChatInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [extractGeneration, setExtractGeneration] = useState<GenerationMeta | null>(null);
  const [sectionGeneration, setSectionGeneration] = useState<GenerationMeta | null>(null);
  const [emailGeneration, setEmailGeneration] = useState<GenerationMeta | null>(null);
  const [emailIssues, setEmailIssues] = useState<ValidationIssue[]>([]);

  const activeSection = useMemo(() => {
    return project.sections.find((section) => section.status !== "locked") ?? project.sections.at(-1);
  }, [project.sections]);
  const activeIndex = activeSection ? activeSection.number - 1 : 0;
  const previousApproved = project.sections.filter(
    (section) => section.number < (activeSection?.number ?? 1) && section.status === "locked",
  );
  const previousLocked = previousApproved.length === Math.max(0, activeIndex);
  const approvedCount = project.sections.filter((section) => section.status === "locked").length;

  // Cross-section pricing/duration consistency, recomputed on every change.
  const consistencyIssues = useMemo(() => checkConsistency(project.sections), [project.sections]);

  function saveProject(next: ProposalProject, title = "Proposal project saved", detail = next.clientName) {
    setProject(next);
    update((current) =>
      addActivity(
        {
          ...current,
          proposalProjects: [next, ...current.proposalProjects.filter((item) => item.id !== next.id)],
        },
        "proposal",
        title,
        detail,
      ),
    );
  }

  function updateProject<K extends keyof ProposalProject>(key: K, value: ProposalProject[K]) {
    setProject((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }

  async function extractFacts() {
    setLoading("extract");
    setError(null);
    try {
      const response = await fetch("/api/proposal/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: project.rawDiscoveryText, project }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Fact extraction failed.");
      const next = {
        ...project,
        clientName: data.facts.companyName || project.clientName,
        extractedFacts: data.facts as DiscoveryExtraction,
        updatedAt: new Date().toISOString(),
      };
      setFactsJson(JSON.stringify(data.facts, null, 2));
      setExtractGeneration(data.generation ?? null);
      reportLlmActivity(data.generation);
      saveProject(next, "Extracted discovery facts", next.clientName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fact extraction failed.");
    } finally {
      setLoading(null);
    }
  }

  function applyFactEdits() {
    try {
      const facts = JSON.parse(factsJson) as DiscoveryExtraction;
      saveProject({ ...project, extractedFacts: facts, updatedAt: new Date().toISOString() }, "Edited extracted facts", project.clientName);
    } catch {
      setError("Fact JSON is invalid. Fix the JSON before applying edits.");
    }
  }

  async function generateSection(section: ProposalSection) {
    if (!project.extractedFacts) {
      setError("Extract discovery facts before generating proposal sections.");
      return;
    }
    if (section.number > 1 && !previousLocked) {
      setError(`Section ${section.number} is locked until Section ${section.number - 1} is approved.`);
      return;
    }

    setLoading(`generate-${section.id}`);
    setError(null);
    try {
      const response = await fetch("/api/proposal/generate-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sectionNumber: section.number,
          facts: project.extractedFacts,
          previousSections: previousApproved,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Section generation failed.");
      setSectionGeneration(data.generation ?? null);
      reportLlmActivity(data.generation);
      const sections = project.sections.map((item) =>
        item.id === section.id
          ? {
              ...item,
              content: data.section.content,
              sourceChunkIds: data.section.sourceChunkIds,
              status: "drafted" as const,
              validation: data.validation,
              revisionHistory: [
                ...item.revisionHistory,
                { id: makeId("rev"), createdAt: new Date().toISOString(), content: data.section.content },
              ],
            }
          : item,
      );
      saveProject({ ...project, sections, updatedAt: new Date().toISOString() }, `Generated Section ${section.number}`, section.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section generation failed.");
    } finally {
      setLoading(null);
    }
  }

  async function reviseActiveSection(event: FormEvent) {
    event.preventDefault();
    if (!activeSection?.content) {
      setError("Generate the active section before revising it.");
      return;
    }
    setLoading("revise");
    setError(null);
    try {
      const response = await fetch("/api/proposal/revise-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentContent: activeSection.content,
          instruction: chatInstruction,
          sectionNumber: activeSection.number,
          facts: project.extractedFacts,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Revision failed.");
      setSectionGeneration(data.generation ?? null);
      reportLlmActivity(data.generation);
      const sections = project.sections.map((item) =>
        item.id === activeSection.id
          ? {
              ...item,
              content: data.content,
              status: "needs_revision" as const,
              validation: data.validation ?? item.validation,
              revisionHistory: [
                ...item.revisionHistory,
                {
                  id: makeId("rev"),
                  createdAt: new Date().toISOString(),
                  instruction: chatInstruction,
                  content: data.content,
                },
              ],
            }
          : item,
      );
      saveProject(
        {
          ...project,
          sections,
          chatMessages: [
            ...project.chatMessages,
            { id: makeId("chat"), role: "user", createdAt: new Date().toISOString(), content: chatInstruction, sectionId: activeSection.id },
            { id: makeId("chat"), role: "assistant", createdAt: new Date().toISOString(), content: "Revised active section.", sectionId: activeSection.id },
          ],
          updatedAt: new Date().toISOString(),
        },
        `Revised Section ${activeSection.number}`,
        chatInstruction,
      );
      setChatInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision failed.");
    } finally {
      setLoading(null);
    }
  }

  function approveSection(section: ProposalSection) {
    if (!section.content.trim()) {
      setError("Generate section content before approval.");
      return;
    }
    const sections = project.sections.map((item) =>
      item.id === section.id
        ? { ...item, status: "locked" as const, approvedAt: new Date().toISOString() }
        : item,
    );
    saveProject({ ...project, sections, updatedAt: new Date().toISOString() }, `Approved Section ${section.number}`, section.title);
  }

  function unlockSection(section: ProposalSection) {
    const sections = project.sections.map((item) => {
      if (item.id === section.id) return { ...item, status: "drafted" as const, approvedAt: undefined };
      if (item.number > section.number && item.status === "locked") return { ...item, reviewRecommended: true };
      return item;
    });
    saveProject({ ...project, sections, updatedAt: new Date().toISOString() }, `Unlocked Section ${section.number}`, "Later sections may need review.");
  }

  async function exportProposal(format: "markdown" | "html") {
    setLoading(`export-${format}`);
    try {
      const response = await fetch("/api/proposal/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, format }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Export failed.");
      downloadText(
        `${project.clientName.replace(/\W+/g, "-").toLowerCase()}-proposal.${format === "html" ? "html" : "md"}`,
        data.content,
        format === "html" ? "text/html" : "text/markdown",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoading(null);
    }
  }

  async function draftEmail() {
    setLoading("email");
    setError(null);
    try {
      const response = await fetch("/api/proposal/draft-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Email draft failed.");
      setEmailGeneration(data.generation ?? null);
      setEmailIssues(data.validation ?? []);
      reportLlmActivity(data.generation);
      saveProject({ ...project, companionEmail: data.email as CompanionEmail, updatedAt: new Date().toISOString() }, "Drafted proposal email", project.clientName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email draft failed.");
    } finally {
      setLoading(null);
    }
  }

  function importReferenceFromText() {
    const title = window.prompt("Reference title");
    if (!title) return;
    const text = window.prompt("Paste reference text");
    if (!text) return;
    fetch("/api/references/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, text, category: "proposal_precedent" }),
    })
      .then((res) => res.json())
      .then((data) => {
        const next = { ...project, references: [data.reference, ...project.references], updatedAt: new Date().toISOString() };
        saveProject(next, "Imported project reference", title);
      })
      .catch(() => setError("Reference import failed."));
  }

  const steps = [
    { label: "Upload Notes", status: project.rawDiscoveryText ? "done" : "active" },
    { label: "Extract Facts", status: project.extractedFacts ? "done" : project.rawDiscoveryText ? "active" : "pending" },
    ...project.sections.map((section) => ({
      label: `S${section.number}`,
      status: (section.status === "locked" ? "done" : section.id === activeSection?.id ? "active" : "pending") as
        | "done"
        | "active"
        | "pending",
    })),
    { label: "Export", status: approvedCount === 7 ? "active" : "pending" },
  ] as const;

  return (
    <div className="space-y-5">
      <section className="move-panel rounded-md p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
              <Wand2 className="h-6 w-6 text-green-ink" />
              Proposal Studio
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Build the proposal section by section. Every approved section locks before the next one moves forward, and every draft is checked against the Move proposal rules.
            </p>
          </div>
          <ActionButtonGroup>
            <ActionButton type="button" variant="secondary" onClick={importReferenceFromText}>
              <FileUp className="h-4 w-4" />
              Paste a reference
            </ActionButton>
            <ActionButton type="button" variant="ghost" onClick={() => saveProject(createProposalProject({ clientName: "New client" }), "Created new proposal project", "Blank project")}>
              New project
            </ActionButton>
          </ActionButtonGroup>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Field label="Client name" value={project.clientName} onChange={(value) => updateProject("clientName", value)} />
          <Field label="Website" value={project.website ?? ""} onChange={(value) => updateProject("website", value)} />
          <Field label="Contact" value={project.contactName ?? ""} onChange={(value) => updateProject("contactName", value)} />
          <Field label="Revenue range" value={project.revenueRange ?? ""} onChange={(value) => updateProject("revenueRange", value)} />
        </div>
      </section>

      <section className="move-panel rounded-md p-5">
        <ProgressStepper steps={steps} />
      </section>

      {error ? <ErrorState message={error} /> : null}
      {consistencyIssues.length ? (
        <div className="space-y-2">
          {consistencyIssues.map((issue) => (
            <p
              key={issue.message}
              className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm font-semibold text-warn"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[19rem_1fr_23rem]">
        <aside className="move-panel rounded-md p-4">
          <h2 className="mb-4 text-lg font-black text-ink">Workflow</h2>
          <div className="space-y-2">
            {project.sections.map((section) => (
              <div
                key={section.id}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm ${
                  section.id === activeSection?.id
                    ? "border-green/35 bg-green/12 text-ink"
                    : "border-edge-soft bg-surface text-ink-muted"
                }`}
              >
                <span>
                  {section.number}. {section.title}
                </span>
                <span className="flex items-center gap-1.5">
                  {section.validation && !section.validation.passed ? (
                    <TriangleAlert className="h-4 w-4 text-warn" />
                  ) : null}
                  {section.status === "locked" ? <Lock className="h-4 w-4 text-green-ink" /> : null}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-edge-soft bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">References</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.references.length ? project.references.map((ref) => <SourceChip key={ref.id}>{ref.title}</SourceChip>) : <SourceChip>Local playbooks (content/)</SourceChip>}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="move-panel rounded-md p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-ink">Discovery Notes</h2>
                <p className="text-sm text-ink-muted">Current discovery notes outrank all other references.</p>
              </div>
              <ActionButtonGroup>
                <ActionButton type="button" onClick={extractFacts} disabled={!project.rawDiscoveryText || loading === "extract"}>
                  <Sparkles className="h-4 w-4" />
                  Extract discovery facts
                </ActionButton>
                {loading === "extract" ? <LoadingState label="Extracting facts" /> : null}
              </ActionButtonGroup>
            </div>
            <textarea
              value={project.rawDiscoveryText ?? ""}
              onChange={(event) => updateProject("rawDiscoveryText", event.target.value)}
              rows={9}
              className="move-input leading-6"
              placeholder="Paste transcript, notes, or intake answers."
            />
          </section>

          {project.extractedFacts ? (
            <section className="move-panel rounded-md p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">Extracted Facts</h2>
                  <p className="text-sm text-ink-muted">Review and edit before generation. These facts are the source of truth.</p>
                </div>
                <ActionButton type="button" variant="secondary" onClick={applyFactEdits}>
                  <Pencil className="h-4 w-4" />
                  Apply fact edits
                </ActionButton>
              </div>
              <textarea
                value={factsJson || JSON.stringify(project.extractedFacts, null, 2)}
                onChange={(event) => setFactsJson(event.target.value)}
                rows={12}
                className="move-scrollbar move-input font-mono text-xs leading-5"
              />
              <GenerationFooter generation={extractGeneration} />
            </section>
          ) : null}

          <section className="move-panel rounded-md p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-black text-ink">
                  Section {activeSection?.number}: {activeSection?.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge kind={activeSection?.status === "locked" ? "success" : activeSection?.status === "drafted" ? "warning" : "neutral"}>
                    {activeSection?.status.replace("_", " ") ?? "not started"}
                  </StatusBadge>
                  {activeSection?.reviewRecommended ? <StatusBadge kind="warning">Review recommended</StatusBadge> : null}
                </div>
              </div>
              {activeSection ? (
                <ActionButtonGroup>
                  <ActionButton type="button" onClick={() => generateSection(activeSection)} disabled={activeSection.status === "locked" || loading === `generate-${activeSection.id}`}>
                    <RefreshCcw className="h-4 w-4" />
                    {activeSection.content ? "Regenerate" : "Generate current section"}
                  </ActionButton>
                  <ActionButton type="button" variant="secondary" onClick={() => approveSection(activeSection)} disabled={activeSection.status === "locked" || !activeSection.content}>
                    <Check className="h-4 w-4" />
                    Approve section
                  </ActionButton>
                  {activeSection.status === "locked" ? (
                    <ActionButton type="button" variant="danger" onClick={() => unlockSection(activeSection)}>
                      <Unlock className="h-4 w-4" />
                      Unlock
                    </ActionButton>
                  ) : null}
                </ActionButtonGroup>
              ) : null}
            </div>
            {loading?.startsWith("generate") ? <LoadingState label="Drafting active section" /> : null}
            {activeSection?.content ? (
              <>
                <textarea
                  value={activeSection.content}
                  onChange={(event) => {
                    const content = event.target.value;
                    const sections = project.sections.map((section) =>
                      section.id === activeSection.id
                        ? {
                            ...section,
                            content,
                            status: "needs_revision" as const,
                            validation: validateSection(activeSection.number, content, project.extractedFacts ?? null),
                          }
                        : section,
                    );
                    setProject({ ...project, sections, updatedAt: new Date().toISOString() });
                  }}
                  rows={18}
                  className="move-scrollbar move-input mt-4 leading-6"
                />
                <RuleChecklist section={activeSection} />
                <GenerationFooter generation={sectionGeneration} />
              </>
            ) : (
              <EmptyState title="Section not generated" body="Extract facts, then generate the active section. Approval unlocks the next section." />
            )}
          </section>
        </main>

        <aside className="space-y-5">
          <section className="move-panel rounded-md p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-ink">
              <MessageSquareText className="h-5 w-5 text-green-ink" />
              Section Revision Chat
            </h2>
            <form onSubmit={reviseActiveSection} className="space-y-3">
              <textarea
                value={chatInstruction}
                onChange={(event) => setChatInstruction(event.target.value)}
                rows={7}
                className="move-input leading-6"
                placeholder="Make this warmer, add more inventory detail, remove pricing, make it sound more like Omar..."
              />
              <ActionButton type="submit" variant="secondary" disabled={!chatInstruction || loading === "revise"}>
                Revise active section
              </ActionButton>
              {loading === "revise" ? <LoadingState label="Revising section" /> : null}
            </form>
            <div className="mt-4 space-y-2">
              {project.chatMessages.slice(-4).map((message) => (
                <div key={message.id} className="rounded-md border border-edge-soft bg-surface p-3 text-xs leading-5 text-ink-muted">
                  <strong className="text-ink">{message.role}:</strong> {message.content}
                </div>
              ))}
            </div>
          </section>

          <section className="move-panel rounded-md p-5">
            <h2 className="mb-3 text-lg font-black text-ink">Export</h2>
            <p className="mb-4 text-sm leading-6 text-ink-muted">Export is available any time, but final sending should wait until all sections are approved.</p>
            <ActionButtonGroup>
              <ActionButton type="button" variant="secondary" onClick={() => exportProposal("markdown")}>
                <Download className="h-4 w-4" />
                Markdown
              </ActionButton>
              <ActionButton type="button" variant="secondary" onClick={() => exportProposal("html")}>
                <Download className="h-4 w-4" />
                HTML
              </ActionButton>
              <ActionButton type="button" onClick={draftEmail} disabled={loading === "email"}>
                Draft email
              </ActionButton>
            </ActionButtonGroup>
            {project.companionEmail ? (
              <div className="mt-4 rounded-md border border-edge-soft bg-surface p-3 text-sm leading-6 text-ink-muted">
                <p className="font-bold text-ink">Subject: {project.companionEmail.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{project.companionEmail.body}</pre>
                <EmailChecklist issues={emailIssues.length ? emailIssues : validateCompanionEmail(project.companionEmail)} />
                <GenerationFooter generation={emailGeneration} />
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Per-section rule checklist from the proposal guide validators. Issues are
 * flagged for human review; nothing is silently corrected.
 */
function RuleChecklist({ section }: { section: ProposalSection }) {
  const validation = section.validation;
  if (!validation) return null;

  return (
    <div className="mt-4 rounded-md border border-edge-soft bg-surface p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-ink-faint">
        Proposal guide checks
        {validation.passed ? (
          <StatusBadge kind="success" className="min-h-6 px-2 py-0.5">passed</StatusBadge>
        ) : (
          <StatusBadge kind="danger" className="min-h-6 px-2 py-0.5">needs review</StatusBadge>
        )}
      </p>
      {validation.issues.length ? (
        <ul className="space-y-1.5">
          {validation.issues.map((issue) => (
            <li
              key={`${issue.rule}-${issue.message}`}
              className={`flex items-start gap-2 text-xs leading-5 ${issue.severity === "error" ? "text-coral-ink" : "text-warn"}`}
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-green-ink">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All hard rules for this section pass.
        </p>
      )}
    </div>
  );
}

function EmailChecklist({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-green-ink">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Email rules pass: one CTA, Move Supply Chain in the subject, no banned phrases.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {issues.map((issue) => (
        <li
          key={`${issue.rule}-${issue.message}`}
          className={`flex items-start gap-2 text-xs leading-5 ${issue.severity === "error" ? "text-coral-ink" : "text-warn"}`}
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="move-input" />
    </label>
  );
}
