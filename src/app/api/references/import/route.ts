import { NextResponse } from "next/server";
import { z } from "zod";
import { chunkText } from "@/lib/content";
import { requireApiUser } from "@/lib/server-auth";
import type { KnowledgeReference } from "@/lib/types";
import { makeId } from "@/lib/utils";

const importSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  category: z
    .enum([
      "proposal_precedent",
      "playbook",
      "email_tone",
      "pricing_benchmark",
      "case_study",
      "discovery_note",
      "lead_qualification",
      "market_signal",
      "other",
    ])
    .default("other"),
});

// Pasted-text references only. The content/ folder is the app's reference
// library; this exists so a one-off precedent can be attached to a project.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = importSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Provide a title and the pasted reference text." }, { status: 400 });
  }

  const id = makeId("ref");
  const reference: KnowledgeReference = {
    id,
    title: body.data.title,
    sourceType: "pasted_reference",
    category: body.data.category,
    text: body.data.text,
    chunks: chunkText(id, body.data.title, body.data.text, body.data.category).map((chunk) => ({
      ...chunk,
      sourceType: "pasted_reference",
    })),
    importedAt: new Date().toISOString(),
  };

  return NextResponse.json({ reference });
}
