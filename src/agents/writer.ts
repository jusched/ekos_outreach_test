import { generateStructuredObject } from "@/src/lib/openai";
import type { FitAssessment } from "@/src/schemas/fit";
import { outreachDraftSchema } from "@/src/schemas/outreach";
import type { NormalizedProspect } from "@/src/schemas/prospect";
import type { ResearchReport } from "@/src/schemas/research";

export async function runOutreachWriterAgent({
  prospect,
  research,
  fitAssessment,
  requiredFixes,
}: {
  prospect: NormalizedProspect;
  research: ResearchReport;
  fitAssessment: FitAssessment;
  requiredFixes: string[];
}) {
  return await generateStructuredObject({
    schema: outreachDraftSchema,
    schemaName: "outreach_draft",
    systemPrompt: [
      "You write first-touch outbound emails for a sales rep selling practice management software.",
      "The draft must sound human, specific, and concise.",
      "Every personalization point must be grounded in the provided research or sales notes.",
      "Do not fabricate relationships, metrics, or operational pain.",
      "Return one email draft only.",
    ].join(" "),
    userPrompt: JSON.stringify(
      {
        objective:
          "Draft a personalized outreach email that is relevant to the clinic's visible workflows.",
        prospect,
        research,
        fitAssessment,
        requiredFixes,
      },
      null,
      2,
    ),
    temperature: 0.35,
  });
}
