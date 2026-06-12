"use client";

import { Download, FolderKanban, Upload } from "lucide-react";
import { ChangeEvent } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/action-button-group";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { downloadText, exportStateJson, useAppState, writeAppState } from "@/lib/client-storage";
import { formatDateTime } from "@/lib/utils";

export function SavedProjectsClient() {
  const { state, update } = useAppState();

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const parsed = JSON.parse(text);
      const nextState = parsed.state ?? parsed;
      writeAppState(nextState);
      update(() => nextState);
    });
  }

  return (
    <div className="space-y-5">
      <section className="move-panel rounded-md p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
              <FolderKanban className="h-6 w-6 text-green-ink" />
              Saved Projects
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              V1 saves projects in this browser. Export project JSON if you want a backup or need to move devices.
            </p>
          </div>
          <ActionButtonGroup>
            <ActionButton type="button" onClick={() => downloadText("move-ca-engine-backup.json", exportStateJson(state))}>
              <Download className="h-4 w-4" />
              Export JSON
            </ActionButton>
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-surface px-3.5 py-2 text-sm font-semibold text-ink">
              <Upload className="h-4 w-4" />
              Import JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
            </label>
          </ActionButtonGroup>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        {state.proposalProjects.length ? (
          state.proposalProjects.map((project) => (
            <article key={project.id} className="move-panel rounded-md p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-ink">{project.clientName}</h2>
                <StatusBadge kind={project.sections.every((section) => section.status === "locked") ? "success" : "warning"}>
                  {project.sections.filter((section) => section.status === "locked").length}/7 approved
                </StatusBadge>
              </div>
              <p className="text-sm leading-6 text-ink-muted">
                {project.extractedFacts?.recommendedServicePath ?? "No recommended service path yet"}
              </p>
              <p className="mt-4 text-xs text-ink-faint">Updated {formatDateTime(project.updatedAt)}</p>
            </article>
          ))
        ) : (
          <div className="xl:col-span-3">
            <EmptyState title="No saved proposal projects" body="Start Proposal Studio to create the first local project." />
          </div>
        )}
      </section>
    </div>
  );
}
