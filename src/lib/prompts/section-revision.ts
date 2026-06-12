export const sectionRevisionPrompt = `Task:
Revise the active proposal section based on the user's instruction.

User instruction:
{{USER_MESSAGE}}

Current section:
{{CURRENT_SECTION}}

Client facts:
{{EXTRACTED_FACTS}}

Approved previous sections:
{{APPROVED_SECTIONS}}

Relevant references:
{{RETRIEVED_CONTEXT}}

Rules:
- Revise only the active section unless the user explicitly asks for a broader change.
- Preserve accurate client facts.
- Do not invent details.
- Keep Move tone.
- No em dashes.
- Output the full revised section in Markdown.
- After the section, include a short assistant note explaining what changed.`;
