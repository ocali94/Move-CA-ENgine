import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, Database, KeyRound, Library, ServerCog } from "lucide-react";
import { ActionButton } from "@/components/action-button-group";
import { StatusBadge } from "@/components/status-badge";
import { contentStats } from "@/lib/content";
import { getLLMStatus } from "@/lib/llm";
import { accessCodeConfigured, hasAccess } from "@/lib/server-auth";

export default async function SetupPage() {
  if (!(await hasAccess())) redirect("/login");

  const stats = await contentStats();
  const llm = getLLMStatus();

  return (
    <main className="min-h-screen px-4 py-8 text-ink md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-green-ink">
              Back to dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-black text-ink">Setup</h1>
            <p className="mt-2 text-ink-muted">
              The app needs exactly two things: ACCESS_CODE and one LLM key. Everything else is optional.
            </p>
          </div>
          <StatusBadge kind={llm.activeConfigured ? "success" : "warning"}>
            {llm.activeConfigured ? "Live AI ready" : "Fallback mode (no LLM key)"}
          </StatusBadge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SetupCard title="Access" icon={KeyRound}>
            <SetupRow label="ACCESS_CODE configured" value={accessCodeConfigured() ? "yes" : "no"} ok={accessCodeConfigured()} />
            <SetupRow label="Sign-in method" value="Shared team access code" ok />
            <SetupRow label="Route protection" value="proxy.ts guards /dashboard, /setup, and /api" ok />
          </SetupCard>
          <SetupCard title="LLM" icon={ServerCog}>
            <SetupRow label="Provider selected" value={llm.provider} ok />
            <SetupRow label="Anthropic key detected" value={llm.anthropicConfigured ? "yes" : "no"} ok={llm.anthropicConfigured} />
            <SetupRow label="OpenAI key detected" value={llm.openaiConfigured ? "yes" : "no"} ok={llm.openaiConfigured} />
            <SetupRow label="Active model" value={llm.activeModel} ok={llm.activeConfigured} />
            <p className="text-xs leading-5 text-ink-faint">
              Without a key every module still works, but outputs come from local fallback logic and are labeled that way.
            </p>
          </SetupCard>
          <SetupCard title="Content Library" icon={Library}>
            <SetupRow label="Playbook files found" value={stats.playbooks} ok={stats.playbooks > 0} />
            <SetupRow label="Proposal library files found" value={stats.proposalLibrary} ok={stats.proposalLibrary > 0} />
            <SetupRow label="Client acquisition docs found" value={stats.clientAcquisition} ok={stats.clientAcquisition > 0} />
            <SetupRow label="Local indexed chunks" value={stats.chunks} ok={stats.chunks > 0} />
          </SetupCard>
          <SetupCard title="Market Data" icon={Database}>
            <SetupRow label="FRED macro series" value="Free public CSV endpoint, no key needed" ok />
            <SetupRow label="Discretionary vs staples ratio" value="Yahoo Finance public endpoint, no key needed" ok />
            <SetupRow label="Cache TTL" value={`${process.env.MARKET_DATA_CACHE_TTL_HOURS ?? "24"} hours`} ok />
            <Link href="/dashboard/market-signals">
              <ActionButton variant="secondary">Open Market Signals</ActionButton>
            </Link>
          </SetupCard>
          <SetupCard title="Proposal Studio" icon={CheckCircle2}>
            <SetupRow label="Section templates loaded" value="7-section Move format" ok />
            <SetupRow label="Rule validators active" value="Per-section checks plus pricing consistency" ok />
            <SetupRow label="Export system ready" value="Markdown and HTML with tables" ok />
            <Link href="/dashboard/proposal-studio">
              <ActionButton>Start sample proposal</ActionButton>
            </Link>
          </SetupCard>
        </div>
      </div>
    </main>
  );
}

function SetupCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  return (
    <section className="move-panel rounded-md p-5">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-green-ink" />
        <h2 className="text-lg font-black text-ink">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SetupRow({ label, value, ok }: { label: string; value: React.ReactNode; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-edge-soft bg-surface px-3 py-2">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="inline-flex items-center gap-2 text-right text-sm font-semibold text-ink">
        {ok ? <CheckCircle2 className="h-4 w-4 text-green-ink" /> : <CircleAlert className="h-4 w-4 text-warn" />}
        {value}
      </span>
    </div>
  );
}
