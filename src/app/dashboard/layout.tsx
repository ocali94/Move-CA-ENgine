import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { hasAccess } from "@/lib/server-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAccess())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
