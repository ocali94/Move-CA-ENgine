export const callPrepPrompt = `Task:
Create a discovery call battle card for Move Supply Chain.

Inputs:
{{CALL_INTAKE}}

Website or brand notes:
{{BRAND_CONTEXT}}

Relevant Move service paths:
{{SERVICE_PATHS}}

Return valid JSON only with brand snapshot, pain map, 8 to 10 diagnostic questions, probable service path, things to verify, things to avoid, suggested call angle, copy-ready summary, and assumptions.

Rules:
- Make questions specific.
- Do not invent facts.
- No em dashes.`;
