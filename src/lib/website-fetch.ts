import "server-only";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 8_000;

export type WebsiteFetchResult =
  | { ok: true; url: string; title: string; description: string; text: string }
  | { ok: false; url: string; error: string };

export function looksLikeUrl(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s"'<>]+|(?:^|\s)((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?)/i);
  if (!match) return null;
  const raw = (match[0].startsWith("http") ? match[0] : match[1])?.trim();
  if (!raw) return null;
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]"
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToReadableText(html: string) {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

  const title = decodeEntities(withoutBlocks.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const description = decodeEntities(
    withoutBlocks.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ??
      withoutBlocks.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
      "",
  );

  const headings = [...withoutBlocks.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 24);

  const body = decodeEntities(
    withoutBlocks
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 2)
    .join("\n");

  const combined = [
    title ? `Title: ${title}` : "",
    description ? `Description: ${description}` : "",
    headings.length ? `Headings:\n${headings.join("\n")}` : "",
    body ? `Page text:\n${body}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { title, description, text: combined.slice(0, MAX_TEXT_CHARS) };
}

export async function fetchWebsiteText(rawUrl: string): Promise<WebsiteFetchResult> {
  const normalized = looksLikeUrl(rawUrl);
  if (!normalized) {
    return { ok: false, url: rawUrl, error: "That does not look like a valid website URL." };
  }

  const url = new URL(normalized);
  if (isBlockedHost(url.hostname)) {
    return { ok: false, url: normalized, error: "Local and private network addresses are not allowed." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MoveCAEngine/1.0; internal research tool)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return { ok: false, url: normalized, error: `The site responded with status ${response.status}.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return { ok: false, url: normalized, error: `The URL returned ${contentType || "an unknown format"}, not a web page.` };
    }

    const html = await response.text();
    const { title, description, text } = htmlToReadableText(html);

    if (!text.trim()) {
      return { ok: false, url: normalized, error: "The page loaded but no readable text could be extracted." };
    }

    return { ok: true, url: normalized, title, description, text };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      url: normalized,
      error: aborted ? "The site took longer than 10 seconds to respond." : "The site could not be reached.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
