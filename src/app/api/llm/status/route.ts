import { NextResponse } from "next/server";
import { generateWithLLM, getLastLLMCall, getLLMStatus } from "@/lib/llm";
import { requireApiUser } from "@/lib/server-auth";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const status = getLLMStatus();
  let lastCall = getLastLLMCall();

  // First status check after boot: ping the provider once so the badge is
  // truthful before any module has generated anything.
  if (status.activeConfigured && !lastCall) {
    try {
      await generateWithLLM({
        maxTokens: 8,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      });
    } catch {
      // generateWithLLM already recorded the failure.
    }
    lastCall = getLastLLMCall();
  }

  const live = status.activeConfigured && lastCall?.ok === true;

  return NextResponse.json({
    mode: live ? "live" : "fallback",
    provider: status.provider,
    model: status.activeModel,
    configured: status.activeConfigured,
    lastCall,
  });
}
