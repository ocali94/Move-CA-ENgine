export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMGenerateInput = {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
};

export type LLMGenerateOutput = {
  content: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type LLMProvider = {
  name: string;
  model: string;
  configured: boolean;
  generate(input: LLMGenerateInput): Promise<LLMGenerateOutput>;
};
