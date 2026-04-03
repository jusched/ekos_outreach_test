import { describe, expect, test } from "vitest";

import {
  createEmptyRunRecord,
  normalizeProspectInput,
  normalizedProspectSchema,
  prospectFormSchema,
} from "@/src/schemas/prospect";

describe("prospect schemas", () => {
  test("normalizes trimmed form input into a consistent prospect payload", () => {
    const formInput = {
      clinicName: "  Bright Smile Dental  ",
      websiteUrl: "brightsmile.example.com/services?utm_source=google&utm_campaign=spring",
      specialty: "  general dentistry ",
      location: "  Austin, TX ",
      salesNotes: "  Interested in reducing no-shows.  ",
    };

    const normalized = normalizeProspectInput(formInput);

    expect(normalized).toEqual({
      clinicName: "Bright Smile Dental",
      websiteUrl: "https://brightsmile.example.com/services",
      specialty: "general dentistry",
      location: "Austin, TX",
      salesNotes: "Interested in reducing no-shows.",
      warnings: [],
    });
    expect(normalizedProspectSchema.parse(normalized)).toEqual(normalized);
  });

  test("rejects invalid prospect form payloads before a run starts", () => {
    const result = prospectFormSchema.safeParse({
      clinicName: "",
      websiteUrl: "not-a-url",
      specialty: "",
      location: "",
      salesNotes: 123,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected schema validation to fail");
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "clinicName",
        "websiteUrl",
        "specialty",
        "location",
        "salesNotes",
      ]),
    );
  });

  test("builds a pending run record from normalized prospect data", () => {
    const normalized = normalizedProspectSchema.parse({
      clinicName: "Riverside Family Clinic",
      websiteUrl: "https://riverside.example.com",
      specialty: "family medicine",
      location: "Bogota, Colombia",
      salesNotes: null,
      warnings: ["No sales notes provided."],
    });

    const record = createEmptyRunRecord("run_123", normalized);

    expect(record).toMatchObject({
      id: "run_123",
      status: "pending",
      humanReviewStatus: "pending",
      gmailDraftStatus: "not_started",
      normalizedInput: normalized,
    });
  });
});
