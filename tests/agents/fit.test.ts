import { describe, expect, test } from "vitest";

import { scoreProspectFit } from "@/src/agents/fit";

describe("fit scoring", () => {
  test("scores clinic fit with explicit evidence and unknowns", () => {
    const assessment = scoreProspectFit({
      clinicName: "Bright Smile Dental",
      websiteUrl: "https://brightsmile.example.com",
      specialty: "dentistry",
      location: "Austin, TX",
      salesNotes: "Interested in fewer no-shows.",
      warnings: [],
    }, {
      groundedFacts: [
        "The clinic offers online booking.",
        "The clinic highlights insurance verification support.",
      ],
      operationalSignals: [
        "The clinic appears to manage appointment volume digitally.",
      ],
      unknowns: ["No evidence of current practice management vendor."],
      risks: [],
      sourcePages: [
        {
          pageUrl: "https://brightsmile.example.com/",
          textSnippet: "Book online and verify insurance before your visit.",
        },
      ],
      confidence: 0.82,
    });

    expect(assessment.totalScore).toBeGreaterThan(60);
    expect(assessment.totalScore).toBeLessThanOrEqual(100);
    expect(assessment.rubric).toHaveLength(5);
    expect(assessment.evidence.join(" ")).toContain("online booking");
    expect(assessment.unknowns).toContain(
      "No evidence of current practice management vendor.",
    );
  });
});
