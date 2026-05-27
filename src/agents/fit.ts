import {
  fitAssessmentSchema,
  type FitAssessment,
} from "@/src/schemas/fit";
import type { NormalizedProspect } from "@/src/schemas/prospect";
import type { ResearchReport } from "@/src/schemas/research";

type RubricRow = FitAssessment["rubric"][number];

function includesAny(values: string[], patterns: RegExp[]) {
  const haystack = values.join(" ");
  return patterns.some((pattern) => pattern.test(haystack));
}

function makeRubricRow(
  category: string,
  score: number,
  rationale: string,
): RubricRow {
  return {
    category,
    score,
    maxScore: 20,
    rationale,
  };
}

export function scoreProspectFit(
  prospect: NormalizedProspect,
  research: ResearchReport,
): FitAssessment {
  const evidencePool = [...research.groundedFacts, ...research.operationalSignals];
  
  // 1. Target Persona Fit (Founder / Owner / C-level 100%)
  const isIdealPersona = /(founder|owner|ceo|chief|executive|president|c-level|cfo|cto|coo)/i.test(
    prospect.contactRole,
  );
  const isSecondaryPersona = /(director|vp|vice president|manager)/i.test(prospect.contactRole);
  const personaScore = isIdealPersona ? 20 : isSecondaryPersona ? 12 : 6;

  // 2. Company Size / Revenue Fit ($360k+ USD is ideal)
  const revenueScore =
    prospect.estimatedRevenue >= 360000
      ? 20
      : prospect.estimatedRevenue >= 100000
        ? 12
        : 6;

  // 3. Marketing Gaps Relevance
  const mentionsMarketingGap =
    includesAny(evidencePool, [
      /word-of-mouth/i,
      /referral/i,
      /lead gen/i,
      /broken funnel/i,
      /traffic/i,
      /marketing gap/i,
      /static website/i,
    ]) || Boolean(prospect.salesNotes && /marketing|leads|growth|sales/i.test(prospect.salesNotes));
  const marketingGapScore = mentionsMarketingGap ? 18 : 10;

  // 4. Direct Response Fit (Needs 1-Page Marketing Plan, lacks lead capture)
  const hasDirectResponse = includesAny(evidencePool, [
    /lead magnet/i,
    /e-book/i,
    /newsletter/i,
    /subscribe/i,
    /download/i,
    /free resource/i,
    /opt-in/i,
  ]);
  // If they do NOT have direct response, they score higher for fit (high need)
  const directResponseFitScore = !hasDirectResponse ? 18 : 10;

  // 5. Information Completeness
  const completenessScore =
    prospect.contactName && prospect.websiteUrl && prospect.companyName ? 20 : 12;

  const rubric = [
    makeRubricRow(
      "Target Persona Fit",
      personaScore,
      isIdealPersona
        ? `The contact is an ideal decision maker (${prospect.contactRole}).`
        : `The contact is a secondary decision maker (${prospect.contactRole}).`,
    ),
    makeRubricRow(
      "Company Size / Revenue Fit",
      revenueScore,
      prospect.estimatedRevenue >= 360000
        ? `Estimated revenue of $${prospect.estimatedRevenue.toLocaleString()} matches our $360k+ target.`
        : `Estimated revenue of $${prospect.estimatedRevenue.toLocaleString()} is below our primary $360k+ target.`,
    ),
    makeRubricRow(
      "Marketing Gaps Relevance",
      marketingGapScore,
      mentionsMarketingGap
        ? "Explicit or inferred gaps in lead generation or marketing strategy were identified."
        : "No explicit marketing gaps or challenges were found in the research.",
    ),
    makeRubricRow(
      "Direct Response Fit",
      directResponseFitScore,
      !hasDirectResponse
        ? "No clear lead magnet or opt-in funnel found; highly receptive to a 1-Page Marketing Plan."
        : "Some marketing infrastructure exists, but can be optimized with our approach.",
    ),
    makeRubricRow(
      "Information Completeness",
      completenessScore,
      "All critical information (contact name, website, and company details) was successfully provided.",
    ),
  ];

  const totalScore = rubric.reduce((sum, item) => sum + item.score, 0);

  return fitAssessmentSchema.parse({
    totalScore,
    rubric,
    evidence: evidencePool,
    unknowns: research.unknowns,
    risks: research.risks,
  });
}
