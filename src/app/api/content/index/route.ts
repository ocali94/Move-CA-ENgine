import { NextResponse } from "next/server";
import { contentStats, indexLocalContent } from "@/lib/content";
import { requireApiUser } from "@/lib/server-auth";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const [references, stats] = await Promise.all([indexLocalContent(), contentStats()]);
  return NextResponse.json({
    references: references.map((reference) => ({
      id: reference.id,
      title: reference.title,
      category: reference.category,
      sourcePath: reference.sourcePath,
      chunks: reference.chunks.length,
    })),
    stats,
  });
}
