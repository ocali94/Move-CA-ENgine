export const companionEmailPrompt = `Task:
Draft a proposal email in Omar or Move Supply Chain voice.

Client facts:
{{EXTRACTED_FACTS}}

Final proposal:
{{FINAL_PROPOSAL}}

Rules:
- Warm and direct.
- Not salesy.
- Mention the specific client context.
- Briefly summarize the recommendation.
- Include 2 to 4 bullets.
- Clear next step.
- No em dashes.
- Do not over-explain.
- Do not sound generic.
- Output subject line and email body.`;
