import { describe, expect, test } from "vitest";

import { scoreProspectFit } from "@/src/agents/fit";

describe("fit scoring", () => {
  test("scores company fit with explicit evidence and unknowns", () => {
    const assessment = scoreProspectFit({
      companyName: "Agzaga",
      websiteUrl: "https://agzaga.com",
      contactName: "John Doe",
      contactRole: "Founder",
      estimatedRevenue: 500000,
      salesNotes: "Interested in scaling marketing.",
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
