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
      "You are the final quality control evaluator at Lean Marketing before an outbound email is shown to the SDR.",
      "Check whether the email draft is relevant, evidence-grounded, personalized, and matches the Lean Marketing tone (conversational, professional, direct, human).",
      "Flag: lack of specific personalization (e.g. failing to mention details about the prospect's company or industry), hallucinated facts not in the research, leftover placeholders (like '[First Name]', '[Your Name]', '[Company Name]'), missing required URLs, and salesy, hype-filled, or overly formal tone.",
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
