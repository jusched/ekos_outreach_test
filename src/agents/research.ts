import { generateStructuredObject } from "@/src/lib/openai";
import type { NormalizedProspect } from "@/src/schemas/prospect";
import { researchReportSchema, type PageEvidence } from "@/src/schemas/research";

export async function runResearchAgent({
  prospect,
  websiteEvidence,
}: {
  prospect: NormalizedProspect;
  websiteEvidence: PageEvidence[];
}) {
  return await generateStructuredObject({
    schema: researchReportSchema,
    schemaName: "research_report",
    systemPrompt: [
      "You are a sales research analyst for Lean Marketing, a growth marketing company.",
      "Extract grounded facts only from the provided website evidence and sales notes.",
      "Do not invent tools, employee counts, current marketing systems, or operational details.",
      "Focus on identifying: the company's business model, visible marketing elements (such as lead magnets, newsletters, conversion calls-to-action), potential marketing challenges (e.g. relying only on word-of-mouth, lack of a structured funnel), and evidence of company size/revenue.",
      "Unknowns and risks should be explicit.",
    ].join(" "),
    userPrompt: JSON.stringify(
      {
        prospect,
        websiteEvidence: websiteEvidence.map((page) => ({
          pageUrl: page.pageUrl,
          text: page.text.slice(0, 5000),
        })),
      },
      null,
      2,
    ),
    temperature: 0.1,
  });
}
