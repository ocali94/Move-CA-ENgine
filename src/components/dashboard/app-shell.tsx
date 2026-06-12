"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  FolderKanban,
  Gauge,
  LogOut,
  Moon,
  PhoneCall,
  Settings,
  Sun,
  Target,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LlmStatusBadge } from "@/components/llm-status";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/lead-qualifier", label: "Lead Qualifier", icon: Target },
  { href: "/dashboard/call-prep", label: "Call Prep Engine", icon: PhoneCall },
  { href: "/dashboard/proposal-studio", label: "Proposal Studio", icon: Wand2 },
  { href: "/dashboard/market-signals", label: "Market Signals", icon: Gauge },
  { href: "/dashboard/activity-feed", label: "Activity Feed", icon: Activity },
  { href: "/dashboard/saved-projects", label: "Saved Projects", icon: FolderKanban },
  { href: "/dashboard/proposal-library", label: "Reference Library", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Initialized false to match the server render; the real value is read
  // after mount so hydration never mismatches.
  const [light, setLight] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLight(document.documentElement.classList.contains("light"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const nextLight = !light;
    setLight(nextLight);
    document.documentElement.classList.toggle("light", nextLight);
    document.documentElement.classList.toggle("dark", !nextLight);
    window.localStorage.setItem("move-ca-theme", nextLight ? "light" : "dark");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] border-r border-edge-soft bg-panel xl:block">
        <div className="flex h-full flex-col">
          <Link href="/dashboard" className="block px-7 py-7">
            <Image
              src="/move-logo-footer.webp"
              alt="Move Supply Chain"
              width={160}
              height={41}
              className="h-auto w-36"
              priority
            />
            <div className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-green-ink">
              Supply Chain
            </div>
          </Link>
          <nav className="flex-1 space-y-1 px-4">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = pathname === item.href || (pathname === "/dashboard" && index === 0);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex min-h-12 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-semibold text-ink-muted transition",
                    active
                      ? "border-green/25 bg-green/12 text-ink"
                      : "hover:border-edge-soft hover:bg-surface",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-green-ink" : "text-ink-faint")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="m-4 rounded-md border border-edge-soft bg-surface p-4">
            <div className="flex items-center gap-3">
              <Image src="/move-favicon.png" alt="" width={44} height={44} className="h-11 w-11 rounded-md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">Move Supply Chain</p>
                <p className="truncate text-xs text-ink-faint">Internal CA team tool</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 text-xs text-ink-faint">
            <p>Move CA Engine</p>
          </div>
        </div>
      </aside>
      <div className="xl:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-edge-soft bg-panel/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/dashboard" className="text-2xl font-black tracking-wide text-ink">
                MOVE CA ENGINE
              </Link>
              <p className="mt-1 text-sm text-ink-muted">
                Qualify the lead, prep the call, build the proposal, read the market.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LlmStatusBadge />
              <button
                onClick={toggleTheme}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-edge bg-surface px-3 text-sm text-ink"
                aria-label="Toggle dark and light mode"
              >
                {light ? <Sun className="h-4 w-4 text-warn" /> : <Moon className="h-4 w-4 text-green-ink" />}
                {light ? "Light" : "Dark"}
              </button>
              <Link
                href="/setup"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-edge bg-surface px-3 text-sm font-semibold text-ink"
              >
                <Settings className="h-4 w-4" />
                Setup
              </Link>
              <button
                onClick={signOut}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-edge bg-surface px-3 text-sm text-ink"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold",
                    active
                      ? "border-green/30 bg-green/12 text-ink"
                      : "border-edge-soft bg-surface text-ink-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-5 md:px-7">{children}</main>
      </div>
    </div>
  );
}
