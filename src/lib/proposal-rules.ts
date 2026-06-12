import type {
  CompanionEmail,
  DiscoveryExtraction,
  ProposalSection,
  SectionValidation,
  ValidationIssue,
} from "@/lib/types";

export type { SectionValidation, ValidationIssue };

/**
 * Hard rules from the Move proposal guide, encoded as post-generation
 * validators. These run on every generated or revised section (LLM and
 * fallback alike) and surface issues in the UI for human review. They never
 * silently rewrite content, with one exception: em dashes are auto-replaced
 * before display (see scrubEmDashes in utils).
 */

// Only these role names may appear in the Section 2 package table. Not
// defined anywhere in content/, so this constant is the editable source of
// truth (documented in README).
export const MOVE_OFFICIAL_ROLES = [
  "Engagement Lead",
  "Fractional Supply Chain Lead",
  "Sourcing Specialist",
  "Logistics Specialist",
  "Inventory Planner",
  "Supply Chain Analyst",
];

export const SECTION_TITLES = [
  "Cover and Context",
  "Engagement Options",
  "Transitional Timeline",
  "Recommended Engagement Path",
  "Service Levels",
  "Scope Pillars",
  "Investment, Assumptions, and Next Steps",
];

type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

export function parseMarkdownTables(content: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  const lines = content.split("\n");
  let current: string[] = [];

  const flush = () => {
    if (current.length >= 2) {
      const [headerLine, ...rest] = current;
      const headers = splitRow(headerLine);
      const rows = rest
        .filter((line) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line))
        .map(splitRow)
        .filter((row) => row.length > 0);
      if (headers.length >= 2) tables.push({ headers, rows });
    }
    current = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      current.push(line);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function countBullets(content: string) {
  return content
    .split("\n")
    .filter((line) => /^\s{0,2}[-*]\s+\S/.test(line))
    .filter((line) => line.replace(/^\s*[-*]\s+/, "").split(/\s+/).length >= 4).length;
}

/**
 * Option 3 (Fractional Supply Chain Support) appears only when the extracted
 * facts justify ongoing support per the guide's decision tree:
 * three or more distinct pain categories, a leadership/bandwidth pain, or
 * explicit recurring-support signals in the discovery language.
 */
export function option3Justified(facts?: DiscoveryExtraction | null): { justified: boolean; reason: string } {
  if (!facts) return { justified: false, reason: "No extracted facts available." };

  const categories = new Set(facts.painPoints.map((pain) => pain.category));
  if (facts.painPoints.some((pain) => pain.category === "leadership")) {
    return { justified: true, reason: "Discovery shows founder or leadership bandwidth pain." };
  }
  if (categories.size >= 3) {
    return { justified: true, reason: `Discovery shows pain across ${categories.size} distinct areas.` };
  }
  const recurringSignal = [...facts.desiredOutcomes, ...facts.constraints, ...facts.urgencySignals]
    .join(" ")
    .toLowerCase();
  if (/ongoing|recurring|fractional|long.?term|every month|continuous/.test(recurringSignal)) {
    return { justified: true, reason: "Discovery language signals an ongoing support need." };
  }
  return {
    justified: false,
    reason: "Facts show a focused need; the guide's decision tree keeps this to two options.",
  };
}

export function validateSection(
  sectionNumber: number,
  content: string,
  facts?: DiscoveryExtraction | null,
): SectionValidation {
  const issues: ValidationIssue[] = [];

  if (/—/.test(content)) {
    issues.push({
      rule: "no-em-dashes",
      message: "Em dashes found. They are auto-replaced before display, but regenerate if formatting looks off.",
      severity: "warning",
    });
  }

  if (!content.trim()) {
    return { sectionNumber, passed: false, issues: [{ rule: "empty", message: "Section has no content yet.", severity: "error" }] };
  }

  switch (sectionNumber) {
    case 1: {
      const bullets = countBullets(content);
      if (bullets < 5 || bullets > 8) {
        issues.push({
          rule: "s1-pain-bullets",
          message: `Section 1 must contain 5 to 8 specific pain bullets. Found ${bullets}.`,
          severity: "error",
        });
      }
      break;
    }
    case 2: {
      const tables = parseMarkdownTables(content);
      const packageTable = tables.find((table) =>
        ["cost", "hours", "duration"].every((column) =>
          table.headers.some((header) => header.toLowerCase().includes(column)),
        ),
      );
      if (!packageTable) {
        issues.push({
          rule: "s2-package-table",
          message: "Section 2 must include a package table with Name, Cost, Hours, and Duration columns.",
          severity: "error",
        });
        break;
      }
      const nameColumn = packageTable.headers.findIndex((header) => /name|package|option/i.test(header));
      if (nameColumn === -1) {
        issues.push({
          rule: "s2-package-table",
          message: "The package table is missing a package name column.",
          severity: "error",
        });
      }
      const rolesColumn = packageTable.headers.findIndex((header) => /role/i.test(header));
      if (rolesColumn === -1) {
        issues.push({
          rule: "s2-roles",
          message: "The package table must include a Move Roles column.",
          severity: "error",
        });
      } else {
        for (const row of packageTable.rows) {
          const cell = row[rolesColumn] ?? "";
          const roles = cell
            .split(/,|;|\+|\band\b/)
            .map((role) => role.trim())
            .filter(Boolean);
          const unofficial = roles.filter(
            (role) => !MOVE_OFFICIAL_ROLES.some((official) => official.toLowerCase() === role.toLowerCase()),
          );
          if (unofficial.length) {
            issues.push({
              rule: "s2-roles",
              message: `Unofficial role name(s) in the package table: ${unofficial.join(", ")}. Allowed: ${MOVE_OFFICIAL_ROLES.join(", ")}.`,
              severity: "error",
            });
          }
        }
      }
      const hasOption3 = /option\s*3/i.test(content);
      const decision = option3Justified(facts);
      if (hasOption3 && !decision.justified) {
        issues.push({
          rule: "s2-option3",
          message: `Option 3 is present but the facts do not justify it. ${decision.reason}`,
          severity: "error",
        });
      }
      if (!hasOption3 && decision.justified) {
        issues.push({
          rule: "s2-option3",
          message: `The facts justify an Option 3 (${decision.reason}) but the section only offers two.`,
          severity: "warning",
        });
      }
      break;
    }
    case 3: {
      if (parseMarkdownTables(content).length === 0) {
        issues.push({
          rule: "s3-table",
          message: "Section 3 must render the transitional timeline as a table.",
          severity: "error",
        });
      }
      break;
    }
    case 5: {
      const tables = parseMarkdownTables(content);
      const slaTable = tables.find((table) => table.headers.length === 3);
      if (!slaTable) {
        issues.push({
          rule: "s5-sla-table",
          message: "Section 5 must contain an SLA table with exactly three columns: KPI, Commitment, Metrics.",
          severity: "error",
        });
        break;
      }
      const expected = ["kpi", "commitment", "metrics"];
      const headersOk = slaTable.headers.every((header, index) => header.toLowerCase().includes(expected[index]));
      if (!headersOk) {
        issues.push({
          rule: "s5-sla-table",
          message: `SLA table columns must be KPI, Commitment, Metrics. Found: ${slaTable.headers.join(", ")}.`,
          severity: "error",
        });
      }
      if (slaTable.rows.length < 3 || slaTable.rows.length > 5) {
        issues.push({
          rule: "s5-sla-rows",
          message: `SLA table must have 3 to 5 rows. Found ${slaTable.rows.length}.`,
          severity: "error",
        });
      }
      break;
    }
    case 6: {
      const pillarBlocks = content
        .split(/\n(?=#{2,3}\s)/)
        .filter((block) => /pillar/i.test(block.split("\n")[0] ?? "") || /objective/i.test(block));
      const blocks = pillarBlocks.length ? pillarBlocks : [content];
      let pillarCount = 0;
      for (const block of blocks) {
        const hasObjective = /objective/i.test(block);
        const hasApproach = /approach/i.test(block);
        const hasOutcome = /expected outcome/i.test(block);
        if (hasObjective || hasApproach || hasOutcome) {
          pillarCount += 1;
          if (!hasObjective || !hasApproach || !hasOutcome) {
            issues.push({
              rule: "s6-pillars",
              message: "Each scope pillar must contain Objective, Approach, and Expected Outcome.",
              severity: "error",
            });
          }
        }
      }
      if (pillarCount === 0) {
        issues.push({
          rule: "s6-pillars",
          message: "Section 6 must contain scope pillars, each with Objective, Approach, and Expected Outcome.",
          severity: "error",
        });
      }
      break;
    }
    default:
      break;
  }

  return {
    sectionNumber,
    passed: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

/**
 * Cross-section consistency: pricing and duration must match wherever they
 * appear. Mismatches are flagged for human review, never silently corrected.
 */
export function checkConsistency(sections: ProposalSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const withContent = sections.filter((section) => section.content.trim());

  const moneyBySection = new Map<number, string[]>();
  for (const section of withContent) {
    const amounts = [...section.content.matchAll(/\$\s?[\d,]+(?:\.\d+)?(?:\s?[kKmM])?/g)].map((match) =>
      match[0].replace(/\s/g, ""),
    );
    if (amounts.length) moneyBySection.set(section.number, [...new Set(amounts)]);
  }

  const pricingSections = [2, 7].filter((number) => moneyBySection.has(number));
  if (pricingSections.length === 2) {
    const [a, b] = pricingSections.map((number) => moneyBySection.get(number)!);
    const missingInSeven = a.filter((amount) => !b.includes(amount));
    const extraInSeven = b.filter((amount) => !a.includes(amount));
    if (missingInSeven.length || extraInSeven.length) {
      issues.push({
        rule: "pricing-consistency",
        message: `Pricing differs between Section 2 (${a.join(", ")}) and Section 7 (${b.join(", ")}). Review before sending.`,
        severity: "error",
      });
    }
  }

  const durationBySection = new Map<number, string[]>();
  for (const section of withContent) {
    const durations = [...section.content.matchAll(/\b\d+\s?(?:to\s?\d+\s?)?(?:weeks?|months?)\b/gi)].map((match) =>
      match[0].toLowerCase().replace(/\s+/g, " "),
    );
    if (durations.length) durationBySection.set(section.number, [...new Set(durations)]);
  }

  const longest = (values: string[]) =>
    Math.max(...values.map((value) => Number(value.match(/(\d+)\s?(?:weeks?|months?)/)?.[1] ?? 0) * (value.includes("month") ? 4 : 1)));
  const sectionsWithDuration = [2, 3, 7].filter((number) => durationBySection.has(number));
  if (sectionsWithDuration.length >= 2) {
    const spans = sectionsWithDuration.map((number) => ({ number, max: longest(durationBySection.get(number)!) }));
    const reference = spans[0];
    for (const span of spans.slice(1)) {
      if (reference.max && span.max && Math.abs(span.max - reference.max) > reference.max * 0.5) {
        issues.push({
          rule: "duration-consistency",
          message: `Engagement length looks inconsistent: Section ${reference.number} mentions up to ~${reference.max} weeks while Section ${span.number} mentions ~${span.max} weeks. Review before sending.`,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

const BANNED_EMAIL_PHRASES = ["just checking in", "wanted to follow up", "touching base", "circling back"];

const CTA_PATTERNS = [
  /\?/g,
  /\b(?:let me know|reply to this|book a|schedule a|grab (?:a )?time|can you confirm|confirm by|pick a time)\b/gi,
];

export function validateCompanionEmail(email: CompanionEmail): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!/move supply chain/i.test(email.subject)) {
    issues.push({
      rule: "email-subject",
      message: "The subject line must reference Move Supply Chain.",
      severity: "error",
    });
  }

  const lower = `${email.subject}\n${email.body}`.toLowerCase();
  for (const phrase of BANNED_EMAIL_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        rule: "email-banned-phrase",
        message: `Banned phrase found: "${phrase}".`,
        severity: "error",
      });
    }
  }

  const bullets = email.body.split("\n").filter((line) => /^\s*[-*•]\s+\S/.test(line)).length;
  if (bullets > 4) {
    issues.push({
      rule: "email-bullets",
      message: `Email has ${bullets} bullets. Keep it to 3 or 4 crisp bullets.`,
      severity: "error",
    });
  }

  const bodyWithoutBullets = email.body
    .split("\n")
    .filter((line) => !/^\s*[-*•]\s+/.test(line))
    .join("\n");
  let ctaCount = 0;
  for (const pattern of CTA_PATTERNS) {
    ctaCount += [...bodyWithoutBullets.matchAll(pattern)].length;
  }
  if (ctaCount === 0) {
    issues.push({
      rule: "email-cta",
      message: "No clear call to action found. The email needs exactly one.",
      severity: "error",
    });
  } else if (ctaCount > 1) {
    issues.push({
      rule: "email-cta",
      message: `Found ${ctaCount} call-to-action signals. The email must have exactly one CTA.`,
      severity: "warning",
    });
  }

  if (/—/.test(email.body) || /—/.test(email.subject)) {
    issues.push({
      rule: "no-em-dashes",
      message: "Em dashes found in the email. They are auto-replaced before display.",
      severity: "warning",
    });
  }

  return issues;
}
