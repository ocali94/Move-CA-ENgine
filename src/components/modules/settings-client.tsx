"use client";

import { Settings } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

const rows = [
  ["Auth", "Shared team access code (ACCESS_CODE env var) with an httpOnly cookie."],
  ["LLM", "Server-side provider abstraction for Anthropic or OpenAI, with a labeled local fallback."],
  ["References", "The content/ folder is the reference library. One-off references can be pasted per project."],
  ["Storage", "Browser localStorage plus JSON import and export."],
  ["Market", "Free public data (FRED, Yahoo Finance), file cache, or clearly labeled dev-only demo mode."],
];

export function SettingsClient() {
  return (
    <section className="move-panel rounded-md p-5">
      <h1 className="flex items-center gap-3 text-2xl font-black text-ink">
        <Settings className="h-6 w-6 text-green-ink" />
        Settings
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
        V1 configuration is environment-based. The browser never writes secrets, and API keys are never exposed to the client.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {rows.map(([title, body]) => (
          <article key={title} className="rounded-md border border-edge-soft bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-black text-ink">{title}</h2>
              <StatusBadge kind="info">V1</StatusBadge>
            </div>
            <p className="text-sm leading-6 text-ink-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
