import { redirect } from "next/navigation";
import { LoginClient } from "@/components/modules/login-client";
import { accessCodeConfigured, hasAccess } from "@/lib/server-auth";

export default async function LoginPage() {
  if (await hasAccess()) {
    redirect("/dashboard");
  }

  return <LoginClient codeConfigured={accessCodeConfigured()} />;
}
