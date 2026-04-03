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
  const digitalSignalsPresent = includesAny(evidencePool, [
    /online booking/i,
    /appointment/i,
    /insurance/i,
    /portal/i,
  ]);
  const opsPainPresent =
    includesAny(evidencePool, [/insurance/i, /scheduling/i, /booking/i]) ||
    Boolean(prospect.salesNotes);

  const rubric = [
    makeRubricRow(
      "Clinic segment fit",
      /(dental|dentistry|medical|medicine|clinic)/i.test(
        `${prospect.specialty} ${prospect.clinicName}`,
      )
        ? 20
        : 12,
      "The prospect is explicitly operating as a clinic or practice.",
    ),
    makeRubricRow(
      "Digital operations maturity",
      digitalSignalsPresent ? 18 : 10,
      digitalSignalsPresent
        ? "Website evidence suggests digital scheduling or insurance workflows."
        : "Operational tooling maturity is not strongly evidenced.",
    ),
    makeRubricRow(
      "Operational pain relevance",
      opsPainPresent ? 18 : 8,
      opsPainPresent
        ? "The available evidence points to scheduling, patient intake, or insurance friction."
        : "No direct operational pain point is clearly evidenced yet.",
    ),
    makeRubricRow(
      "Contactability and clarity",
      prospect.location && prospect.websiteUrl ? 17 : 8,
      "The prospect has a usable website and explicit location context.",
    ),
    makeRubricRow(
      "Evidence completeness",
      Math.max(8, 20 - research.unknowns.length * 4),
      research.unknowns.length === 0
        ? "Research contains enough evidence to support personalized outreach."
        : "Open unknowns reduce confidence in a tightly targeted pitch.",
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
