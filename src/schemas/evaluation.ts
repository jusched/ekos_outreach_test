import { z } from "zod";

export const evaluationResultSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  requiredFixes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
