import { ProposalLibraryClient } from "@/components/modules/proposal-library-client";
import { indexLocalContent } from "@/lib/content";

export default async function ProposalLibraryPage() {
  const references = await indexLocalContent();
  return <ProposalLibraryClient references={references.map((ref) => ({ title: ref.title, category: ref.category, sourcePath: ref.sourcePath, chunks: ref.chunks.length }))} />;
}
