import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGenerateText } from "@/lib/llm";
import { sectionRequirements } from "@/lib/proposal-llm";
import { validateSection } from "@/lib/proposal-rules";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { withoutEmDash } from "@/lib/utils";
import { reviseSection } from "@/lib/workflows/proposal";
import type { DiscoveryExtraction } from "@/lib/types";

const reviseSchema = z.object({
  currentContent: z.string().min(1),
  instruction: z.string().min(1),
  sectionNumber: z.number().min(1).max(7).optional(),
  facts: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = reviseSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Add an active section and revision instruction first." }, { status: 400 });
  }

  const { currentContent, instruction, sectionNumber } = body.data;
  const facts = body.data.facts as unknown as DiscoveryExtraction | undefined;

  const llm = await tryGenerateText({
    maxTokens: 2400,
    temperature: 0.3,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Revise this Move proposal section following the instruction. Keep everything that was not asked to change. Keep the same Markdown structure and heading.

${sectionNumber && facts ? `Hard requirements that must still hold after the revision:\n${sectionRequirements(sectionNumber, facts)}\n` : ""}
Current section:
${currentContent}

Revision instruction from the Move team:
${instruction}

Return ONLY the full revised section as clean Markdown. No commentary, no em dashes.`,
      },
    ],
  });

  const content = llm.data ? withoutEmDash(llm.data) : reviseSection(currentContent, instruction);

  return NextResponse.json({
    content,
    validation: sectionNumber ? validateSection(sectionNumber, content, facts ?? null) : null,
    generation: llm.generation,
  });
}
