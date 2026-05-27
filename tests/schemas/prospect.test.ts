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
      companyName: "  Agzaga  ",
      websiteUrl: "agzaga.com/services?utm_source=google&utm_campaign=spring",
      contactName: "  John Doe ",
      contactRole: "  Founder ",
      estimatedRevenue: 500000,
      salesNotes: "  Interested in scaling marketing.  ",
    };

    const normalized = normalizeProspectInput(formInput);

    expect(normalized).toEqual({
      companyName: "Agzaga",
      websiteUrl: "https://agzaga.com/services",
      contactName: "John Doe",
      contactRole: "Founder",
      estimatedRevenue: 500000,
      salesNotes: "Interested in scaling marketing.",
      warnings: [],
    });
    expect(normalizedProspectSchema.parse(normalized)).toEqual(normalized);
  });

  test("rejects invalid prospect form payloads before a run starts", () => {
    const result = prospectFormSchema.safeParse({
      companyName: "",
      websiteUrl: "not-a-url",
      contactName: "",
      contactRole: "",
      estimatedRevenue: -100,
      salesNotes: 123,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected schema validation to fail");
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "companyName",
        "websiteUrl",
        "contactName",
        "contactRole",
        "estimatedRevenue",
        "salesNotes",
      ]),
    );
  });

  test("builds a pending run record from normalized prospect data", () => {
    const normalized = normalizedProspectSchema.parse({
      companyName: "Superfast IT",
      websiteUrl: "https://superfast.example.com",
      contactName: "Jane Smith",
      contactRole: "CEO",
      estimatedRevenue: 400000,
      salesNotes: null,
      warnings: ["No sales notes provided."],
    });

    const record = createEmptyRunRecord("run_123", normalized);

    expect(record).toMatchObject({
      id: "run_123",
      status: "pending",
      humanReviewStatus: "approved",
      gmailDraftStatus: "not_started",
      normalizedInput: normalized,
    });
  });
});
