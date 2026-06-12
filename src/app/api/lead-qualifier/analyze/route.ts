import { NextResponse } from "next/server";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateJson } from "@/lib/llm";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { makeId, scrubEmDashes } from "@/lib/utils";
import { analyzeLead } from "@/lib/workflows/lead-qualifier";

const leadSchema = z.object({
  brandName: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  websiteCopy: z.string().optional(),
  leadList: z.string().optional(),
  fetchedWebsiteText: z.string().optional(),
});

const llmResultSchema = z.object({
  brandName: z.string(),
  fitScore: z.number().min(0).max(100),
  fitVerdict: z.enum(["high_fit", "medium_fit", "low_fit", "disqualified"]),
  scoreReasons: z.array(z.string()).min(2),
  icpChecks: z.record(z.string(), z.object({ pass: z.boolean(), reason: z.string() })),
  disqualifierFlags: z.array(z.string()),
  painSignals: z.array(z.string()),
  buyerSignals: z.array(z.string()),
  personalizationHook: z.string(),
  recommendedNextAction: z.enum(["research_more", "add_to_crm", "prep_outreach", "prep_call", "disqualify"]),
  crmSummary: z.string(),
  assumptions: z.array(z.string()),
  missingInfo: z.array(z.string()),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = leadSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success || !Object.values(body.data).some(Boolean)) {
    return NextResponse.json({ error: "Paste a brand, URL, notes, or website copy first." }, { status: 400 });
  }

  const input = body.data;
  const rules = await readContentFiles([
    "playbooks/move-icp-rules.md",
    "client-acquisition/lead-qualification-rules.md",
    "client-acquisition/outreach-rules.md",
  ]);

  const suppliedContext = [
    input.brandName ? `Brand name: ${input.brandName}` : "",
    input.website ? `Website: ${input.website}` : "",
    input.notes ? `Notes:\n${input.notes}` : "",
    input.websiteCopy ? `Pasted website copy:\n${input.websiteCopy}` : "",
    input.leadList ? `Lead list context:\n${input.leadList}` : "",
    input.fetchedWebsiteText ? `Website content fetched live by the app:\n${input.fetchedWebsiteText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const llm = await tryGenerateJson(llmResultSchema, {
    maxTokens: 2200,
    temperature: 0.2,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Qualify this lead against Move's ICP using the rules below.

${rules}

Supplied lead context (the only source of truth, do not invent facts):
${suppliedContext}

Score with the rubric in the lead qualification rules. The icpChecks object must contain exactly these keys: physicalGoodsBrand, marketFit, revenueOrComplexityFit, supplyChainPainVisible, buyerVisibility. Each check has "pass" (boolean) and "reason" (one specific sentence grounded in the supplied context).

The personalizationHook must be one specific observation from the supplied context that could open a first-touch email, per the outreach rules. If nothing specific is available, say what research is still needed instead of inventing one.

Return ONLY a JSON object with this exact shape:
{
  "brandName": string,
  "fitScore": number 0-100,
  "fitVerdict": "high_fit" | "medium_fit" | "low_fit" | "disqualified",
  "scoreReasons": string[],
  "icpChecks": { "<key>": { "pass": boolean, "reason": string } },
  "disqualifierFlags": string[],
  "painSignals": string[],
  "buyerSignals": string[],
  "personalizationHook": string,
  "recommendedNextAction": "research_more" | "add_to_crm" | "prep_outreach" | "prep_call" | "disqualify",
  "crmSummary": string,
  "assumptions": string[],
  "missingInfo": string[]
}`,
      },
    ],
  });

  if (llm.data) {
    return NextResponse.json({
      result: scrubEmDashes({
        id: makeId("lead"),
        createdAt: new Date().toISOString(),
        website: input.website?.trim() || null,
        ...llm.data,
      }),
      generation: llm.generation,
    });
  }

  // Deterministic fallback: the keyword heuristics, clearly labeled as such.
  const result = analyzeLead({
    ...input,
    websiteCopy: [input.websiteCopy, input.fetchedWebsiteText].filter(Boolean).join("\n\n"),
  });
  return NextResponse.json({ result, generation: llm.generation });
}
