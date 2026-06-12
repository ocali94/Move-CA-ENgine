"use client";

import { Activity } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useAppState } from "@/lib/client-storage";
import { formatDateTime } from "@/lib/utils";

export function ActivityFeedClient() {
  const { state } = useAppState();

  return (
    <section className="move-panel rounded-md p-5">
      <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
        <Activity className="h-6 w-6 text-green-ink" />
        Activity Feed
      </h1>
      <p className="mt-2 text-sm text-ink-muted">Recent local workflow activity saved in this browser.</p>
      <div className="mt-5 space-y-3">
        {state.activity.length ? (
          state.activity.map((item) => (
            <article key={item.id} className="rounded-md border border-edge-soft bg-surface p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-bold text-ink">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{item.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge kind="info">{item.module}</StatusBadge>
                  <span className="text-xs text-ink-faint">{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No activity yet" body="Run a lead score, call prep brief, proposal action, or market refresh." />
        )}
      </div>
    </section>
  );
}
