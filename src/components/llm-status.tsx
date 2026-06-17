"use client";

import { Bot, Check, ChevronDown, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GenerationMeta } from "@/lib/types";

type ChainEntry = { name: string; model: string; configured: boolean };

type LastCall = {
  provider: string;
  ok: boolean;
  error?: string;
  skipped?: { provider: string; error: string }[];
} | null;

type LlmStatus = {
  mode: "live" | "fallback";
  provider: string;
  model: string;
  configured: boolean;
  primary?: string;
  override?: string;
  chain?: ChainEntry[];
  lastCall?: LastCall;
};

const PROVIDER_LABELS: Record<string, string> = {
  codex: "Codex",
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const titleCase = (name: string) => PROVIDER_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);

export const LLM_ACTIVITY_EVENT = "move-llm-activity";

/**
 * Tell the header badge about the latest generation result so it updates
 * immediately after a module call instead of waiting for the next poll.
 */
export function reportLlmActivity(generation?: GenerationMeta) {
  if (typeof window === "undefined" || !generation) return;
  window.dispatchEvent(new CustomEvent(LLM_ACTIVITY_EVENT, { detail: generation }));
}

type Health = { tone: "ok" | "warn" | "off"; label: string };

function healthOf(entry: ChainEntry, status: LlmStatus): Health {
  if (!entry.configured) return { tone: "off", label: "No key" };
  const last = status.lastCall;
  if (last?.provider === entry.name) {
    return last.ok ? { tone: "ok", label: "Live" } : { tone: "warn", label: "Last call failed" };
  }
  if (last?.skipped?.some((item) => item.provider === entry.name)) {
    return { tone: "warn", label: "Unavailable" };
  }
  return { tone: "ok", label: "Ready" };
}

function chainSummary(status: LlmStatus) {
  return (status.chain ?? []).map((entry) => titleCase(entry.name)).join(", then ");
}

export function LlmStatusBadge() {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/llm/status");
      if (!response.ok) return;
      setStatus(await response.json());
    } catch {
      // Leave the previous reading in place; the badge never blocks the UI.
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refresh();
    }, 0);
    const onActivity = (event: Event) => {
      const generation = (event as CustomEvent<GenerationMeta>).detail;
      setStatus((current) =>
        current
          ? { ...current, mode: generation.mode === "llm" ? "live" : "fallback" }
          : current,
      );
      void refresh();
    };
    window.addEventListener(LLM_ACTIVITY_EVENT, onActivity);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(LLM_ACTIVITY_EVENT, onActivity);
    };
  }, [refresh]);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const switchProvider = useCallback(async (choice: string) => {
    setSwitching(choice);
    try {
      const response = await fetch("/api/llm/provider", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: choice }),
      });
      if (response.ok) {
        setStatus(await response.json());
        setOpen(false);
      }
    } catch {
      // Next poll reconciles; never block the header.
    } finally {
      setSwitching(null);
    }
  }, []);

  const live = status?.mode === "live";
  const activeLabel = status ? titleCase(status.provider) : "";
  const failedOver = Boolean(status?.lastCall?.skipped?.length) && status?.lastCall?.ok === true;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={
          status
            ? live
              ? `Connected to ${status.provider} (${status.model})${failedOver ? " — auto-switched from primary" : ""}`
              : status.configured
                ? "An LLM key is set but the last call failed. Outputs use local fallback logic."
                : "No LLM key configured. Outputs use local fallback logic."
            : "Checking AI status"
        }
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors",
          live
            ? "border-green/45 bg-green/12 text-green-ink hover:bg-green/20"
            : "border-warn/45 bg-warn/12 text-warn hover:bg-warn/20",
        )}
      >
        {live ? <Bot className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
        {status ? (live ? "Live AI" : "Fallback") : "AI status..."}
        {status ? <span className="font-semibold opacity-75">· {activeLabel}</span> : null}
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-green" : "bg-warn", !status && "animate-pulse")} />
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && status ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-md border border-edge-soft bg-panel p-2 text-ink shadow-xl">
          <p className="px-2 pt-1 text-xs font-black uppercase tracking-[0.08em] text-ink-faint">AI provider</p>
          {failedOver ? (
            <p className="mx-1 mt-1 rounded bg-warn/10 px-2 py-1 text-[11px] font-semibold text-warn">
              Auto-switched to {activeLabel}; primary was unavailable.
            </p>
          ) : null}

          <div className="mt-1 space-y-0.5">
            <ProviderRow
              label="Auto"
              sublabel={`Priority: ${chainSummary(status)}`}
              selected={(status.override ?? "auto") === "auto"}
              active={false}
              disabled={switching !== null}
              busy={switching === "auto"}
              onSelect={() => switchProvider("auto")}
            />
            {(status.chain ?? []).map((entry) => (
              <ProviderRow
                key={entry.name}
                label={titleCase(entry.name)}
                sublabel={entry.configured ? entry.model : "No key configured"}
                selected={status.override === entry.name}
                active={status.provider === entry.name}
                disabled={!entry.configured || switching !== null}
                busy={switching === entry.name}
                health={healthOf(entry, status)}
                onSelect={() => switchProvider(entry.name)}
              />
            ))}
          </div>

          <p className="px-2 pb-1 pt-2 text-[11px] leading-4 text-ink-faint">
            Failover is automatic. A forced choice resets to Auto when the server restarts.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ProviderRow({
  label,
  sublabel,
  selected,
  active,
  disabled,
  busy,
  health,
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  active: boolean;
  disabled: boolean;
  busy: boolean;
  health?: Health;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-55" : "hover:bg-green/10",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected ? <Check className="h-4 w-4 text-green-ink" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{label}</span>
          {active ? (
            <span className="rounded bg-green/15 px-1 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-ink">
              active
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-ink-muted">{sublabel}</span>
      </span>
      {busy ? (
        <span className="text-[11px] font-semibold text-ink-faint">…</span>
      ) : health ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-[11px] font-semibold",
            health.tone === "ok" && "text-green-ink",
            health.tone === "warn" && "text-warn",
            health.tone === "off" && "text-ink-faint",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              health.tone === "ok" && "bg-green",
              health.tone === "warn" && "bg-warn",
              health.tone === "off" && "bg-ink-faint",
            )}
          />
          {health.label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Per-output provenance line. Every generated artifact shows one of these so
 * nobody mistakes fallback output for the LLM in a live demo.
 */
export function GenerationFooter({ generation }: { generation?: GenerationMeta | null }) {
  if (!generation) return null;
  const live = generation.mode === "llm";
  return (
    <p
      className={cn(
        "mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold",
        live ? "border-green/35 bg-green/10 text-green-ink" : "border-warn/40 bg-warn/10 text-warn",
      )}
    >
      {live ? <Bot className="h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="h-3.5 w-3.5 shrink-0" />}
      {live
        ? `Generated by Live AI (${generation.provider}${generation.model ? ` · ${generation.model}` : ""})`
        : `Local fallback logic, not the LLM. ${generation.reason ?? ""}`}
    </p>
  );
}
