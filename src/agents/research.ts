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
      "You are a clinic sales research analyst.",
      "Extract grounded facts only from the provided website evidence and sales notes.",
      "Do not invent tools, staff counts, specialties, or operational details.",
      "Operational signals may be inferred, but only when directly supported by the evidence.",
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
