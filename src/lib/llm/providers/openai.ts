import "server-only";
import type { LLMGenerateInput, LLMGenerateOutput, LLMProvider } from "@/lib/llm/types";

export function createOpenAIProvider(): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.1";
  // Any OpenAI-compatible endpoint works (e.g. Google's Gemini compat layer
  // at https://generativelanguage.googleapis.com/v1beta/openai).
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const name = baseUrl.includes("api.openai.com") ? "openai" : "openai-compatible";
  // For reasoning models (gpt-5 family, gemini-2.5), "none"/"low" stops
  // thinking tokens from eating the max_tokens budget and truncating JSON.
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;

  return {
    name,
    model,
    configured: Boolean(apiKey),
    async generate(input: LLMGenerateInput): Promise<LLMGenerateOutput> {
      if (!apiKey) {
        throw new Error("OpenAI is not configured yet. Add OPENAI_API_KEY, then reload the app.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: input.messages,
            temperature: input.temperature ?? 0.2,
            max_tokens: input.maxTokens ?? 1800,
            response_format: input.responseFormat === "json" ? { type: "json_object" } : undefined,
            reasoning_effort: reasoningEffort || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI request failed with status ${response.status}.`);
        }

        const data = await response.json();
        return {
          content: data.choices?.[0]?.message?.content ?? "",
          provider: name,
          model,
          usage: {
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          },
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
