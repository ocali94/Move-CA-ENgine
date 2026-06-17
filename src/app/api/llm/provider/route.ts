import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateWithLLM,
  getLastLLMCall,
  getLLMStatus,
  KNOWN_PROVIDERS,
  setProviderOverride,
} from "@/lib/llm";
import { requireApiUser } from "@/lib/server-auth";

const bodySchema = z.object({
  provider: z.enum(["auto", ...KNOWN_PROVIDERS]),
});

/**
 * Force which provider the chain tries first (or "auto" to follow the env
 * order). The override is per process and resets on restart; automatic
 * failover still applies, so a forced provider that fails falls through to the
 * others. After switching we ping once so the badge reports the new state.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: `Provider must be one of: auto, ${KNOWN_PROVIDERS.join(", ")}.` },
      { status: 400 },
    );
  }

  setProviderOverride(body.data.provider);

  const status = getLLMStatus();
  if (status.activeConfigured) {
    try {
      await generateWithLLM({
        maxTokens: 8,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      });
    } catch {
      // generateWithLLM already recorded the failure in lastCall.
    }
  }

  const lastCall = getLastLLMCall();
  const live = status.activeConfigured && lastCall?.ok === true;

  return NextResponse.json({
    ok: true,
    mode: live ? "live" : "fallback",
    provider: lastCall?.ok ? lastCall.provider : status.provider,
    model: lastCall?.ok ? lastCall.model : status.activeModel,
    configured: status.activeConfigured,
    primary: status.primary,
    override: status.override,
    chain: status.chain,
    lastCall,
  });
}
