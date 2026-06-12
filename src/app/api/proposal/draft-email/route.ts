import { NextResponse } from "next/server";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateJson } from "@/lib/llm";
import { validateCompanionEmail } from "@/lib/proposal-rules";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { requireApiUser } from "@/lib/server-auth";
import { scrubEmDashes } from "@/lib/utils";
import { draftCompanionEmail } from "@/lib/workflows/proposal";
import type { CompanionEmail, ProposalProject } from "@/lib/types";

const emailSchema = z.object({
  project: z.record(z.string(), z.unknown()),
});

const llmEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = emailSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const project = body.data.project as unknown as ProposalProject;
  const rules = await readContentFiles([
    "client-acquisition/proposal-email-rules.md",
    "playbooks/move-email-tone.md",
    "client-acquisition/client-acquisition-tone.md",
  ]);

  const approvedSections = (project.sections ?? [])
    .filter((section) => section.content?.trim())
    .map((section) => section.content)
    .join("\n\n")
    .slice(0, 6000);

  const llm = await tryGenerateJson(llmEmailSchema, {
    maxTokens: 900,
    temperature: 0.4,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Draft the companion email that goes with this proposal, in an operator-to-founder voice.

${rules}

Client: ${project.clientName}
Contact: ${project.contactName || "the founder"}
Extracted facts:
${JSON.stringify(project.extractedFacts ?? {}, null, 2)}

Proposal content for reference:
${approvedSections || "Not generated yet; base the email on the facts."}

Hard rules (validated by the app after generation):
- The subject line MUST reference Move Supply Chain.
- EXACTLY ONE call to action in the whole email, phrased as one clear question.
- 3 to 4 crisp bullets maximum summarizing the recommendation.
- Never use "just checking in", "wanted to follow up", "touching base", or "circling back".
- No em dashes. No hype. Specific to this client.

Return ONLY a JSON object: {"subject": string, "body": string}`,
      },
    ],
  });

  const email: CompanionEmail = llm.data
    ? scrubEmDashes({ ...llm.data, createdAt: new Date().toISOString() })
    : draftCompanionEmail(project);

  return NextResponse.json({
    email,
    validation: validateCompanionEmail(email),
    generation: llm.generation,
  });
}
