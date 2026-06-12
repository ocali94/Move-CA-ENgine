import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server-auth";
import { exportProposalHtml, exportProposalMarkdown } from "@/lib/workflows/proposal";

const exportSchema = z.object({
  project: z.record(z.string(), z.unknown()),
  format: z.enum(["markdown", "html"]),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = exportSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Project and export format are required." }, { status: 400 });
  }

  return NextResponse.json({
    content:
      body.data.format === "html"
        ? exportProposalHtml(body.data.project as never)
        : exportProposalMarkdown(body.data.project as never),
  });
}
