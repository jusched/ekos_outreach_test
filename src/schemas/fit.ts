import { z } from "zod";

export const fitRubricItemSchema = z.object({
  category: z.string().min(1),
  score: z.number().min(0).max(20),
  maxScore: z.literal(20),
  rationale: z.string().min(1),
});

export const fitAssessmentSchema = z.object({
  totalScore: z.number().min(0).max(100),
  rubric: z.array(fitRubricItemSchema).length(5),
  evidence: z.array(z.string()),
  unknowns: z.array(z.string()),
  risks: z.array(z.string()),
});

export type FitAssessment = z.infer<typeof fitAssessmentSchema>;
