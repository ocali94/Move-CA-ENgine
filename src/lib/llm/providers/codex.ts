import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LLMGenerateInput, LLMGenerateOutput, LLMProvider } from "@/lib/llm/types";

const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

type CodexCreds = { accessToken: string; accountId: string } | null;

function decodeJwtAccountId(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json);
    return claims?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the ChatGPT/Codex OAuth access token. Source priority:
 *   1. CODEX_ACCESS_TOKEN env var (with CODEX_ACCOUNT_ID, optional).
 *   2. A Hermes-style auth.json at CODEX_AUTH_FILE (default ~/.hermes/auth.json).
 * Read fresh each call so a re-auth is picked up without a restart.
 */
function readCodexCreds(): CodexCreds {
  const envToken = process.env.CODEX_ACCESS_TOKEN?.trim();
  if (envToken) {
    return { accessToken: envToken, accountId: process.env.CODEX_ACCOUNT_ID?.trim() || decodeJwtAccountId(envToken) || "" };
  }

  const file = process.env.CODEX_AUTH_FILE?.trim() || path.join(os.homedir(), ".hermes", "auth.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const token: string | undefined =
      data?.providers?.["openai-codex"]?.tokens?.access_token ?? data?.tokens?.access_token;
    if (!token) return null;
    return { accessToken: token, accountId: process.env.CODEX_ACCOUNT_ID?.trim() || decodeJwtAccountId(token) || "" };
  } catch {
    return null;
  }
}

function toResponsesInput(messages: LLMGenerateInput["messages"]) {
  const instructions = messages.find((m) => m.role === "system")?.content ?? "";
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      type: "message" as const,
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    }));
  return { instructions, input };
}

/**
 * Parse the Codex SSE stream, accumulating output_text deltas and capturing
 * usage from the completed event.
 */
async function readResponsesStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: { inputTokens?: number; outputTokens?: number } | undefined;

  const handle = (payload: string) => {
    if (!payload || payload === "[DONE]") return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    const type = String(event.type ?? "");
    if (type === "response.output_text.delta" && typeof event.delta === "string") {
      text += event.delta;
    } else if (type === "response.completed") {
      const response = event.response as Record<string, unknown> | undefined;
      const u = response?.usage as Record<string, number> | undefined;
      if (u) usage = { inputTokens: u.input_tokens, outputTokens: u.output_tokens };
      // Fallback: pull text from the final output if no deltas arrived.
      if (!text && Array.isArray(response?.output)) {
        for (const item of response!.output as Array<Record<string, unknown>>) {
          for (const part of (item.content as Array<Record<string, unknown>>) ?? []) {
            if (typeof part.text === "string") text += part.text;
          }
        }
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const block of events) {
      for (const line of block.split("\n")) {
        if (line.startsWith("data:")) handle(line.slice(5).trim());
      }
    }
  }
  return { text, usage };
}

export function createCodexProvider(): LLMProvider {
  const creds = readCodexCreds();
  const model = process.env.CODEX_MODEL ?? "gpt-5.5";
  const reasoningEffort = process.env.CODEX_REASONING_EFFORT ?? "low";

  return {
    name: "codex",
    model,
    configured: Boolean(creds?.accessToken),
    async generate(input: LLMGenerateInput): Promise<LLMGenerateOutput> {
      const live = readCodexCreds();
      if (!live?.accessToken) {
        throw new Error("Codex is not configured. Sign in with `codex` and point CODEX_AUTH_FILE at the auth.json.");
      }

      const { instructions, input: responsesInput } = toResponsesInput(input.messages);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(CODEX_RESPONSES_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${live.accessToken}`,
            "chatgpt-account-id": live.accountId,
            "OpenAI-Beta": "responses=experimental",
            originator: "codex_cli_rs",
            session_id: crypto.randomUUID(),
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body: JSON.stringify({
            model,
            instructions,
            input: responsesInput,
            tools: [],
            tool_choice: "auto",
            parallel_tool_calls: false,
            store: false,
            stream: true,
            include: [],
            reasoning: { effort: reasoningEffort },
          }),
        });

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Codex request failed with status ${response.status}. ${detail.slice(0, 180)}`);
        }

        const { text, usage } = await readResponsesStream(response.body);
        if (!text.trim()) throw new Error("Codex returned an empty response.");
        return { content: text, provider: "codex", model, usage };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
