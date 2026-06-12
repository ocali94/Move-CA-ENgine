import "server-only";
import type { LLMGenerateInput, LLMGenerateOutput, LLMProvider } from "@/lib/llm/types";

const anthropicVersion = "2023-06-01";

export function createAnthropicProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

  return {
    name: "anthropic",
    model,
    configured: Boolean(apiKey),
    async generate(input: LLMGenerateInput): Promise<LLMGenerateOutput> {
      if (!apiKey) {
        throw new Error("Claude is not configured yet. Add ANTHROPIC_API_KEY, then reload the app.");
      }

      const system = input.messages.find((message) => message.role === "system")?.content;
      const messages = input.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": anthropicVersion,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            max_tokens: input.maxTokens ?? 1800,
            temperature: input.temperature ?? 0.2,
            system,
            messages,
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic request failed with status ${response.status}.`);
        }

        const data = await response.json();
        const content = Array.isArray(data.content)
          ? data.content
              .map((item: { type?: string; text?: string }) => (item.type === "text" ? item.text : ""))
              .join("")
          : "";

        return {
          content,
          provider: "anthropic",
          model,
          usage: {
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          },
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
