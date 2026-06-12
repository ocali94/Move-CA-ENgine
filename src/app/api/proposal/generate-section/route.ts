import { NextResponse } from "next/server";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateText } from "@/lib/llm";
import { sectionRequirements } from "@/lib/proposal-llm";
import { SECTION_TITLES, validateSection } from "@/lib/proposal-rules";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { withoutEmDash } from "@/lib/utils";
import { generateProposalSection } from "@/lib/workflows/proposal";
import type { DiscoveryExtraction, ProposalSection } from "@/lib/types";

const sectionSchema = z.object({
  sectionNumber: z.number().min(1).max(7),
  facts: z.record(z.string(), z.unknown()),
  previousSections: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = sectionSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Missing section number or extracted facts." }, { status: 400 });
  }

  const { sectionNumber } = body.data;
  const facts = body.data.facts as unknown as DiscoveryExtraction;
  const previousSections = (body.data.previousSections ?? []) as unknown as ProposalSection[];

  const rules = await readContentFiles([
    "playbooks/move-proposal-rules.md",
    "playbooks/move-service-paths.md",
    "playbooks/move-pricing-benchmarks.md",
    "client-acquisition/client-acquisition-tone.md",
  ]);

  const approvedContext = previousSections
    .filter((section) => section.content?.trim())
    .map((section) => `Section ${section.number}: ${section.title}\n${section.content}`)
    .join("\n\n---\n\n");

  const llm = await tryGenerateText({
    maxTokens: 2400,
    temperature: 0.3,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Draft Section ${sectionNumber}: ${SECTION_TITLES[sectionNumber - 1]} of a Move Supply Chain proposal.

${rules}

Extracted discovery facts (the only source of client truth):
${JSON.stringify(facts, null, 2)}

${approvedContext ? `Approved previous sections (keep pricing, durations, and recommendations consistent with these):\n${approvedContext}` : "This is the first section being drafted."}

Hard requirements for this section (these are validated by the app after generation, so follow them exactly):
${sectionRequirements(sectionNumber, facts)}

Write ONLY this section as clean Markdown, starting with "## ${SECTION_TITLES[sectionNumber - 1]}". No preamble, no commentary, no later sections, no em dashes.`,
      },
    ],
  });

  const content = llm.data
    ? withoutEmDash(llm.data)
    : generateProposalSection(sectionNumber, facts, previousSections).content;

  return NextResponse.json({
    section: {
      content,
      sourceChunkIds: previousSections.flatMap((section) => section.sourceChunkIds ?? []).slice(0, 4),
    },
    validation: validateSection(sectionNumber, content, facts),
    generation: llm.generation,
  });
}
