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
  benchmark: string;
  hours: string;
  duration: string;
  roles: string[];
};

function trialForPath(servicePath: string | null | undefined): TrialPackage {
  const path = (servicePath ?? "").toLowerCase();
  if (path.includes("logistics")) {
    return {
      name: "Logistics Optimization Trial",
      benchmark: "$2,000",
      hours: "20 hours",
      duration: "4 weeks",
      roles: ["Engagement Lead", "Logistics Specialist"],
    };
  }
  if (path.includes("inventory")) {
    return {
      name: "Inventory Planning Optimization Trial",
      benchmark: "$2,500",
      hours: "25 hours",
      duration: "4 weeks",
      roles: ["Engagement Lead", "Inventory Planner"],
    };
  }
  return {
    name: "Sourcing Optimization Trial",
    benchmark: "$1,500",
    hours: "15 hours",
    duration: "4 weeks",
    roles: ["Engagement Lead", "Sourcing Specialist"],
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

  const optionRows = [
    `| Option 1 | ${trial.name} | TBD (benchmark ${trial.benchmark}) | ${trial.hours} | ${trial.duration} | ${trial.roles.join(", ")} |`,
    `| Option 2 | DWY, Done With Move | TBD, requires internal confirmation | 30 hours | 8 weeks | Engagement Lead, Supply Chain Analyst |`,
  ];
  if (option3.justified) {
    optionRows.push(
      `| Option 3 | Fractional Supply Chain Support | TBD, requires internal confirmation | 40 hours per month | 3 months, then monthly | Fractional Supply Chain Lead |`,
    );
  }

  const bodyBySection: Record<number, string> = {
    1: `## Cover and Context

**Prepared for ${client} by Move Supply Chain.**

Based on the discovery conversation, the immediate priority is to create more control around the supply chain layer that supports growth. The pressure points below come directly from what was shared:

${painBullets(facts)
  .map((bullet) => `- ${bullet}`)
  .join("\n")}

Move's role is to diagnose the highest-friction areas, organize the work, and support execution without adding unnecessary complexity.`,
    2: `## Engagement Options

| Option | Package | Cost | Hours | Duration | Move Roles |
|---|---|---|---|---|---|
${optionRows.join("\n")}

${option3.justified ? `Option 3 is included because the discovery facts support ongoing help: ${option3.reason.toLowerCase()}` : "Two options are offered because the discovery facts point to a focused need rather than ongoing support."}

Costs shown are internal benchmarks. Final pricing requires internal confirmation before this proposal is sent.`,
    3: `## Transitional Timeline

| Phase | Timing | Focus | Output |
|---|---|---|---|
| Confirm | Week 1 | Validate facts, priorities, constraints, and decision owners. | Confirmed scope and operating map. |
| Diagnose | Week 2 | Map the highest-friction areas across ${topPains.join(", ") || "the supply chain"}. | Prioritized issue list with owners. |
| Build | Weeks 3 to 4 | Execute the agreed workstreams and surface blockers early. | Workstream tracker and recommendations. |
| Review | End of ${trial.duration.replace(" weeks", "")} weeks | Confirm what changed, what remains open, and what should happen next. | Next-step plan and handoff notes. |`,
    4: `## Recommended Engagement Path

**Recommended path:** ${servicePath}

${facts.servicePathRationale || "This recommendation follows the strongest discovery signals."}

**Why this fits ${client}**
- It starts with the highest-confidence pain signals: ${topPains.join(", ") || "to be confirmed on the kickoff call"}.
- It creates a practical first step instead of a broad open-ended scope.
- It keeps pricing and final scope subject to internal confirmation.

**Intentionally not included yet**
- Guaranteed savings
- Guaranteed supplier acceptance
- Final pricing unless approved internally`,
    5: `## Service Levels

| KPI | Commitment | Metrics |
|---|---|---|
| Weekly operating update | Every week, written, no chasing required. | Update delivered by agreed weekday; open items tracked to closure. |
| Response time | Working-day response on operational questions. | Time from question to first substantive reply. |
| Workstream visibility | Single live tracker for every open workstream. | Tracker freshness; percentage of items with a named owner and date. |
| Decision support | Every recommendation arrives with options and tradeoffs. | Decisions unblocked per week; rework rate after decisions. |`,
    6: `## Scope Pillars

### Pillar 1: Operating Diagnosis
**Objective:** Build a clear, shared picture of the current supply chain setup and its highest-friction points.
**Approach:** Review current files, suppliers, inventory logic, and logistics flows with the team; verify the discovery signals around ${topPains[0] ?? "the core workflow"}.
**Expected Outcome:** A prioritized operating map the team agrees with, separating confirmed facts from assumptions.

### Pillar 2: Focused Workstream Execution
**Objective:** Turn the top confirmed issues into concrete, owned workstreams.
**Approach:** Build the workplan around the strongest discovery signals, execute alongside the team, and surface blockers early.
**Expected Outcome:** A practical execution plan with owners, dates, and visible progress on the issues that matter most.

### Pillar 3: Operating Rhythm
**Objective:** Leave ${client} with a repeatable weekly rhythm for decisions, updates, and escalations.
**Approach:** Set a weekly cadence covering updates, blockers, and recommended decisions, with a single tracker.
**Expected Outcome:** Fewer surprises, faster decisions, and a rhythm the team can run without Move if they choose.`,
    7: `## Investment, Assumptions, and Next Steps

**Recommended option:** ${servicePath}

**Investment:** TBD, requires internal confirmation before sending. Benchmark figures are listed in the engagement options table.

**Assumptions**
${facts.assumptions
  .concat(facts.missingInfo.map((item) => `${item} still needs confirmation.`))
  .slice(0, 6)
  .map((item) => `- ${item}`)
  .join("\n")}

**Next steps**
1. Confirm selected option and scope.
2. Confirm investment internally.
3. Send contract and invoice.
4. Schedule kickoff and share required files.`,
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

export function exportProposalHtml(project: ProposalProject) {
  const markdown = exportProposalMarkdown(project);
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

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.clientName)} Proposal</title><style>body{font-family:Arial,sans-serif;background:#f3f5fa;color:#182454;max-width:860px;margin:40px auto;line-height:1.55;padding:0 16px}h1,h2,h3{color:#182454}h1{border-bottom:4px solid #3CA848;padding-bottom:16px}table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}td,th{border:1px solid #c6cde2;padding:8px;text-align:left;vertical-align:top}th{background:#e8ecf6}</style></head><body>${html.join("\n")}<footer><p>Move Supply Chain</p></footer></body></html>`;
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
