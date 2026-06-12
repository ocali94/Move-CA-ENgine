export const marketSignalPrompt = `Task:
Interpret the latest market signal data for Move Supply Chain.

Market data:
{{MARKET_DATA}}

Rules:
- Do not invent numbers.
- Use only supplied data.
- Explain in plain English.
- Focus on $1M to $50M DTC physical goods brands.
- Connect the signal to inventory, sourcing, logistics, COGS, margin, and cash.
- Give 2 to 3 campaign angles.
- Give 2 to 3 outbound angles.
- No em dashes.
- Keep it practical.

Return valid JSON only.`;
