import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeCategory, KnowledgeChunk, KnowledgeReference } from "@/lib/types";
import { makeId } from "@/lib/utils";

const contentRoot = path.join(process.cwd(), "content");

const categoryByPath: Record<string, KnowledgeCategory> = {
  playbooks: "playbook",
  "proposal-library": "proposal_precedent",
  "email-examples": "email_tone",
  "case-studies": "case_study",
  "client-acquisition": "lead_qualification",
  "market-signals": "market_signal",
};

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith(".md")) return [entryPath];
      return [];
    }),
  );
  return files.flat();
}

export function chunkText(referenceId: string, title: string, text: string, category: KnowledgeCategory) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: KnowledgeChunk[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > 1600 && current) {
      chunks.push({
        id: makeId("chunk"),
        referenceId,
        title,
        text: current,
        tags: [],
        sourceType: "local_content",
        category,
      });
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) {
    chunks.push({
      id: makeId("chunk"),
      referenceId,
      title,
      text: current,
      tags: [],
      sourceType: "local_content",
      category,
    });
  }

  return chunks;
}

/**
 * Read specific playbook files (relative to content/) for prompt context.
 * Missing files are skipped silently so a renamed playbook never breaks a route.
 */
export async function readContentFiles(relativePaths: string[]) {
  const parts = await Promise.all(
    relativePaths.map(async (relativePath) => {
      try {
        const text = await fs.readFile(path.join(contentRoot, relativePath), "utf8");
        return `--- ${relativePath} ---\n${text.trim()}`;
      } catch {
        return "";
      }
    }),
  );
  return parts.filter(Boolean).join("\n\n");
}

export async function indexLocalContent(): Promise<KnowledgeReference[]> {
  const files = await listMarkdownFiles(contentRoot);
  const references = await Promise.all(
    files.map(async (filePath) => {
      const text = await fs.readFile(filePath, "utf8");
      const relativePath = path.relative(contentRoot, filePath);
      const topFolder = relativePath.split(path.sep)[0] ?? "other";
      const category = categoryByPath[topFolder] ?? "other";
      const title = path.basename(filePath, ".md").replace(/-/g, " ");
      const id = makeId("ref");
      const chunks = chunkText(id, title, text, category);

      return {
        id,
        title,
        sourceType: "local_content" as const,
        category,
        sourcePath: relativePath,
        text,
        chunks,
        importedAt: new Date().toISOString(),
      };
    }),
  );

  return references;
}

export async function searchLocalContent(query: string, limit = 6) {
  const references = await indexLocalContent();
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  const scored = references
    .flatMap((reference) => reference.chunks)
    .map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);

  return scored;
}

export async function contentStats() {
  const references = await indexLocalContent();
  return {
    playbooks: references.filter((item) => item.sourcePath?.startsWith("playbooks")).length,
    proposalLibrary: references.filter((item) => item.sourcePath?.startsWith("proposal-library")).length,
    clientAcquisition: references.filter((item) => item.sourcePath?.startsWith("client-acquisition")).length,
    chunks: references.reduce((total, item) => total + item.chunks.length, 0),
  };
}
