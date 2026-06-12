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
      return `Section 1: Cover and Context.
- One short framing paragraph for the client.
- Then EXACTLY 5 to 8 bullet points (markdown "-"), each a specific pain taken from the extracted facts. Quote the client's own phrasing where a sourceQuote exists. No generic filler bullets.
- Close with one sentence on Move's role.`;
    case 2:
      return `Section 2: Engagement Options.
- A markdown table with columns exactly: Option | Package | Cost | Hours | Duration | Move Roles.
- Package names come from the Move service paths document.
- Cost: use the pricing benchmarks, written as "TBD (benchmark $X)" unless the facts explicitly confirm agreed pricing. Never present a benchmark as final.
- Move Roles cells may ONLY use these official role names: ${MOVE_OFFICIAL_ROLES.join(", ")}.
- ${option3.justified ? `Include exactly three options. Option 3 must be Fractional Supply Chain Support. Justification: ${option3.reason}` : `Include EXACTLY TWO options (Option 1 and Option 2). Do NOT include an Option 3: ${option3.reason}`}
- After the table, one short paragraph explaining why this option count fits the facts.`;
    case 3:
      return `Section 3: Transitional Timeline.
- MUST render as a markdown table with columns: Phase | Timing | Focus | Output.
- Timings must be consistent with the durations offered in Section 2.`;
    case 4:
      return `Section 4: Recommended Engagement Path.
- Name the recommended option and tie the recommendation directly to the client's actual pain points from the facts.
- Include what is intentionally NOT included (no guaranteed savings, no guaranteed supplier outcomes, no final pricing without internal confirmation).`;
    case 5:
      return `Section 5: Service Levels.
- MUST contain a markdown table with EXACTLY three columns titled: KPI | Commitment | Metrics.
- The table must have 3 to 5 data rows. No other column layout is acceptable.`;
    case 6:
      return `Section 6: Scope Pillars.
- 3 to 4 pillars, each as a "### Pillar N: Title" heading.
- Each pillar MUST contain three bold labels on their own lines: **Objective:**, **Approach:**, and **Expected Outcome:**.`;
    case 7:
      return `Section 7: Investment, Assumptions, and Next Steps.
- Investment stays "TBD, requires internal confirmation" unless the facts explicitly confirm pricing. If benchmarks were referenced in Section 2, reference them the same way; never introduce different amounts or durations than earlier sections.
- A short assumptions list and a numbered next-steps list.`;
    default:
      return "";
  }
}
