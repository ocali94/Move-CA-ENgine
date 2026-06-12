export type GenerationMeta = {
  mode: "llm" | "fallback";
  provider?: string;
  model?: string;
  reason?: string;
};

export type WebsiteFetchNotice = {
  attempted: boolean;
  ok: boolean;
  url?: string;
  title?: string;
  chars?: number;
  error?: string;
};

export type StatusKind =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type KnowledgeCategory =
  | "proposal_precedent"
  | "playbook"
  | "email_tone"
  | "pricing_benchmark"
  | "case_study"
  | "discovery_note"
  | "lead_qualification"
  | "market_signal"
  | "other";

export type KnowledgeChunk = {
  id: string;
  referenceId: string;
  title: string;
  text: string;
  tags: string[];
  sourceType: string;
  category: KnowledgeCategory;
};

export type KnowledgeReference = {
  id: string;
  title: string;
  sourceType: "local_content" | "pasted_reference";
  category: KnowledgeCategory;
  sourcePath?: string;
  text: string;
  chunks: KnowledgeChunk[];
  importedAt: string;
};

export type LeadQualificationResult = {
  id: string;
  createdAt: string;
  brandName: string;
  website?: string | null;
  fitScore: number;
  fitVerdict: "high_fit" | "medium_fit" | "low_fit" | "disqualified";
  scoreReasons: string[];
  icpChecks: Record<string, { pass: boolean; reason: string }>;
  disqualifierFlags: string[];
  painSignals: string[];
  buyerSignals: string[];
  personalizationHook: string;
  recommendedNextAction:
    | "research_more"
    | "add_to_crm"
    | "prep_outreach"
    | "prep_call"
    | "disqualify";
  crmSummary: string;
  assumptions: string[];
  missingInfo: string[];
};

export type BrandSnapshot = {
  companyName: string;
  category?: string | null;
  products: string[];
  channels: string[];
  pricePoints: string[];
  likelyProductionRegions: string[];
  operationalComplexity: "low" | "medium" | "high";
  notes: string;
};

export type PainMapItem = {
  category:
    | "sourcing"
    | "inventory"
    | "logistics"
    | "npd"
    | "3pl"
    | "vendor_management"
    | "margin"
    | "other";
  severity: "low" | "medium" | "high";
  reason: string;
  confidence: number;
};

export type DiagnosticQuestion = {
  order: number;
  question: string;
  whyAsk: string;
};

export type CallPrepBrief = {
  id: string;
  createdAt: string;
  companyName: string;
  brandSnapshot: BrandSnapshot;
  painMap: PainMapItem[];
  diagnosticQuestions: DiagnosticQuestion[];
  probableServicePath: string;
  servicePathConfidence: number;
  thingsToVerify: string[];
  thingsToAvoid: string[];
  suggestedCallAngle: string;
  copyReadySummary: string;
  assumptions: string[];
};

export type PainPoint = {
  category:
    | "sourcing"
    | "inventory"
    | "logistics"
    | "3pl"
    | "npd"
    | "vendor_management"
    | "production"
    | "margin"
    | "leadership"
    | "other";
  evidence: string;
  severity: "low" | "medium" | "high";
  sourceQuote?: string | null;
  businessImpact?: string | null;
};

export type DiscoveryExtraction = {
  companyName?: string | null;
  website?: string | null;
  contactNames: string[];
  contactRoles: string[];
  productCategory?: string | null;
  productsMentioned: string[];
  revenue?: string | null;
  skuCount?: string | null;
  annualPoValue?: string | null;
  sellingChannels: string[];
  warehouseSetup?: string | null;
  currentSuppliers: string[];
  productionRegions: string[];
  freightOr3plSetup?: string | null;
  painPoints: PainPoint[];
  repeatedPhrases: string[];
  urgencySignals: string[];
  budgetSignals: string[];
  decisionMakers: string[];
  desiredOutcomes: string[];
  constraints: string[];
  risks: string[];
  missingInfo: string[];
  recommendedServicePath?: string | null;
  servicePathRationale?: string | null;
  pricingSignals: string[];
  internalFollowups: string[];
  confidenceScore: number;
  assumptions: string[];
};

export type ValidationIssue = {
  rule: string;
  message: string;
  severity: "error" | "warning";
};

export type SectionValidation = {
  sectionNumber: number;
  passed: boolean;
  issues: ValidationIssue[];
};

export type SectionRevision = {
  id: string;
  createdAt: string;
  instruction?: string;
  content: string;
};

export type ProposalSection = {
  id: string;
  number: number;
  title: string;
  status: "not_started" | "drafted" | "needs_revision" | "approved" | "locked";
  content: string;
  approvedAt?: string;
  sourceChunkIds: string[];
  revisionHistory: SectionRevision[];
  reviewRecommended?: boolean;
  validation?: SectionValidation;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  createdAt: string;
  content: string;
  sectionId?: string;
};

export type CompanionEmail = {
  subject: string;
  body: string;
  createdAt: string;
};

export type ProposalProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  website?: string;
  contactName?: string;
  contactRole?: string;
  leadSource?: string;
  discoveryDate?: string;
  revenueRange?: string;
  skuCount?: string;
  annualPoValue?: string;
  productCategory?: string;
  sellingChannels?: string[];
  warehouseSetup?: string;
  knownRegions?: string[];
  currentSupplierNotes?: string;
  internalOwner?: string;
  proposalOwner?: string;
  rawDiscoveryText?: string;
  extractedFacts?: DiscoveryExtraction;
  references: KnowledgeReference[];
  sections: ProposalSection[];
  chatMessages: ChatMessage[];
  companionEmail?: CompanionEmail;
};

export type MarketSignal = {
  id: string;
  name: string;
  value: number | null;
  unit?: string;
  trend: "up" | "down" | "flat" | "unavailable";
  trendLabel: string;
  updatedAt: string;
  source: string;
  sourceUrl?: string;
  forecastWeight?: number;
  history: { date: string; value: number }[];
  plainEnglish: string;
  scoreContribution: number | null;
  dataMode?: "live" | "cached" | "demo" | "unavailable";
};

export type DemandPulseDriver = {
  signalId: string;
  label: string;
  impact: "positive" | "negative" | "neutral";
  reason: string;
};

export type ForecastReferenceSource = {
  label: string;
  type: "public_data" | "move_reference";
  source: string;
  url?: string;
  updatedAt?: string;
};

export type DemandPulse = {
  score: number | null;
  status: "heating" | "stable" | "cooling" | "risk_off" | "unavailable";
  trend: "up" | "down" | "flat" | "unavailable";
  changeLabel: string;
  summary: string;
  quickSummary: string;
  updatedAt: string;
  history: { date: string; score: number }[];
  drivers: DemandPulseDriver[];
  referenceSources: ForecastReferenceSource[];
  signals: MarketSignal[];
  dataMode?: "live" | "cached" | "demo" | "unavailable";
};

/**
 * Campaign Signal output: exactly three blocks per the spec.
 * Only numbers actually fetched may appear in any of them.
 */
export type CampaignSignal = {
  id: string;
  createdAt: string;
  headline: string;
  whatChangedThisWeek: string[];
  whatItMeansForDtc: string[];
  campaignAngles: string[];
  riskLevel: "low" | "medium" | "high";
  confidenceNote: string;
  generation?: GenerationMeta;
};

export type ActivityItem = {
  id: string;
  createdAt: string;
  module: "lead" | "call" | "proposal" | "market";
  title: string;
  detail: string;
};
