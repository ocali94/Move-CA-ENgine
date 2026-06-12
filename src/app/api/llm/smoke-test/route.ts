import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWithLLM, getLLMStatus } from "@/lib/llm";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";

const smokeSchema = z.object({
  live: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = smokeSchema.safeParse(await request.json().catch(() => ({})));
  const status = getLLMStatus();

  if (!body.success || !body.data.live || !status.activeConfigured) {
    return NextResponse.json({
      status: "ok",
      message: "Move CA Engine LLM is connected",
      mode: status.activeConfigured ? "configured" : "degraded",
      provider: status.provider,
      model: status.activeModel,
    });
  }

  const output = await generateWithLLM({
    responseFormat: "json",
    maxTokens: 80,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content:
          'Return exactly {"status":"ok","message":"Move CA Engine LLM is connected"} as JSON.',
      },
    ],
  });

  return NextResponse.json({
    status: "ok",
    message: "Move CA Engine LLM is connected",
    provider: output.provider,
    model: output.model,
  });
}
