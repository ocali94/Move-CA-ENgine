import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server-auth";
import { fetchWebsiteText } from "@/lib/website-fetch";

const fetchSchema = z.object({
  url: z.string().min(3),
});

// Shared website fetcher. Always returns 200 with an `ok` flag so a failed
// fetch can never break a module workflow; callers show a notice and continue.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = fetchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Provide a website URL to fetch." });
  }

  const result = await fetchWebsiteText(body.data.url);
  return NextResponse.json(result);
}
