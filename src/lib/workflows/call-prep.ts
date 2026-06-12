import type { CallPrepBrief, PainMapItem } from "@/lib/types";
import { clamp, makeId } from "@/lib/utils";

type CallPrepInput = {
  companyName?: string;
  website?: string;
  intake?: string;
  revenue?: string;
  skuCount?: string;
  annualPoValue?: string;
  sellingPlatforms?: string;
  warehouseSetup?: string;
  foundUs?: string;
  notes?: string;
};

const painTerms: Record<PainMapItem["category"], string[]> = {
  sourcing: ["supplier", "sourcing", "moq", "factory", "sample", "quality", "vendor"],
  inventory: ["inventory", "stockout", "overstock", "forecast", "reorder", "sku", "demand"],
  logistics: ["freight", "shipping", "customs", "tariff", "lane", "landed cost"],
  npd: ["launch", "npd", "new product", "sampling", "materials", "development"],
  "3pl": ["3pl", "warehouse", "fulfillment", "pick", "pack", "accuracy"],
  vendor_management: ["communication", "late", "tracker", "timeline", "escalation", "vendor"],
  margin: ["margin", "cogs", "cost", "duty", "tariff", "cash"],
  other: [],
};

export function generateCallPrep(input: CallPrepInput): CallPrepBrief {
  const text = Object.values(input).filter(Boolean).join("\n").toLowerCase();
  const companyName = input.companyName?.trim() || extractCompany(input.website) || "Prospect";
  const channels = collectChannels(text);
  const complexity = scoreComplexity(text, input);
  const painMap = buildPainMap(text);
  const topPain = painMap[0]?.category ?? "inventory";
  const servicePath = recommendPath(topPain, complexity);

  return {
    id: makeId("call"),
    createdAt: new Date().toISOString(),
    companyName,
    brandSnapshot: {
      companyName,
      category: inferCategory(text),
      products: collectProducts(text),
      channels,
      pricePoints: extractPricePoints(text),
      likelyProductionRegions: inferRegions(text),
      operationalComplexity: complexity,
      notes: `${companyName} should be treated as a ${complexity} complexity call until discovery confirms volume, team ownership, and urgency.`,
    },
    painMap,
    diagnosticQuestions: buildQuestions(companyName, topPain, input),
    probableServicePath: servicePath,
    servicePathConfidence: clamp(55 + painMap.length * 6 + (complexity === "high" ? 12 : 0), 0, 92),
    thingsToVerify: [
      "Current supply chain owner and decision process",
      "Revenue range, SKU count, and annual PO value",
      "Current supplier, 3PL, and freight setup",
      "Timeline pressure and what happens if nothing changes",
    ],
    thingsToAvoid: [
      "Do not imply guaranteed savings or supplier outcomes.",
      "Do not assume production region unless the prospect confirms it.",
      "Do not recommend pricing before internal confirmation.",
    ],
    suggestedCallAngle: `Use the call to confirm whether ${companyName} needs a focused ${servicePath} path or a broader operating layer. Lead with control, visibility, and fewer surprises.`,
    copyReadySummary: `${companyName} appears to need discovery around ${painMap
      .slice(0, 3)
      .map((item) => item.category.replace("_", " "))
      .join(", ")}. Recommended path: ${servicePath}.`,
    assumptions: ["This battle card is based on provided intake text and must be verified on the call."],
  };
}

function buildPainMap(text: string): PainMapItem[] {
  return Object.entries(painTerms)
    .filter(([category]) => category !== "other")
    .map(([category, terms]) => {
      const hits = terms.filter((term) => text.includes(term));
      const confidence = clamp(hits.length * 18, 10, 95);
      const severity: PainMapItem["severity"] = confidence > 60 ? "high" : confidence > 32 ? "medium" : "low";
      return {
        category: category as PainMapItem["category"],
        severity,
        reason: hits.length
          ? `Detected ${hits.slice(0, 3).join(", ")} in the intake context.`
          : "No direct signal yet, verify if this area matters.",
        confidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 7);
}

function buildQuestions(companyName: string, topPain: PainMapItem["category"], input: CallPrepInput) {
  const setup = input.warehouseSetup ? `your current ${input.warehouseSetup} setup` : "your current supply chain setup";
  return [
    `What changed recently that made supply chain a priority for ${companyName}?`,
    `Can you walk me through ${setup} from supplier through customer delivery?`,
    `Where are you seeing the most friction right now around ${topPain.replace("_", " ")}?`,
    `How many SKUs, purchase orders, and active suppliers are creating the most complexity?`,
    "What do you think is causing the issue, process, partner performance, data visibility, or bandwidth?",
    "What timeline are you working toward, and what happens if this is not fixed in time?",
    "Who needs to be involved in approving scope, investment, and operating changes?",
    "What would make this engagement feel useful in the first 30 days?",
    "Would you prefer Move to guide your team, execute alongside you, or own more of the operating layer?",
    "If the call confirms fit, what is the cleanest next step for proposal review?",
  ].map((question, index) => ({
    order: index + 1,
    question,
    whyAsk:
      index < 2
        ? "Establish context without jumping to a solution."
        : index < 6
          ? "Confirm pain, complexity, and urgency before recommending a path."
          : "Clarify decision process and next step.",
  }));
}

function scoreComplexity(text: string, input: CallPrepInput): "low" | "medium" | "high" {
  const score =
    (/\$?([5-9]|[1-9]\d)\s?m/.test(text) ? 3 : 0) +
    (Number.parseInt(input.skuCount ?? "", 10) > 100 ? 2 : 0) +
    (["3pl", "warehouse", "retail", "wholesale", "amazon", "multiple"].some((term) => text.includes(term)) ? 2 : 0) +
    (["launch", "freight", "supplier", "stockout", "margin"].some((term) => text.includes(term)) ? 2 : 0);

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function recommendPath(topPain: PainMapItem["category"], complexity: "low" | "medium" | "high") {
  if (complexity === "high") return "Fractional Supply Chain Support";
  if (topPain === "sourcing" || topPain === "npd" || topPain === "vendor_management") return "Sourcing Optimization Trial";
  if (topPain === "logistics" || topPain === "3pl" || topPain === "margin") return "Logistics Optimization Trial";
  if (topPain === "inventory") return "Inventory Planning Optimization Trial";
  return "DWY, Done With Move";
}

function collectChannels(text: string) {
  return ["Shopify", "Amazon", "Retail", "Wholesale", "Subscriptions", "DTC"]
    .filter((channel) => text.includes(channel.toLowerCase()))
    .slice(0, 5);
}

function collectProducts(text: string) {
  const products = ["apparel", "supplements", "beauty", "home goods", "food", "footwear", "toys"].filter((term) =>
    text.includes(term),
  );
  return products.length ? products : ["Physical goods, confirm category on call"];
}

function inferCategory(text: string) {
  return collectProducts(text)[0] ?? null;
}

function extractPricePoints(text: string) {
  const matches = text.match(/\$[0-9]+(?:\s?-\s?\$?[0-9]+)?/g);
  return matches?.slice(0, 4) ?? [];
}

function inferRegions(text: string) {
  const regions = ["China", "Vietnam", "US", "Canada", "EU", "UK"].filter((region) =>
    text.includes(region.toLowerCase()),
  );
  return regions.length ? regions : ["Inferred only after supplier context is confirmed"];
}

function extractCompany(website?: string) {
  if (!website) return undefined;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").split(".")[0]?.replace(/-/g, " ");
  } catch {
    return undefined;
  }
}
