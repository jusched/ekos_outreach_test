import { z } from "zod";

export const outreachDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  personalizationAnchors: z.array(z.string()),
  claimsMade: z.array(z.string()),
  callToAction: z.string().min(1),
});

export type OutreachDraft = z.infer<typeof outreachDraftSchema>;
