import { NextResponse } from "next/server";
import { z } from "zod";
import { searchLocalContent } from "@/lib/content";
import { requireApiUser } from "@/lib/server-auth";

const searchSchema = z.object({
  query: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = searchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const chunks = await searchLocalContent(body.data.query);
  return NextResponse.json({ chunks });
}
