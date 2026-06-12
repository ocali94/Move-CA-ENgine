import { MOVE_OFFICIAL_ROLES, SECTION_TITLES, option3Justified } from "@/lib/proposal-rules";
import type {
  CompanionEmail,
  DiscoveryExtraction,
  PainPoint,
  ProposalProject,
  ProposalSection,
} from "@/lib/types";
import { makeId, withoutEmDash } from "@/lib/utils";

export const proposalSectionTemplates = SECTION_TITLES;

export function createProposalProject(input?: Partial<ProposalProject>): ProposalProject {
  const now = new Date().toISOString();
  return {
    id: makeId("proposal"),
    createdAt: now,
    updatedAt: now,
    clientName: input?.clientName || "New client",
    website: input?.website,
    contactName: input?.contactName,
    contactRole: input?.contactRole,
    leadSource: input?.leadSource,
    discoveryDate: input?.discoveryDate,
    revenueRange: input?.revenueRange,
    skuCount: input?.skuCount,
    annualPoValue: input?.annualPoValue,
    productCategory: input?.productCategory,
    sellingChannels: input?.sellingChannels ?? [],
    warehouseSetup: input?.warehouseSetup,
    knownRegions: input?.knownRegions ?? [],
    currentSupplierNotes: input?.currentSupplierNotes,
    internalOwner: input?.internalOwner,
    proposalOwner: input?.proposalOwner,
    rawDiscoveryText: input?.rawDiscoveryText ?? "",
    extractedFacts: input?.extractedFacts,
    references: input?.references ?? [],
    chatMessages: input?.chatMessages ?? [],
    companionEmail: input?.companionEmail,
    sections:
      input?.sections ??
      proposalSectionTemplates.map((title, index) => ({
        id: makeId("section"),
        number: index + 1,
        title,
        status: "not_started",
        content: "",
        sourceChunkIds: [],
        revisionHistory: [],
      })),
  };
}

export function extractDiscoveryFacts(notes: string, project?: Partial<ProposalProject>): DiscoveryExtraction {
  const text = notes.toLowerCase();
  const companyName = project?.clientName && project.clientName !== "New client" ? project.clientName : extractCompany(notes);
  const painPoints = buildPainPoints(notes);
  const servicePath = recommendServicePath(painPoints);

  return {
    companyName: companyName || null,
    website: project?.website || extractWebsite(notes) || null,
    contactNames: extractNamedLine(notes, "contact"),
    contactRoles: extractRoles(text),
    productCategory: project?.productCategory || inferCategory(text),
    productsMentioned: extractProducts(text),
    revenue: project?.revenueRange || extractRevenue(notes),
    skuCount: project?.skuCount || extractSku(notes),
    annualPoValue: project?.annualPoValue || extractPoValue(notes),
    sellingChannels: project?.sellingChannels?.length ? project.sellingChannels : extractChannels(text),
    warehouseSetup: project?.warehouseSetup || extractWarehouse(notes),
    currentSuppliers: extractSuppliers(notes),
    productionRegions: project?.knownRegions?.length ? project.knownRegions : extractRegions(text),
    freightOr3plSetup: extractFreight(notes),
    painPoints,
    repeatedPhrases: extractRepeatedPhrases(notes),
    urgencySignals: extractSignals(text, ["urgent", "launch", "q1", "q2", "q3", "q4", "deadline", "late", "behind"]),
    budgetSignals: extractSignals(text, ["budget", "investment", "cost", "margin", "cash", "price", "pricing"]),
    decisionMakers: extractSignals(text, ["founder", "coo", "operations", "ops", "finance", "ecommerce"]),
    desiredOutcomes: extractSignals(text, ["visibility", "control", "reduce", "improve", "faster", "protect", "launch"]),
    constraints: extractSignals(text, ["limited", "small team", "bandwidth", "cash", "timeline", "capacity"]),
    risks: extractSignals(text, ["stockout", "overstock", "late", "quality", "margin", "freight", "supplier"]),
    missingInfo: [
      project?.revenueRange || extractRevenue(notes) ? "" : "Confirmed revenue range",
      project?.skuCount || extractSku(notes) ? "" : "Confirmed SKU count",
      extractSuppliers(notes).length ? "" : "Current supplier count and supplier regions",
      extractFreight(notes) ? "" : "Current freight, 3PL, and warehouse setup",
      extractPoValue(notes) ? "" : "Annual PO value",
    ].filter(Boolean),
    recommendedServicePath: servicePath,
    servicePathRationale: painPoints.length
      ? `The strongest signals point to ${painPoints
          .slice(0, 2)
          .map((pain) => pain.category.replace("_", " "))
          .join(" and ")}.`
      : "More discovery context is needed before a confident recommendation.",
    pricingSignals: extractSignals(text, ["price", "budget", "cost", "investment", "retainer", "$"]),
    internalFollowups: [
      "Confirm pricing internally before including final investment.",
      "Confirm whether the proposal should be DWY, DFY, trial, or fractional support.",
      "Confirm what success should look like in the first 30 days.",
    ],
    confidenceScore: Math.min(95, 35 + painPoints.length * 10 + (notes.length > 900 ? 20 : 0)),
    assumptions: ["Facts are extracted only from the discovery notes and project fields."],
  };
}

type TrialPackage = {
  name: string;
  focus: string;
  benchmark: string;
  duration: string;
  roles: string[];
};

function trialForPath(servicePath: string | null | undefined): TrialPackage {
  const path = (servicePath ?? "").toLowerCase();
  if (path.includes("logistics")) {
    return {
      name: "Option 1: 30-Day Logistics Optimization Trial",
      focus: "Review freight, 3PL, routing, and landed cost; compare quotes and surface the fastest cost reductions.",
      benchmark: "$2,000",
      duration: "4 weeks",
      roles: ["Logistics Specialist", "Supply Chain Manager", "Project Manager"],
    };
  }
  if (path.includes("inventory")) {
    return {
      name: "Option 1: 30-Day Inventory Planning Optimization Trial",
      focus: "Diagnose inventory planning gaps, build reorder logic, and create a planning rhythm the team can run.",
      benchmark: "$2,500",
      duration: "4 weeks",
      roles: ["Inventory Planning Lead", "Supply Chain Manager", "Project Manager"],
    };
  }
  return {
    name: "Option 1: 30-Day Sourcing Trial",
    focus: "Source and vet manufacturers against specs, target volume, and cost benchmarks; deliver a shortlist of sample-ready vendors with a comparison matrix.",
    benchmark: "$1,500",
    duration: "4 weeks",
    roles: ["Sourcing Lead", "Sourcing Specialist", "Project Manager"],
  };
}

function painBullets(facts: DiscoveryExtraction): string[] {
  const bullets: string[] = [];
  for (const pain of facts.painPoints) {
    const quote = pain.sourceQuote ? ` ("${pain.sourceQuote}")` : "";
    bullets.push(`**${titleCase(pain.category)}:** ${pain.evidence}${quote}`);
  }
  for (const risk of facts.risks) {
    if (bullets.length >= 8) break;
    if (!bullets.some((bullet) => bullet.toLowerCase().includes(risk))) {
      bullets.push(`**Risk signal:** "${risk}" appears in the discovery notes and needs a clear owner.`);
    }
  }
  for (const signal of facts.urgencySignals) {
    if (bullets.length >= 8) break;
    bullets.push(`**Timeline pressure:** "${signal}" came up in discovery, which raises the cost of waiting.`);
  }
  for (const missing of facts.missingInfo) {
    if (bullets.length >= 5) break;
    bullets.push(`**Open operating question:** ${missing} is not confirmed yet, which limits planning confidence.`);
  }
  return bullets.slice(0, 8);
}

export function generateProposalSection(
  sectionNumber: number,
  facts: DiscoveryExtraction,
  previousSections: ProposalSection[] = [],
) {
  const client = facts.companyName || "the client";
  const servicePath = facts.recommendedServicePath || "a focused optimization trial";
  const trial = trialForPath(facts.recommendedServicePath);
  const option3 = option3Justified(facts);
  const topPains = facts.painPoints.slice(0, 3).map((pain) => titleCase(pain.category));

  const focusArea = topPains[0] ?? "supply chain operations";
  const optionRows = [
    `| ${trial.name} | TBD (benchmark ${trial.benchmark} USD, 4-week cycle) | ${trial.duration} | ${trial.focus} | ${trial.roles.join(", ")} |`,
    `| Option 2: 3-Month End-to-End Engagement | TBD, requires internal confirmation | 3 months (12 weeks) | Everything in Option 1, carried through execution: coordination, vendor follow-through, negotiation, and readiness for the next PO with fewer handoffs. | ${[...new Set([...trial.roles, "Supply Chain Manager"])].join(", ")} |`,
  ];
  if (option3.justified) {
    optionRows.push(
      `| Option 3: Fractional Supply Chain Support | TBD, requires internal confirmation | Monthly, ongoing | Recurring planning, sourcing, logistics, and vendor support as an embedded operating layer for the team. | Supply Chain Manager, Project Manager |`,
    );
  }

  const bodyBySection: Record<number, string> = {
    1: `## Proposal for ${client}

Move Supply Chain will support ${client} in creating more control around the supply chain layer that supports growth. Based on insights from our discovery call, this proposal outlines a focused engagement designed to address the highest-friction areas first, validate the operating details that are still open, and create a clearer path forward without adding unnecessary complexity.

**Key Pain Points**

${painBullets(facts)
  .map((bullet) => `- ${bullet}`)
  .join("\n")}`,
    2: `## Package Summary

| Package Option | Cost | Contract Duration | Main Focus | Talents |
|---|---|---|---|---|
${optionRows.join("\n")}

${option3.justified ? `Option 3 is included because the discovery facts support ongoing help: ${option3.reason.toLowerCase()}` : "Two options are offered because the discovery facts point to a focused need rather than ongoing support."}

Costs shown are internal benchmarks, not final pricing. Final pricing requires internal confirmation before this proposal is sent.`,
    3: `## Package Transitional Timeline

**${trial.name.replace(/^Option 1: /, "Option 1: ")}**

| Timeline | Activities |
|---|---|
| Week 1 | Kickoff and align on ${client}'s goals, constraints, and decision owners. Confirm priorities around ${topPains.join(", ") || "the core supply chain workflow"}. Build criteria and trackers for the work ahead. |
| Week 2 | Begin targeted execution on the agreed workstream. Collect quotes, options, or planning inputs and screen them against the agreed criteria. Build the comparison tracker. |
| Week 3 | Narrow to the strongest options. Request deeper documentation, normalize quotes, and begin preliminary negotiation or validation. Surface blockers early. |
| Week 4 | Deliver the final shortlist, comparison matrix, and summary. Recommend whether to proceed into the next phase, with estimated costs, timelines, and handoff requirements. |

Note: This is a suggested project timeline. The engagement may be completed earlier depending on responsiveness, documentation quality, and how quickly ${client} can review and approve options. The structure leaves enough room for proper vetting without rushing decisions.`,
    4: `## Key Differences and Recommendation

Option 1 is the leaner starting point. It gives ${client} fast clarity on ${focusArea.toLowerCase()} in 30 days, answering the immediate questions from the discovery call before committing to a longer engagement.

Option 2 is the stronger path if ${client} already wants to move beyond discovery and into execution. It carries the work through coordination, validation, negotiation, and readiness, which reduces handoffs and gives the team a clearer path from "is this viable?" to "which option should we move forward with?"

${option3.justified ? `Option 3 fits if the team wants Move embedded as a recurring operating layer rather than a one-off project. ${option3.reason}` : ""}

**Recommendation:** Start with Option 1. ${facts.servicePathRationale || "It starts with the highest-confidence pain signals and keeps the first step practical."} It gives the team the right amount of visibility before deciding whether the work deserves the deeper engagement under Option 2.`,
    5: `## Service Level Agreement (SLA) and Commitment

| KPI | Commitment | Metrics |
|---|---|---|
| Weekly operating update | Written update every week, no chasing required. | Update delivered by agreed weekday; open items tracked to closure. |
| Response time | Working-day response on operational questions. | Time from question to first substantive reply. |
| Workstream visibility | Single live tracker for every open workstream. | Tracker freshness; percentage of items with a named owner and date. |
| Final deliverable | Sourcing tracker, comparison matrix, and handoff session. | Final report and recommendations delivered by end of project. |`,
    6: `## Detailed Scope of Work

### ${titleCase(focusArea)} Diagnosis and Execution
**Objective:** Build a clear, shared picture of the current ${focusArea.toLowerCase()} setup and turn the highest-friction points into owned workstreams.
**Approach:**
1. Align on ${client}'s goals, constraints, and decision criteria.
2. Review current files, suppliers, inventory logic, and logistics flows with the team.
3. Verify the discovery signals around ${focusArea.toLowerCase()} and separate confirmed facts from assumptions.
4. Build a comparison tracker across cost, quality, lead time, and reliability.
5. Shortlist the options most aligned with ${client}'s current needs.
**Expected Outcome:**
- A prioritized operating map the team agrees with.
- A practical execution plan with owners, dates, and visible progress.

### Commercial and Risk Assessment
**Objective:** Help ${client} understand whether each option makes sense commercially and operationally before committing further.
**Approach:**
1. Benchmark pricing and terms against the stated constraints from discovery.
2. Compare unit cost, MOQ, lead time, and payment terms across options.
3. Flag operational risks around documentation, communication, and reliability.
4. Provide a recommendation on whether to proceed, pause, or widen the search.
**Expected Outcome:**
- Commercial comparison matrix across shortlisted options.
- Clear recommendation with risk notes tied to real findings.

### Operating Rhythm and Handoff
**Objective:** Leave ${client} with a repeatable weekly rhythm for decisions, updates, and escalations.
**Approach:**
1. Set a weekly cadence covering updates, blockers, and recommended decisions.
2. Maintain a single tracker as the source of truth for open items.
3. Prepare a clean handoff package at the end of the engagement.
**Expected Outcome:**
- Fewer surprises and faster decisions during the engagement.
- A rhythm and handoff the team can run without Move if they choose.`,
    7: `## Investment, Next Steps, and Operating Notes

**Recommended option:** ${servicePath}

**Investment:** TBD, requires internal confirmation before sending. Benchmark figures are listed in the Package Summary.

**Next steps**
1. Confirm selected option and scope.
2. Confirm investment internally.
3. Send contract and invoice.
4. Schedule kickoff and share required files.

**Collaboration and Communication**

All project-related discussions, feedback, and updates will be exchanged through agreed communication channels, including email, video conferences, and project management platforms. With the understanding of time zone differences, both the Move team and ${client} will establish agreed-upon hours of availability for synchronous communication.

**Operational Considerations**

The approach, team composition, and estimated timelines may be adjusted based on the team's onboarding and immersion into the actual operations. We are committed to utilizing the allocated time effectively to achieve the best possible outcomes.

**Add-On Value**
- Project management and support through regular check-ins to align expectations and make timely adjustments.
- Complimentary monthly consultation for expert insights and strategic decision-making.

Kindly review our proposal, and we look forward to hearing your thoughts. Please don't hesitate to reach out if you have any questions or would like to refine the package to better suit your needs.

_This proposal is valid for 1 month from the date of receipt. Package costs may vary in subsequent months._`,
  };

  const content = withoutEmDash(bodyBySection[sectionNumber] ?? "");
  return {
    content,
    sourceChunkIds: previousSections.flatMap((section) => section.sourceChunkIds).slice(0, 4),
  };
}

export function reviseSection(currentContent: string, instruction: string) {
  const trimmedInstruction = instruction.trim();
  if (!trimmedInstruction) {
    return currentContent;
  }

  return `${currentContent}\n\n_Revision request (apply manually or retry with Live AI): ${withoutEmDash(trimmedInstruction)}_`;
}

export function approveSection(project: ProposalProject, sectionId: string) {
  const sections = project.sections.map((section) => {
    if (section.id === sectionId) {
      return {
        ...section,
        status: "locked" as const,
        approvedAt: new Date().toISOString(),
      };
    }
    return section;
  });

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    sections,
  };
}

export function exportProposalMarkdown(project: ProposalProject) {
  const approved = project.sections.filter((section) => section.content.trim());
  return [
    `# ${project.clientName} Proposal`,
    "",
    `Prepared by Move Supply Chain`,
    "",
    ...approved.flatMap((section) => [withoutEmDash(section.content), ""]),
  ].join("\n");
}

function renderInline(line: string) {
  return escapeHtml(line)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

/**
 * Minimal markdown-to-HTML for proposal content: headings, bullets, bold,
 * italics, and tables. Used by both the HTML export and the in-app preview
 * so what the team sees is what the client receives.
 */
export function markdownToHtml(markdown: string) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let listOpen = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const [headers, ...rows] = tableRows;
    html.push("<table><thead><tr>");
    headers.forEach((cell) => html.push(`<th>${renderInline(cell)}</th>`));
    html.push("</tr></thead><tbody>");
    rows.forEach((row) => {
      html.push("<tr>");
      row.forEach((cell) => html.push(`<td>${renderInline(cell)}</td>`));
      html.push("</tr>");
    });
    html.push("</tbody></table>");
    tableRows = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      flushList();
      if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue;
      tableRows.push(
        line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
      continue;
    }
    flushTable();

    if (line.startsWith("### ")) {
      flushList();
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushList();
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushList();
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      flushList();
      html.push(`<p>${renderInline(line)}</p>`);
    } else if (line.trim()) {
      flushList();
      html.push(`<p>${renderInline(line)}</p>`);
    } else {
      flushList();
    }
  }
  flushList();
  flushTable();

  return html.join("\n");
}

export function exportProposalHtml(project: ProposalProject) {
  const body = markdownToHtml(exportProposalMarkdown(project));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.clientName)} Proposal</title><style>body{font-family:Arial,sans-serif;background:#f3f5fa;color:#182454;max-width:860px;margin:40px auto;line-height:1.55;padding:0 16px}h1,h2,h3{color:#182454}h1{border-bottom:4px solid #3CA848;padding-bottom:16px}table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}td,th{border:1px solid #c6cde2;padding:8px;text-align:left;vertical-align:top}th{background:#e8ecf6}</style></head><body>${body}<footer><p>Move Supply Chain</p></footer></body></html>`;
}

export function draftCompanionEmail(project: ProposalProject): CompanionEmail {
  const facts = project.extractedFacts;
  const client = facts?.companyName || project.clientName;
  const path = facts?.recommendedServicePath || "the recommended engagement path";
  const topPains = facts?.painPoints.slice(0, 3).map((pain) => titleCase(pain.category)) ?? [];
  const bullets = topPains.length
    ? topPains.map((pain) => `- ${pain}: a focused workstream with a named owner and weekly visibility`)
    : [
        "- Confirming the highest-priority supply chain workstream",
        "- Creating more operating visibility week to week",
        "- Keeping the first step practical and small",
      ];

  return {
    subject: `Move Supply Chain proposal for ${client}`,
    body: `Hi ${project.contactName || "there"},

Thanks again for the conversation. Based on what you shared, the proposal is ready and built around ${path}.

The main priorities it covers:
${bullets.slice(0, 3).join("\n")}

Everything in it ties back to what you told us on the call, and pricing stays exactly as discussed until the option that fits is locked in.

Does a 20 minute walkthrough this week work for you?

Best,
Omar
Move Supply Chain`,
    createdAt: new Date().toISOString(),
  };
}

export { MOVE_OFFICIAL_ROLES };

function buildPainPoints(notes: string): PainPoint[] {
  const text = notes.toLowerCase();
  const mappings: Array<[PainPoint["category"], string[]]> = [
    ["sourcing", ["supplier", "sourcing", "moq", "factory", "sample", "vendor"]],
    ["inventory", ["inventory", "stockout", "overstock", "forecast", "reorder", "sku"]],
    ["logistics", ["freight", "shipping", "customs", "tariff", "lane", "landed cost"]],
    ["3pl", ["3pl", "warehouse", "fulfillment", "accuracy"]],
    ["npd", ["launch", "new product", "npd", "materials", "sampling"]],
    ["vendor_management", ["communication", "late", "tracker", "timeline", "escalation"]],
    ["margin", ["margin", "cogs", "cost", "duty", "cash"]],
    ["leadership", ["founder", "bandwidth", "overloaded", "owner", "operator"]],
  ];

  return mappings
    .map(([category, terms]) => {
      const hits = terms.filter((term) => text.includes(term));
      if (!hits.length) return null;
      return {
        category,
        evidence: `Discovery notes mention ${hits.slice(0, 3).join(", ")}.`,
        severity: hits.length >= 3 ? "high" : hits.length === 2 ? "medium" : "low",
        sourceQuote: findSentence(notes, hits[0]),
        businessImpact: "Likely pressure on margin, timeline, cash, or internal bandwidth.",
      } satisfies PainPoint;
    })
    .filter(Boolean) as PainPoint[];
}

function recommendServicePath(pains: PainPoint[]) {
  const first = pains[0]?.category;
  if (!first) return null;
  if (first === "sourcing" || first === "npd" || first === "vendor_management") return "Sourcing Optimization Trial";
  if (first === "logistics" || first === "3pl" || first === "margin") return "Logistics Optimization Trial";
  if (first === "inventory") return "Inventory Planning Optimization Trial";
  if (first === "leadership") return "Fractional Supply Chain Support";
  return "Custom Project";
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\b3pl\b/i, "3PL")
    .replace(/\bNpd\b/, "NPD");
}

function extractCompany(notes: string) {
  const match = notes.match(/(?:company|brand|client)[:\s]+([A-Z][A-Za-z0-9 &'-]{2,60})/);
  return match?.[1]?.trim();
}

function extractWebsite(notes: string) {
  const match = notes.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  return match?.[0];
}

function extractNamedLine(notes: string, label: string) {
  const regex = new RegExp(`${label}[:\\s]+([^\\n]+)`, "i");
  const value = notes.match(regex)?.[1];
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function extractRoles(text: string) {
  return ["founder", "coo", "operations", "supply chain", "ecommerce", "finance"].filter((role) =>
    text.includes(role),
  );
}

function inferCategory(text: string) {
  return ["apparel", "supplements", "beauty", "home goods", "footwear", "toys", "food"].find((item) =>
    text.includes(item),
  );
}

function extractProducts(text: string) {
  const products = ["apparel", "supplements", "beauty", "home goods", "footwear", "toys", "food", "accessories"].filter(
    (item) => text.includes(item),
  );
  return products.length ? products : [];
}

function extractRevenue(notes: string) {
  return notes.match(/\$?\d+\s?(?:m|million)\s?(?:to|-)?\s?\$?\d*\s?(?:m|million)?/i)?.[0] ?? null;
}

function extractSku(notes: string) {
  return notes.match(/\d+\s?(?:skus|sku)/i)?.[0] ?? null;
}

function extractPoValue(notes: string) {
  return notes.match(/(?:po|purchase order|annual po)[^\n,.;]*/i)?.[0] ?? null;
}

function extractWarehouse(notes: string) {
  return notes.match(/(?:warehouse|3pl|fulfillment)[^\n.]{0,80}/i)?.[0] ?? null;
}

function extractSuppliers(notes: string) {
  return (notes.match(/(?:supplier|vendor|factory)[^\n.]{0,80}/gi) ?? []).slice(0, 5);
}

function extractFreight(notes: string) {
  return notes.match(/(?:freight|shipping|3pl|warehouse|fulfillment)[^\n.]{0,100}/i)?.[0] ?? null;
}

function extractChannels(text: string) {
  return ["Shopify", "Amazon", "Retail", "Wholesale", "Subscriptions", "DTC"].filter((channel) =>
    text.includes(channel.toLowerCase()),
  );
}

function extractRegions(text: string) {
  return ["China", "Vietnam", "US", "Canada", "UK", "EU"].filter((region) => text.includes(region.toLowerCase()));
}

function extractRepeatedPhrases(notes: string) {
  const words = notes
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 5);
  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

function extractSignals(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term));
}

function findSentence(notes: string, term: string) {
  return notes
    .split(/[.!?]\s+/)
    .find((sentence) => sentence.toLowerCase().includes(term))
    ?.trim()
    .slice(0, 240);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
