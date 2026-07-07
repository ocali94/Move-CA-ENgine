import "server-only";
import { z } from "zod";
import { MOVE_OFFICIAL_ROLES, option3Justified } from "@/lib/proposal-rules";
import type { DiscoveryExtraction } from "@/lib/types";

export const painPointSchema = z.object({
  category: z.enum([
    "sourcing",
    "inventory",
    "logistics",
    "3pl",
    "npd",
    "vendor_management",
    "production",
    "margin",
    "leadership",
    "other",
  ]),
  evidence: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  sourceQuote: z.string().nullable().optional(),
  businessImpact: z.string().nullable().optional(),
});

export const discoveryExtractionSchema = z.object({
  companyName: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  contactNames: z.array(z.string()),
  contactRoles: z.array(z.string()),
  productCategory: z.string().nullable().optional(),
  productsMentioned: z.array(z.string()),
  revenue: z.string().nullable().optional(),
  skuCount: z.string().nullable().optional(),
  annualPoValue: z.string().nullable().optional(),
  sellingChannels: z.array(z.string()),
  warehouseSetup: z.string().nullable().optional(),
  currentSuppliers: z.array(z.string()),
  productionRegions: z.array(z.string()),
  freightOr3plSetup: z.string().nullable().optional(),
  painPoints: z.array(painPointSchema),
  repeatedPhrases: z.array(z.string()),
  urgencySignals: z.array(z.string()),
  budgetSignals: z.array(z.string()),
  decisionMakers: z.array(z.string()),
  desiredOutcomes: z.array(z.string()),
  constraints: z.array(z.string()),
  risks: z.array(z.string()),
  missingInfo: z.array(z.string()),
  recommendedServicePath: z.string().nullable().optional(),
  servicePathRationale: z.string().nullable().optional(),
  pricingSignals: z.array(z.string()),
  internalFollowups: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
  assumptions: z.array(z.string()),
});

/**
 * Per-section hard requirements fed to the LLM. These mirror the validators
 * in proposal-rules.ts so generation aims at the same target the validators
 * check.
 */
export function sectionRequirements(sectionNumber: number, facts: DiscoveryExtraction) {
  const option3 = option3Justified(facts);
  switch (sectionNumber) {
    case 1:
      return `Section 1: Cover and Context. Format it like Move's sent proposals:
- Start with "## Proposal for {client name}".
- One framing paragraph: "Move Supply Chain will support {client} in..." summarizing the engagement aim in 2 to 4 sentences grounded in the discovery facts.
- Then a "**Key Pain Points**" label followed by EXACTLY 5 to 8 bullet points (markdown "-"), each a specific pain taken from the extracted facts, written as full sentences. Quote or closely paraphrase the client's own phrasing where a sourceQuote exists. Include concrete numbers from the facts (order volume, PO value, revenue) where available. No generic filler bullets.`;
    case 2:
      return `Section 2: Package Summary. Format it like Move's sent proposals:
- Heading "## Package Summary".
- A markdown table with columns exactly: Package Option | Cost | Contract Duration | Main Focus | Talents.
- Package Option names follow Move's naming style, e.g. "Option 1: 30-Day Sourcing Trial", "Option 2: 3-Month Sourcing to Sampling and PO Readiness". Base names on the Move service paths document and the client's actual need.
- Cost: use the pricing benchmarks, written as "TBD (benchmark $X USD, 4-week cycle)" unless the facts explicitly confirm agreed pricing. Never present a benchmark as final.
- Main Focus: 1 to 3 crisp sentences per option describing exactly what that package does for THIS client (reference their products, regions, and constraints).
- Talents cells may ONLY use these official Move role names: ${MOVE_OFFICIAL_ROLES.join(", ")}.
- ${option3.justified ? `Include exactly three options. Option 3 is the ongoing/recurring support tier. Justification: ${option3.reason}` : `Include EXACTLY TWO options (Option 1 and Option 2). Do NOT include an Option 3: ${option3.reason}`}
- After the table, one short paragraph noting costs are benchmarks pending internal confirmation.`;
    case 3:
      return `Section 3: Package Transitional Timeline. Format it like Move's sent proposals:
- Heading "## Package Transitional Timeline".
- EVERY package option offered in Section 2 gets its own timeline block: a bold line naming the option exactly as Section 2 named it (e.g. "**Option 1: 30-Day Sourcing Trial**"), followed by its own markdown table with columns: Timeline | Activities.
- Option 1's table uses rows Week 1 through Week 4. Option 2's table uses rows Month 1 through Month 3, where Month 1 covers the Option 1 scope and Months 2 to 3 carry it into follow-through and a decision-ready handoff.${option3.justified ? " Option 3's table describes the recurring monthly cycle." : ""}
- Each row lists 2 to 4 concrete activities specific to this client's products and constraints. Do NOT skip any option offered in Section 2.
- Timings must be consistent with the durations offered in Section 2.
- End with the standard note that this is a suggested timeline and may finish earlier depending on responsiveness and review speed.`;
    case 4:
      return `Section 4: Key Differences and Recommendation. Format it like Move's sent proposals:
- Heading "## Key Differences and Recommendation".
- One paragraph per option: "Option 1 is the leaner starting point..." / "Option 2 is the stronger path if..." explaining when each fits, tied to the client's actual situation from the facts.
- Close with a "**Recommendation:**" paragraph naming the option to start with and why, grounded in the discovery facts (budget signals, urgency, stage).
- Never guarantee savings or supplier outcomes, and never introduce pricing beyond what Section 2 showed.`;
    case 5:
      return `Section 5: Service Level Agreement (SLA) and Commitment. Format it like Move's sent proposals:
- Heading "## Service Level Agreement (SLA) and Commitment".
- A markdown table with EXACTLY three columns titled: KPI | Commitment | Metrics. No other column layout is acceptable.
- 3 to 5 rows with KPIs specific to the recommended package (e.g. Vendor Sourcing, Cost Optimization, Sample Coordination, Sourcing Summary for a sourcing engagement). Commitments are concrete deliverables; Metrics are measurable.`;
    case 6:
      return `Section 6: Detailed Scope of Work. Format it like Move's sent proposals:
- Heading "## Detailed Scope of Work".
- 3 to 4 workstreams, each as a "### {Workstream Name}" heading named for this client's actual work (e.g. "Sourcing and Vendor Management", "Commercial and Risk Assessment").
- Each workstream MUST contain three bold labels on their own lines: **Objective:** (one sentence), **Approach:** (a numbered list of 4 to 7 concrete steps referencing the client's actual products, regions, and constraints), and **Expected Outcome:** (2 to 3 bullets).`;
    case 7:
      return `Section 7: Investment, Next Steps, and Operating Notes. Format it like Move's sent proposals:
- Investment stays "TBD, requires internal confirmation" unless the facts explicitly confirm pricing. If benchmarks were referenced in Section 2, reference them the same way; never introduce different amounts or durations than earlier sections.
- A numbered next-steps list (confirm option, confirm investment, contract and invoice, kickoff).
- Then three short standard blocks in Move's voice: "**Collaboration and Communication**" (agreed channels, time zone awareness), "**Operational Considerations**" (approach and timelines may adjust during onboarding), and "**Add-On Value**" (regular check-ins; complimentary monthly consultation).
- Close with the standard line inviting review and questions, and the italic validity note: proposal valid for 1 month from receipt, package costs may vary in subsequent months.`;
    default:
      return "";
  }
}
