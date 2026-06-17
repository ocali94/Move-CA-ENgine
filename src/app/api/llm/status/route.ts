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
  // Report who actually served, not just who is configured first — a
  // rate-limited Codex is "configured" but Gemini is doing the work.
  const provider = lastCall?.ok ? lastCall.provider : status.provider;
  const model = lastCall?.ok ? lastCall.model : status.activeModel;

  return NextResponse.json({
    mode: live ? "live" : "fallback",
    provider,
    model,
    configured: status.activeConfigured,
    primary: status.primary,
    override: status.override,
    chain: status.chain,
    lastCall,
  });
}
