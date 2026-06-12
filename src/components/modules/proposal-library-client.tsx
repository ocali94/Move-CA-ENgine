"use client";

import { BookOpen, FileUp } from "lucide-react";
import { ActionButton } from "@/components/action-button-group";
import { EmptyState } from "@/components/empty-state";
import { SourceChip } from "@/components/source-chip";

export function ProposalLibraryClient({
  references,
}: {
  references: { title: string; category: string; sourcePath?: string; chunks: number }[];
}) {
  return (
    <div className="space-y-5">
      <section className="move-panel rounded-md p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
              <BookOpen className="h-6 w-6 text-green-ink" />
              Proposal Library
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
              Local playbooks, proposal precedent folders, tone examples, case studies, and market signal rules. The content/ folder is the only reference library; one-off references can be pasted per project in Proposal Studio.
            </p>
          </div>
          <ActionButton type="button" variant="secondary" onClick={() => alert("Use Proposal Studio to paste project-level references.")}>
            <FileUp className="h-4 w-4" />
            Paste a reference
          </ActionButton>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {references.length ? (
          references.map((reference) => (
            <article key={`${reference.sourcePath}-${reference.title}`} className="move-panel rounded-md p-5">
              <SourceChip>{reference.category}</SourceChip>
              <h2 className="mt-4 text-lg font-black capitalize text-ink">{reference.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{reference.sourcePath}</p>
              <p className="mt-4 text-xs text-ink-faint">{reference.chunks} chunks indexed</p>
            </article>
          ))
        ) : (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState title="No local content indexed" body="Add Markdown files to content/playbooks, content/proposal-library, or related content folders." />
          </div>
        )}
      </section>
    </div>
  );
}
