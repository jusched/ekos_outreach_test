import type { OutreachDraft } from "@/src/schemas/outreach";
import type { NormalizedProspect } from "@/src/schemas/prospect";
import type { ResearchReport } from "@/src/schemas/research";

type DraftValidationResult = {
  issues: string[];
  requiredFixes: string[];
};

function normalize(text: string) {
  return text.toLowerCase();
}

function tokenize(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function hasMeaningfulOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  let overlaps = 0;

  for (const token of tokenize(right)) {
    if (leftTokens.has(token)) {
      overlaps += 1;
    }
  }

  return overlaps >= 2;
}

export function validateDraftHardRules({
  prospect,
  research,
  draft,
}: {
  prospect: NormalizedProspect;
  research: ResearchReport;
  draft: OutreachDraft;
}): DraftValidationResult {
  const issues: string[] = [];
  const requiredFixes: string[] = [];
  const body = normalize(draft.body);
  const evidencePool = [...research.groundedFacts, ...research.operationalSignals].map(normalize);

  if (!body.includes(normalize(prospect.companyName))) {
    issues.push("The email does not mention the company by name.");
    requiredFixes.push("Reference the company name directly in the email.");
  }

  const firstName = prospect.contactName.trim().split(/\s+/)[0] || prospect.contactName;
  if (!body.includes(normalize(firstName))) {
    issues.push("The email does not mention the contact person's first name.");
    requiredFixes.push(`Address the contact by their first name (${firstName}) directly.`);
  }

  if (body.includes("[first name]") || body.includes("[your name]") || body.includes("[company name]")) {
    issues.push("The email contains unresolved bracket placeholders.");
    requiredFixes.push("Replace all bracket placeholders like [First Name] or [Your Name] with actual values.");
  }

  const requiredLinks = [
    "https://try.leanmarketing.com/our-approach",
    "https://leanmarketing.com/case-studies",
  ];

  for (const link of requiredLinks) {
    if (!body.includes(link)) {
      issues.push(`The email is missing the required link: ${link}`);
      requiredFixes.push(`Include the link exactly: ${link}`);
    }
  }

  const hasGroundedAnchor = draft.personalizationAnchors.some((anchor) =>
    evidencePool.some((evidence) => hasMeaningfulOverlap(anchor, evidence)),
  );

  if (!hasGroundedAnchor) {
    issues.push("Personalization is not grounded in the research evidence.");
    requiredFixes.push("Anchor the opening in one concrete website or notes detail.");
  }

  if (/just checking in|wanted to reach out|touching base/i.test(draft.body)) {
    issues.push("The email uses generic outreach phrasing.");
    requiredFixes.push("Replace generic phrasing with a specific reason for contact.");
  }

  return {
    issues,
    requiredFixes,
  };
}
