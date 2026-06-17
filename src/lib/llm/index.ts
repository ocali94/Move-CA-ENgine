import "server-only";
import type { ZodType } from "zod";
import { createAnthropicProvider } from "@/lib/llm/providers/anthropic";
import { createCodexProvider } from "@/lib/llm/providers/codex";
import { createGeminiProvider } from "@/lib/llm/providers/gemini";
import { createOpenAIProvider } from "@/lib/llm/providers/openai";
import type { LLMProvider, LLMGenerateInput } from "@/lib/llm/types";
import type { GenerationMeta } from "@/lib/types";

export const KNOWN_PROVIDERS = ["codex", "gemini", "openai", "anthropic"] as const;
export type ProviderName = (typeof KNOWN_PROVIDERS)[number];

function createProviderByName(name: string): LLMProvider {
  switch (name.toLowerCase()) {
    case "codex":
      return createCodexProvider();
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAIProvider();
    default:
      return createAnthropicProvider();
  }
}

const dedupe = (names: string[]) => [...new Set(names.filter(Boolean))];

// The default order comes from env: LLM_PROVIDER is primary, then any
// comma-separated LLM_FALLBACK_PROVIDERS. Each is tried in turn until one
// succeeds, so a rate-limited or down primary degrades to the backup instead
// of to local fallback logic.
function baseChainNames(): string[] {
  const primary = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const fallbacks = (process.env.LLM_FALLBACK_PROVIDERS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return dedupe([primary, ...fallbacks]);
}

// Runtime override (per process, resets on restart) so the team can force a
// provider to the front from the header switcher. null = follow env order.
let providerOverride: string | null = null;

export function setProviderOverride(name: string | null) {
  providerOverride = name && name !== "auto" ? name.toLowerCase() : null;
}

export function getProviderOverride(): string {
  return providerOverride ?? "auto";
}

export function resolveChainNames(): string[] {
  const base = baseChainNames();
  if (providerOverride) return dedupe([providerOverride, ...base]);
  return base;
}

export function getProviderChain(): LLMProvider[] {
  return resolveChainNames().map(createProviderByName);
}

/** First provider that would actually run (the first configured one in order). */
export function getLLMProvider(): LLMProvider {
  const chain = getProviderChain();
  return chain.find((provider) => provider.configured) ?? chain[0] ?? createAnthropicProvider();
}

export function getLLMStatus() {
  // Display the chain in stable base (env) order so the switcher menu does not
  // reshuffle when an override is set; "active" reflects the override.
  const baseNames = baseChainNames();
  const chain = baseNames.map((name) => {
    const provider = createProviderByName(name);
    return { name, model: provider.model, configured: provider.configured };
  });
  const activeName = resolveChainNames().find((name) => createProviderByName(name).configured);
  const active = chain.find((entry) => entry.name === activeName) ?? chain.find((entry) => entry.configured) ?? chain[0];
  const configuredByName = (name: ProviderName) =>
    chain.find((entry) => entry.name === name)?.configured ?? createProviderByName(name).configured;

  return {
    provider: active?.name ?? "none",
    activeModel: active?.model ?? "",
    activeConfigured: Boolean(active?.configured),
    primary: baseNames[0] ?? "none",
    override: getProviderOverride(),
    chain,
    // Legacy flags consumed by /setup; kept so that page need not change.
    anthropicConfigured: configuredByName("anthropic"),
    openaiConfigured: configuredByName("openai"),
    codexConfigured: configuredByName("codex"),
    geminiConfigured: configuredByName("gemini"),
  };
}

export type LastLLMCall = {
  at: string;
  ok: boolean;
  provider: string;
  model: string;
  error?: string;
  // Providers tried and skipped before this result, with why. Lets the header
  // show "failed over from codex" instead of silently switching.
  skipped?: { provider: string; error: string }[];
};

// Per-process record of the most recent LLM call so the header badge can
// report "Live AI" vs "Fallback mode" truthfully. Resets on server restart.
let lastCall: LastLLMCall | null = null;

export function getLastLLMCall() {
  return lastCall;
}

/**
 * Run the provider chain in order, returning the first success. A failure
 * (timeout, rate limit, bad key) moves to the next configured provider rather
 * than throwing, so Codex hitting its usage limit transparently degrades to
 * Gemini. Only when every provider fails does this throw.
 */
export async function generateWithLLM(input: LLMGenerateInput) {
  const chain = getProviderChain().filter((provider) => provider.configured);
  const at = () => new Date().toISOString();

  if (!chain.length) {
    const error = new Error("No LLM provider is configured.");
    lastCall = { at: at(), ok: false, provider: "none", model: "", error: error.message };
    throw error;
  }

  const skipped: { provider: string; error: string }[] = [];
  let lastError: unknown = null;

  for (const provider of chain) {
    try {
      const output = await provider.generate(input);
      lastCall = {
        at: at(),
        ok: true,
        provider: output.provider,
        model: output.model,
        skipped: skipped.length ? [...skipped] : undefined,
      };
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM call failed";
      lastError = error;
      skipped.push({ provider: provider.name, error: message });
      lastCall = { at: at(), ok: false, provider: provider.name, model: provider.model, error: message };
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All LLM providers failed.");
}

function extractJson(content: string) {
  const withoutFences = content.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }
  return withoutFences.slice(start, end + 1);
}

export type LLMJsonResult<T> =
  | { data: T; generation: GenerationMeta }
  | { data: null; generation: GenerationMeta };

/**
 * Try the configured LLM and validate its JSON output against a schema.
 * Never throws: a missing key, timeout, or malformed response returns
 * `data: null` with a fallback GenerationMeta explaining why, so every
 * workflow can degrade to its deterministic path visibly.
 */
export async function tryGenerateJson<T>(
  schema: ZodType<T>,
  input: LLMGenerateInput,
): Promise<LLMJsonResult<T>> {
  if (!getProviderChain().some((provider) => provider.configured)) {
    return {
      data: null,
      generation: { mode: "fallback", reason: "No LLM API key is configured." },
    };
  }

  try {
    const output = await generateWithLLM({ ...input, responseFormat: "json" });
    const parsed = schema.parse(JSON.parse(extractJson(output.content)));
    return {
      data: parsed,
      generation: { mode: "llm", provider: output.provider, model: output.model },
    };
  } catch (error) {
    return {
      data: null,
      generation: {
        mode: "fallback",
        reason: `LLM call failed: ${error instanceof Error ? error.message : "unknown error"}`,
      },
    };
  }
}

/**
 * Same contract as tryGenerateJson but for plain-text/Markdown output.
 */
export async function tryGenerateText(
  input: LLMGenerateInput,
): Promise<LLMJsonResult<string>> {
  if (!getProviderChain().some((provider) => provider.configured)) {
    return {
      data: null,
      generation: { mode: "fallback", reason: "No LLM API key is configured." },
    };
  }

  try {
    const output = await generateWithLLM(input);
    if (!output.content.trim()) throw new Error("LLM returned an empty response.");
    return {
      data: output.content.trim(),
      generation: { mode: "llm", provider: output.provider, model: output.model },
    };
  } catch (error) {
    return {
      data: null,
      generation: {
        mode: "fallback",
        reason: `LLM call failed: ${error instanceof Error ? error.message : "unknown error"}`,
      },
    };
  }
}
