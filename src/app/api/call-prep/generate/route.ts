import { NextResponse } from "next/server";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateJson } from "@/lib/llm";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { makeId, scrubEmDashes } from "@/lib/utils";
import { generateCallPrep } from "@/lib/workflows/call-prep";

const callSchema = z.object({
  companyName: z.string().optional(),
  website: z.string().optional(),
  intake: z.string().optional(),
  revenue: z.string().optional(),
  skuCount: z.string().optional(),
  annualPoValue: z.string().optional(),
  sellingPlatforms: z.string().optional(),
  warehouseSetup: z.string().optional(),
  foundUs: z.string().optional(),
  notes: z.string().optional(),
  fetchedWebsiteText: z.string().optional(),
});

const painCategory = z.enum(["sourcing", "inventory", "logistics", "npd", "3pl", "vendor_management", "margin", "other"]);

const llmBriefSchema = z.object({
  companyName: z.string(),
  brandSnapshot: z.object({
    companyName: z.string(),
    category: z.string().nullable(),
    products: z.array(z.string()),
    channels: z.array(z.string()),
    pricePoints: z.array(z.string()),
    likelyProductionRegions: z.array(z.string()),
    operationalComplexity: z.enum(["low", "medium", "high"]),
    // Models sometimes return notes as a list; accept both rather than
    // discarding an otherwise valid response.
    notes: z.union([z.string(), z.array(z.string()).transform((items) => items.join(" "))]),
  }),
  painMap: z
    .array(
      z.object({
        category: painCategory,
        severity: z.enum(["low", "medium", "high"]),
        reason: z.string(),
        confidence: z.number().min(0).max(100),
      }),
    )
    .min(3),
  diagnosticQuestions: z
    .array(z.object({ order: z.number(), question: z.string(), whyAsk: z.string() }))
    .min(8)
    .max(10),
  probableServicePath: z.string(),
  servicePathConfidence: z.number().min(0).max(100),
  thingsToVerify: z.array(z.string()).min(3),
  thingsToAvoid: z.array(z.string()).min(2),
  suggestedCallAngle: z.string(),
  copyReadySummary: z.string(),
  assumptions: z.array(z.string()),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = callSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success || !Object.values(body.data).some(Boolean)) {
    return NextResponse.json({ error: "Paste booking form answers or intake notes first." }, { status: 400 });
  }

  const input = body.data;
  const rules = await readContentFiles([
    "client-acquisition/discovery-call-rules.md",
    "playbooks/move-service-paths.md",
    "client-acquisition/client-acquisition-tone.md",
  ]);

  const intakeContext = [
    input.companyName ? `Company: ${input.companyName}` : "",
    input.website ? `Website: ${input.website}` : "",
    input.revenue ? `Revenue: ${input.revenue}` : "",
    input.skuCount ? `SKU count: ${input.skuCount}` : "",
    input.annualPoValue ? `Annual PO value: ${input.annualPoValue}` : "",
    input.sellingPlatforms ? `Selling platforms: ${input.sellingPlatforms}` : "",
    input.warehouseSetup ? `Warehouse setup: ${input.warehouseSetup}` : "",
    input.foundUs ? `How they found Move: ${input.foundUs}` : "",
    input.intake ? `Booking form answers:\n${input.intake}` : "",
    input.notes ? `Notes:\n${input.notes}` : "",
    input.fetchedWebsiteText ? `Brand website content fetched live by the app:\n${input.fetchedWebsiteText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const llm = await tryGenerateJson(llmBriefSchema, {
    maxTokens: 2600,
    temperature: 0.3,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Build a one-page discovery call battle card for this prospect.

${rules}

Intake context (the only source of truth, do not invent facts):
${intakeContext}

Requirements:
- painMap: ranked likely problems across sourcing, inventory, logistics, npd, 3pl, vendor_management, margin. Only include categories with real signals; rank by confidence.
- diagnosticQuestions: 8 to 10 questions tailored to this specific prospect, ordered opener to deep dive per the discovery call rules. Reference their actual products, channels, and stated pains, not generic placeholders.
- probableServicePath: pick from the Move service paths document and explain confidence honestly.
- thingsToVerify / thingsToAvoid: specific to what is unknown or risky for this prospect.
- brandSnapshot fields come only from the supplied context; use empty arrays or null where unknown.

Return ONLY a JSON object with keys: companyName, brandSnapshot {companyName, category, products, channels, pricePoints, likelyProductionRegions, operationalComplexity ("low"|"medium"|"high"), notes}, painMap [{category, severity ("low"|"medium"|"high"), reason, confidence 0-100}], diagnosticQuestions [{order, question, whyAsk}], probableServicePath, servicePathConfidence 0-100, thingsToVerify [], thingsToAvoid [], suggestedCallAngle, copyReadySummary, assumptions [].`,
      },
    ],
  });

  if (llm.data) {
    return NextResponse.json({
      brief: scrubEmDashes({
        id: makeId("call"),
        createdAt: new Date().toISOString(),
        ...llm.data,
      }),
      generation: llm.generation,
    });
  }

  const brief = generateCallPrep({
    ...input,
    notes: [input.notes, input.fetchedWebsiteText].filter(Boolean).join("\n\n"),
  });
  return NextResponse.json({ brief, generation: llm.generation });
}
