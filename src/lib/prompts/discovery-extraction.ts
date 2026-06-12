export const discoveryExtractionPrompt = `Task:
Extract structured proposal facts from the discovery notes.

Return valid JSON only.

Discovery notes:
{{DISCOVERY_NOTES}}

Existing project fields:
{{PROJECT_FIELDS}}

Related Lead Qualifier output:
{{LEAD_QUALIFIER_RESULT}}

Related Call Prep output:
{{CALL_PREP_RESULT}}

Rules:
- Do not invent missing facts.
- Use exact phrases from the notes when useful.
- Pain points must include evidence.
- If confidence is low, explain why in assumptions or missingInfo.
- Return JSON only.
- No em dashes.`;
