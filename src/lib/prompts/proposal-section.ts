export const proposalSectionPrompt = `Task:
Draft Section {{SECTION_NUMBER}}: {{SECTION_TITLE}} for a Move Supply Chain proposal.

Current client facts:
{{EXTRACTED_FACTS}}

Approved previous sections:
{{APPROVED_SECTIONS}}

Relevant Move references:
{{RETRIEVED_CONTEXT}}

Section requirements:
{{SECTION_REQUIREMENTS}}

Rules:
- Write only this section.
- Follow Move tone.
- Make it specific to this client.
- Use only confirmed facts unless clearly labeled as assumptions.
- Do not repeat the entire proposal.
- Do not include sections that come later.
- Do not include pricing unless pricing is confirmed or the section requires TBD.
- Use clean headings and bullets.
- No em dashes.
- Do not overpromise.
- Output clean Markdown.`;
