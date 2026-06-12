import "server-only";
import { z } from "zod";
import { readContentFiles } from "@/lib/content";
import { tryGenerateJson } from "@/lib/llm";
import { masterSystemPrompt } from "@/lib/prompts/master-system";
import { makeId, scrubEmDashes } from "@/lib/utils";
import { buildCampaignSignal } from "@/lib/workflows/market";
import type { CampaignSignal, DemandPulse } from "@/lib/types";

const llmCampaignSchema = z.object({
  headline: z.string(),
  whatChangedThisWeek: z.array(z.string()).min(2),
  whatItMeansForDtc: z.array(z.string()).min(2),
  campaignAngles: z.array(z.string()).min(2).max(3),
  tweets: z.array(z.string()).min(3).max(5),
});

/**
 * Campaign Signal: LLM-written from the actually fetched numbers when a key
 * is configured, deterministic from the same numbers otherwise. The LLM only
 * interprets data after retrieval; it never supplies market numbers itself.
 */
export async function generateCampaignSignal(pulse: DemandPulse): Promise<CampaignSignal> {
  const fallback = buildCampaignSignal(pulse);

  const usableSignals = pulse.signals.filter((signal) => signal.value !== null);
  if (!usableSignals.length || pulse.score === null) {
    return { ...fallback, generation: { mode: "fallback", reason: "No fetched market numbers to interpret." } };
  }

  const rules = await readContentFiles([
    "market-signals/campaign-signal-rules.md",
    "playbooks/move-market-signals-rules.md",
  ]);

  const dataBlock = usableSignals
    .map(
      (signal) =>
        `${signal.name} (${signal.id}): current ${signal.value}${signal.unit ? ` ${signal.unit}` : ""}, trend ${signal.trend}, last reading ${signal.updatedAt}, source ${signal.source}${signal.dataMode ? `, data mode ${signal.dataMode}` : ""}`,
    )
    .join("\n");

  const llm = await tryGenerateJson(llmCampaignSchema, {
    maxTokens: 1400,
    temperature: 0.4,
    messages: [
      { role: "system", content: masterSystemPrompt },
      {
        role: "user",
        content: `Write this week's Campaign Signal brief for Move Supply Chain's marketing team.

${rules}

Fetched market data (the ONLY numbers you may reference; never invent or estimate other figures):
${dataBlock}

Demand Pulse composite: ${pulse.score}/100, status ${pulse.status}, trend ${pulse.trend}.

Produce four blocks:
1. whatChangedThisWeek: 3 to 6 short lines, each naming a signal with its actual current value and direction in plain English.
2. whatItMeansForDtc: 2 to 4 lines translating the movement into inventory, sourcing, logistics, COGS, margin, and cash implications for $1M to $50M DTC physical goods brands. Zero economics jargon.
3. campaignAngles: 2 to 3 concrete angles for what Move should campaign on right now (content, social, outbound), each tied to the data direction.
4. tweets: 3 to 5 ready-to-post tweets for Move's account, written in an operator voice for DTC founders. Each under 270 characters, references a real number or direction from the data above, no invented figures, no hype, no emoji walls, at most one hashtag total across all tweets. They should feel like a sharp operator reading the market out loud, not marketing copy.

Return ONLY a JSON object: {"headline": string, "whatChangedThisWeek": string[], "whatItMeansForDtc": string[], "campaignAngles": string[], "tweets": string[]}`,
      },
    ],
  });

  if (llm.data) {
    return scrubEmDashes({
      id: makeId("campaign"),
      createdAt: new Date().toISOString(),
      ...llm.data,
      riskLevel: fallback.riskLevel,
      confidenceNote: fallback.confidenceNote,
      generation: llm.generation,
    });
  }

  return { ...fallback, generation: llm.generation };
}
