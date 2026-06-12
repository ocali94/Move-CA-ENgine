import type { LeadQualificationResult } from "@/lib/types";
import { clamp, makeId, withoutEmDash } from "@/lib/utils";

type LeadInput = {
  brandName?: string;
  website?: string;
  notes?: string;
  websiteCopy?: string;
  leadList?: string;
};

const keywordGroups = {
  physical: ["shopify", "product", "products", "sku", "inventory", "warehouse", "shipping", "fulfillment", "sourcing", "supplier", "factory", "freight"],
  markets: ["united states", "usa", "us ", "uk", "canada", "australia", "au ", "global", "north america"],
  pain: ["stockout", "overstock", "inventory", "supplier", "freight", "3pl", "warehouse", "margin", "tariff", "launch", "sampling", "lead time", "moq", "forecast"],
  buyer: ["founder", "operations", "ops", "supply chain", "coo", "ecommerce", "director", "head of"],
  disqualifier: ["dropship", "marketplace only", "agency", "saas", "software", "course", "coaching", "service business", "info product"],
  channels: ["shopify", "amazon", "retail", "wholesale", "subscription", "dtc", "ecommerce", "e-commerce"],
};

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function collectTerms(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term));
}

function verdict(score: number, disqualified: boolean): LeadQualificationResult["fitVerdict"] {
  if (disqualified) return "disqualified";
  if (score >= 78) return "high_fit";
  if (score >= 55) return "medium_fit";
  return "low_fit";
}

export function analyzeLead(input: LeadInput): LeadQualificationResult {
  const rawText = [
    input.brandName,
    input.website,
    input.notes,
    input.websiteCopy,
    input.leadList,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const brandName = input.brandName?.trim() || extractBrandName(input.website) || "Unnamed brand";
  const physical = includesAny(rawText, keywordGroups.physical);
  const market = includesAny(rawText, keywordGroups.markets) || Boolean(input.website);
  const complexity =
    /\$?\d+\s?m|\$?\d+,\d{3}|sku|skus|warehouse|3pl|retail|wholesale|amazon|launch/.test(rawText);
  const painVisible = includesAny(rawText, keywordGroups.pain);
  const buyerVisible = includesAny(rawText, keywordGroups.buyer);
  const disqualifiers = collectTerms(rawText, keywordGroups.disqualifier);
  const channelSignals = collectTerms(rawText, keywordGroups.channels);

  const score = clamp(
    (physical ? 20 : 6) +
      (market ? 15 : 5) +
      (complexity ? 20 : 8) +
      (painVisible ? 25 : 7) +
      (buyerVisible ? 10 : 4) +
      (channelSignals.length ? 10 : 4) -
      disqualifiers.length * 18,
    0,
    100,
  );

  const painSignals = collectTerms(rawText, keywordGroups.pain).map((signal) =>
    withoutEmDash(`${signal} appears in the supplied context.`),
  );

  const scoreReasons = [
    physical
      ? "The supplied context points to a physical product model."
      : "Physical goods fit is not fully proven from the supplied context.",
    complexity
      ? "Operational complexity is visible through SKUs, channels, warehousing, launches, or volume language."
      : "Revenue or complexity needs confirmation before this becomes a clear fit.",
    painVisible
      ? "There are supply chain, inventory, sourcing, logistics, NPD, or margin pain signals."
      : "No strong supply chain pain signal was supplied yet.",
    buyerVisible
      ? "A likely decision maker or operator appears visible."
      : "Buyer visibility needs more research.",
  ];

  return {
    id: makeId("lead"),
    createdAt: new Date().toISOString(),
    brandName,
    website: input.website?.trim() || null,
    fitScore: score,
    fitVerdict: verdict(score, disqualifiers.length > 0 && score < 55),
    scoreReasons,
    icpChecks: {
      physicalGoodsBrand: {
        pass: physical,
        reason: physical
          ? "Physical product and operational terms were detected."
          : "Paste product, SKU, fulfillment, or catalog context to confirm.",
      },
      marketFit: {
        pass: market,
        reason: market
          ? "The brand appears reachable in Move's target markets or has enough website context to research."
          : "Market geography is missing.",
      },
      revenueOrComplexityFit: {
        pass: complexity,
        reason: complexity
          ? "Complexity signals suggest Move may have room to help."
          : "Revenue, SKU count, channels, PO volume, or warehouse setup is missing.",
      },
      supplyChainPainVisible: {
        pass: painVisible,
        reason: painVisible
          ? "Supply chain pain is visible in the supplied context."
          : "No clear pain signal has been supplied.",
      },
      buyerVisibility: {
        pass: buyerVisible,
        reason: buyerVisible
          ? "The context includes a likely founder, operator, or supply chain decision maker."
          : "Find founder, ops, ecommerce, or supply chain owner before outreach.",
      },
    },
    disqualifierFlags: disqualifiers,
    painSignals: painSignals.length ? painSignals : ["No specific supply chain pain signal supplied yet."],
    buyerSignals: buyerVisible
      ? ["Likely buyer language found in supplied notes."]
      : ["No named buyer found yet."],
    personalizationHook: painVisible
      ? `${brandName} appears to have operational pressure around ${collectTerms(rawText, keywordGroups.pain)
          .slice(0, 2)
          .join(" and ")}. A first touch should focus on creating visibility and control around that issue.`
      : `${brandName} needs one more research pass to find a specific supply chain hook before outreach.`,
    recommendedNextAction:
      score >= 78 ? "prep_outreach" : score >= 55 ? "research_more" : disqualifiers.length ? "disqualify" : "research_more",
    crmSummary: `${brandName}: ${score}/100 ${verdict(score, disqualifiers.length > 0 && score < 55).replace("_", " ")}. ${scoreReasons.join(" ")}`,
    assumptions: [
      "This score uses supplied text and visible signals only.",
      "Revenue is not inferred unless the input explicitly mentions it.",
    ],
    missingInfo: [
      !complexity ? "Revenue range, SKU count, channels, or PO value" : "",
      !buyerVisible ? "Named founder, operator, ecommerce lead, or supply chain owner" : "",
      !painVisible ? "Specific supply chain pain or trigger event" : "",
    ].filter(Boolean),
  };
}

function extractBrandName(website?: string) {
  if (!website) return undefined;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").split(".")[0]?.replace(/-/g, " ");
  } catch {
    return undefined;
  }
}
