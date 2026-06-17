import "server-only";
import { createOpenAIProvider } from "@/lib/llm/providers/openai";
import type { LLMProvider } from "@/lib/llm/types";

/**
 * Gemini via Google's OpenAI-compatible endpoint. It reuses the OpenAI
 * provider's request logic but with its own key/model/base URL so it can be
 * configured at the same time as another OpenAI-compatible provider (used as
 * the automatic backup for Codex). Reasoning defaults to "none" because
 * gemini-2.5 otherwise spends the token budget on thinking and truncates JSON.
 */
export function createGeminiProvider(): LLMProvider {
  return createOpenAIProvider({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    baseUrl: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
    name: "gemini",
    reasoningEffort: process.env.GEMINI_REASONING_EFFORT ?? "none",
  });
}
