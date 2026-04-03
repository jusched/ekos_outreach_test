import { z } from "zod";

export const sourcePageSchema = z.object({
  pageUrl: z.string().min(1),
  textSnippet: z.string().min(1),
});

export const pageEvidenceSchema = z.object({
  pageUrl: z.string().min(1),
  text: z.string().min(1),
});

export const researchReportSchema = z.object({
  groundedFacts: z.array(z.string()),
  operationalSignals: z.array(z.string()),
  unknowns: z.array(z.string()),
  risks: z.array(z.string()),
  sourcePages: z.array(sourcePageSchema),
  confidence: z.number().min(0).max(1),
});

export type PageEvidence = z.infer<typeof pageEvidenceSchema>;
export type ResearchReport = z.infer<typeof researchReportSchema>;
