export const leadQualifierPrompt = `Task:
Qualify this brand against Move Supply Chain's ICP.

Inputs:
{{BRAND_INPUTS}}

Move ICP:
{{ICP_RULES}}

Return valid JSON only with fit score, verdict, score reasons, ICP checks, disqualifiers, pain signals, buyer signals, one personalization hook, recommended next action, CRM summary, assumptions, and missing info.

Rules:
- Do not invent facts.
- If using estimates, label them as estimates.
- One personalization hook must be specific, not generic.
- No em dashes.`;
