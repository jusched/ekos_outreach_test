import { z } from "zod";

export const gmailDraftResultSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1).optional(),
});

export type GmailDraftResult = z.infer<typeof gmailDraftResultSchema>;
