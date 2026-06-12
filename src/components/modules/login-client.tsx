"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ActionButton } from "@/components/action-button-group";
import { StatusBadge } from "@/components/status-badge";

export function LoginClient({ codeConfigured }: { codeConfigured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sign in failed.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="move-panel grid w-full max-w-5xl overflow-hidden rounded-md lg:grid-cols-[1.1fr_.9fr]">
        <div className="border-b border-edge-soft p-8 lg:border-b-0 lg:border-r">
          <Image
            src="/move-logo-footer.webp"
            alt="Move Supply Chain"
            width={160}
            height={41}
            className="h-auto w-44"
            priority
          />
          <div className="mt-3 text-sm font-bold uppercase tracking-[0.08em] text-green-ink">Supply Chain</div>
          <h1 className="mt-10 max-w-xl text-4xl font-black text-ink">Move CA Engine</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-ink-muted">
            The front end of Move&apos;s funnel in one internal app. Qualify the lead, prep the call, build the proposal, read the market.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <StatusBadge kind="success">Team access code</StatusBadge>
            <StatusBadge kind="info">Server-side API guards</StatusBadge>
            <StatusBadge kind="warning">LocalStorage V1</StatusBadge>
            <StatusBadge kind="success">Human approvals</StatusBadge>
          </div>
        </div>
        <div className="p-8">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-md bg-green/15 text-green-ink">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-ink">Sign in to continue</h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Enter the shared Move team access code. The code is set by the person who deployed the app.
          </p>
          {!codeConfigured ? (
            <div className="mt-5 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              ACCESS_CODE is not configured on the server yet. Set it in .env.local (or your host&apos;s
              environment variables) and restart the app.
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-md border border-coral/40 bg-coral/10 p-3 text-sm text-coral-ink">
              {error}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Access code</span>
              <input
                type="password"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="move-input"
                placeholder="Team access code"
                autoFocus
              />
            </label>
            <ActionButton type="submit" disabled={!code || loading} className="w-full">
              {loading ? "Checking..." : "Enter the engine"}
              <ArrowRight className="h-4 w-4" />
            </ActionButton>
          </form>
        </div>
      </section>
    </main>
  );
}
