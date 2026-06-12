import { NextResponse } from "next/server";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateJson } from "@/lib/llm";
import { discoveryExtractionSchema } from "@/lib/proposal-llm";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { scrubEmDashes } from "@/lib/utils";
import { extractDiscoveryFacts } from "@/lib/workflows/proposal";

const extractSchema = z.object({
  notes: z.string().min(1),
  project: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = extractSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Paste discovery notes before extracting facts." }, { status: 400 });
  }

  const rules = await readContentFiles([
    "playbooks/move-discovery-extraction-rules.md",
    "playbooks/move-service-paths.md",
  ]);

  const projectContext = body.data.project
    ? Object.entries(body.data.project)
        .filter(([key, value]) => typeof value === "string" && value && !["id", "rawDiscoveryText"].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";

  const llm = await tryGenerateJson(discoveryExtractionSchema, {
    maxTokens: 3000,
    temperature: 0.1,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Extract every relevant fact from these discovery notes, following the extraction rules.

${rules}

Project fields already on file:
${projectContext || "None."}

Discovery notes (the only source of truth, do not invent anything):
${body.data.notes}

For painPoints, capture the client's own phrasing in sourceQuote where possible. List anything important that is NOT in the notes under missingInfo. recommendedServicePath must come from the Move service paths document.

Return ONLY a JSON object matching this shape (use [] and null where unknown, never invent values):
{"companyName":string|null,"website":string|null,"contactNames":[],"contactRoles":[],"productCategory":string|null,"productsMentioned":[],"revenue":string|null,"skuCount":string|null,"annualPoValue":string|null,"sellingChannels":[],"warehouseSetup":string|null,"currentSuppliers":[],"productionRegions":[],"freightOr3plSetup":string|null,"painPoints":[{"category":"sourcing"|"inventory"|"logistics"|"3pl"|"npd"|"vendor_management"|"production"|"margin"|"leadership"|"other","evidence":string,"severity":"low"|"medium"|"high","sourceQuote":string|null,"businessImpact":string|null}],"repeatedPhrases":[],"urgencySignals":[],"budgetSignals":[],"decisionMakers":[],"desiredOutcomes":[],"constraints":[],"risks":[],"missingInfo":[],"recommendedServicePath":string|null,"servicePathRationale":string|null,"pricingSignals":[],"internalFollowups":[],"confidenceScore":number,"assumptions":[]}`,
      },
    ],
  });

  if (llm.data) {
    return NextResponse.json({ facts: scrubEmDashes(llm.data), generation: llm.generation });
  }

  const facts = extractDiscoveryFacts(body.data.notes, body.data.project as never);
  return NextResponse.json({ facts, generation: llm.generation });
}
