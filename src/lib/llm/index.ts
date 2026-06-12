import "server-only";
import type { ZodType } from "zod";
import { createAnthropicProvider } from "@/lib/llm/providers/anthropic";
import { createCodexProvider } from "@/lib/llm/providers/codex";
import { createOpenAIProvider } from "@/lib/llm/providers/openai";
import type { LLMGenerateInput } from "@/lib/llm/types";
import type { GenerationMeta } from "@/lib/types";

export function getLLMProvider() {
  const selected = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  if (selected === "codex") return createCodexProvider();
  if (selected === "openai") return createOpenAIProvider();
  return createAnthropicProvider();
}

export function getLLMStatus() {
  const anthropic = createAnthropicProvider();
  const openai = createOpenAIProvider();
  const codex = createCodexProvider();
  const active = getLLMProvider();

  return {
    provider: active.name,
    activeModel: active.model,
    activeConfigured: active.configured,
    anthropicConfigured: anthropic.configured,
    openaiConfigured: openai.configured,
    codexConfigured: codex.configured,
  };
}

export type LastLLMCall = {
  at: string;
  ok: boolean;
  provider: string;
  model: string;
  error?: string;
};

// Per-process record of the most recent LLM call so the header badge can
// report "Live AI" vs "Fallback mode" truthfully. Resets on server restart.
let lastCall: LastLLMCall | null = null;

export function getLastLLMCall() {
  return lastCall;
}

export async function generateWithLLM(input: LLMGenerateInput) {
  const provider = getLLMProvider();
  try {
    const output = await provider.generate(input);
    lastCall = { at: new Date().toISOString(), ok: true, provider: output.provider, model: output.model };
    return output;
  } catch (error) {
    lastCall = {
      at: new Date().toISOString(),
      ok: false,
      provider: provider.name,
      model: provider.model,
      error: error instanceof Error ? error.message : "LLM call failed",
    };
    throw error;
  }
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
  const provider = getLLMProvider();
  if (!provider.configured) {
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
  const provider = getLLMProvider();
  if (!provider.configured) {
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
