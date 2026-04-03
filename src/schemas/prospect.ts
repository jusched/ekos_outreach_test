import { z } from "zod";

const websitePattern =
  /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;

const trimmedRequiredString = (field: string) =>
  z.string().trim().min(1, `${field} is required.`);

export const prospectFormSchema = z.object({
  clinicName: trimmedRequiredString("Clinic name"),
  websiteUrl: trimmedRequiredString("Website URL").refine(
    (value) => websitePattern.test(value),
    "Website URL must be a valid clinic website.",
  ),
  specialty: trimmedRequiredString("Specialty"),
  location: trimmedRequiredString("Location"),
  salesNotes: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const normalizedProspectSchema = z.object({
  clinicName: z.string().min(1),
  websiteUrl: z.string().url(),
  specialty: z.string().min(1),
  location: z.string().min(1),
  salesNotes: z.string().min(1).nullable(),
  warnings: z.array(z.string()),
});

export const runRecordSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "pending",
    "running",
    "needs_review",
    "completed",
    "failed",
  ]),
  humanReviewStatus: z.enum(["pending", "approved", "rejected"]),
  gmailDraftStatus: z.enum([
    "not_started",
    "blocked",
    "created",
    "failed",
  ]),
  normalizedInput: normalizedProspectSchema,
});

export type ProspectFormInput = z.infer<typeof prospectFormSchema>;
export type NormalizedProspect = z.infer<typeof normalizedProspectSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;

function normalizeWebsiteUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  url.search = "";
  url.hash = "";

  return url.toString();
}

function normalizeOptionalNotes(notes: ProspectFormInput["salesNotes"]) {
  if (typeof notes !== "string") {
    return null;
  }

  const trimmed = notes.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeProspectInput(
  rawInput: ProspectFormInput,
): NormalizedProspect {
  const parsed = prospectFormSchema.parse(rawInput);
  const salesNotes = normalizeOptionalNotes(parsed.salesNotes);
  const warnings = salesNotes ? [] : ["No sales notes provided."];

  return normalizedProspectSchema.parse({
    clinicName: parsed.clinicName.trim(),
    websiteUrl: normalizeWebsiteUrl(parsed.websiteUrl),
    specialty: parsed.specialty.trim().toLowerCase(),
    location: parsed.location.trim(),
    salesNotes,
    warnings,
  });
}

export function createEmptyRunRecord(
  id: string,
  normalizedInput: NormalizedProspect,
): RunRecord {
  return runRecordSchema.parse({
    id,
    status: "pending",
    humanReviewStatus: "pending",
    gmailDraftStatus: "not_started",
    normalizedInput,
  });
}
