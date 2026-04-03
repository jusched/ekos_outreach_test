import { generateStructuredObject } from "@/src/lib/openai";
import { evaluationResultSchema } from "@/src/schemas/evaluation";
import type { FitAssessment } from "@/src/schemas/fit";
import type { OutreachDraft } from "@/src/schemas/outreach";
import type { NormalizedProspect } from "@/src/schemas/prospect";
import type { ResearchReport } from "@/src/schemas/research";

export async function runEvaluatorAgent({
  prospect,
  research,
  fitAssessment,
  draft,
  deterministicIssues,
}: {
  prospect: NormalizedProspect;
  research: ResearchReport;
  fitAssessment: FitAssessment;
  draft: OutreachDraft;
  deterministicIssues: string[];
}) {
  return await generateStructuredObject({
    schema: evaluationResultSchema,
    schemaName: "evaluation_result",
    systemPrompt: [
      "You are the final evaluator before a Gmail draft is created.",
      "Check whether the email is relevant, evidence-grounded, personalized, and safe.",
      "Flag unsupported claims, weak personalization, generic phrasing, and tone problems.",
      "Treat deterministic issues as real blockers unless the draft directly resolves them.",
    ].join(" "),
    userPrompt: JSON.stringify(
      {
        prospect,
        research,
        fitAssessment,
        draft,
        deterministicIssues,
      },
      null,
      2,
    ),
    temperature: 0.1,
  });
}
