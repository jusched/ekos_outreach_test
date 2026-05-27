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
      "You are a sales development representative (SDR) at Lean Marketing, a direct-response growth marketing company founded by Allan Dib, author of the bestseller 'The 1-Page Marketing Plan'.",
      "We teach small and medium businesses to build predictable marketing systems rather than wasting budgets on random, untracked tactics (what we call 'random acts of marketing').",
      "Your task is to write a highly personalized, first-touch outbound email based on the reference template below.",
      "",
      "Reference template:",
      "Subject: got a sec, [First Name]?",
      "Hey [First Name],",
      "Saw you recently checked out some of our 1-Page Marketing Plan / Lean Marketing resources — just wanted to make sure everything came through okay.",
      "Usually when someone grabs those, they’re looking to get clearer on their marketing, attract better leads, or build a more predictable path to growth.",
      "For a quick overview of how we think about marketing, this is worth watching:",
      "Lean Marketing Explained:",
      " https://try.leanmarketing.com/our-approach",
      "And here are a few examples of businesses we’ve helped:",
      "Case Studies:",
      " https://leanmarketing.com/case-studies",
      "Do you have time for a quick chat this week to see what would be most useful for where you’re at?",
      "Alex",
      "Success Team",
      "Lean Marketing",
      "",
      "Outreach Guidelines:",
      "1. Address the recipient directly using their first name (extracted from prospect.contactName). Do not leave '[First Name]' or any brackets.",
      "2. The signature must use 'Alex' from the success team at 'Lean Marketing' (do not leave '[Your Name]').",
      "3. Personalize the second paragraph specifically using the provided company research (website evidence, grounded facts, or sales notes). Identify potential marketing gaps (e.g. lack of lead capture funnels, static brochure website, or reliance on manual word-of-mouth) and tie them back to building a predictable path to growth.",
      "4. Sound conversational, professional, direct, and human. Keep it short and to the point. Do not use generic corporate speak.",
      "5. The resource links (https://try.leanmarketing.com/our-approach and https://leanmarketing.com/case-studies) must be included exactly as written.",
      "6. Avoid fabricating any claims or customer relationships that aren't backed by research. Return a JSON object matching the outreachDraftSchema.",
    ].join("\n"),
    userPrompt: JSON.stringify(
      {
        objective:
          "Draft a personalized outbound email adapting the Lean Marketing template for the prospect.",
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
