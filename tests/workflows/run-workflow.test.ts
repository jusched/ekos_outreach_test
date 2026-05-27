import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createAppDatabase } from "@/src/db/client";
import {
  executeProspectWorkflow,
} from "@/src/workflows/run-workflow";

const tempDirs: string[] = [];

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), "sales-agent-workflow-"));
  tempDirs.push(dir);
  return join(dir, "app.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createWorkflowHarness() {
  const database = createAppDatabase({
    filename: createTempDbPath(),
    appSecret: "test-secret",
  });

  const fetchWebsite = vi.fn(async (url: string) => {
    if (url.endsWith("/about")) {
      return `
        <html><body><h1>About Bright Smile Dental</h1><p>Online booking and insurance support.</p></body></html>
      `;
    }

    return `
      <html>
        <body>
          <h1>Bright Smile Dental</h1>
          <a href="/about">About Us</a>
          <p>Book online and verify insurance before your visit.</p>
        </body>
      </html>
    `;
  });

  return {
    database,
    fetchWebsite,
  };
}

describe("prospect workflow", () => {
  test("runs the happy path through evaluator approval and marks completed", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          companyName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          contactName: "John Doe",
          contactRole: "Founder",
          estimatedRevenue: 400000,
          salesNotes: "Interested in scaling marketing.",
        },
        database,
        fetchWebsite,
        researchAgent: async () => ({
          groundedFacts: [
            "Bright Smile Dental is looking to scale their marketing.",
            "They rely on word-of-mouth referral networks.",
          ],
          operationalSignals: ["Their website has no email signup forms."],
          unknowns: [],
          risks: [],
          sourcePages: [
            {
              pageUrl: "https://brightsmile.example.com/",
              textSnippet: "We serve patients in the local Austin community.",
            },
          ],
          confidence: 0.86,
        }),
        writerAgent: async () => ({
          subject: "got a sec, John?",
          body: "Hi John,\n\nI noticed Bright Smile Dental is looking to scale their marketing. Check out our approach at https://try.leanmarketing.com/our-approach and case studies at https://leanmarketing.com/case-studies.\n\nBest,\nAlex",
          personalizationAnchors: [
            "I noticed Bright Smile Dental is looking to scale.",
          ],
          claimsMade: [
            "Bright Smile Dental is looking to scale.",
          ],
          callToAction: "Open to a quick chat?",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 91,
          issues: [],
          requiredFixes: [],
          confidence: 0.84,
        }),
      });

      expect(workflow.status).toBe("completed");

      const detail = database.getRunDetail(workflow.runId);
      expect(detail?.run.status).toBe("completed");
      expect(detail?.run.humanReviewStatus).toBe("approved");
    } finally {
      database.close();
    }
  });

  test("falls back to notes-only research when website fetch fails", async () => {
    const database = createAppDatabase({
      filename: createTempDbPath(),
      appSecret: "test-secret",
    });

    try {
      const researchAgent = vi.fn(async ({ prospect }) => ({
        groundedFacts: [`Sales note: ${prospect.salesNotes}`],
        operationalSignals: [],
        unknowns: ["Website could not be fetched."],
        risks: ["Website fetch failed during research."],
        sourcePages: [],
        confidence: 0.42,
      }));

      const workflow = await executeProspectWorkflow({
        input: {
          companyName: "Riverside Clinic",
          websiteUrl: "https://riverside.example.com",
          contactName: "John Doe",
          contactRole: "Founder",
          estimatedRevenue: 400000,
          salesNotes: "Asked about reducing missed appointments.",
        },
        database,
        fetchWebsite: async () => {
          throw new Error("fetch failed");
        },
        researchAgent,
        writerAgent: async () => ({
          subject: "got a sec, John?",
          body: "Hi John,\n\nI noticed Riverside Clinic has questions about reducing missed appointments.\nCheck out our approach at https://try.leanmarketing.com/our-approach and case studies at https://leanmarketing.com/case-studies.\n\nBest,\nAlex",
          personalizationAnchors: ["Asked about reducing missed appointments."],
          claimsMade: ["You mentioned reducing missed appointments."],
          callToAction: "Open to a short intro?",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 80,
          issues: [],
          requiredFixes: [],
          confidence: 0.67,
        }),
      });

      expect(workflow.status).toBe("completed");
      expect(researchAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          websiteEvidence: [],
        }),
      );
    } finally {
      database.close();
    }
  });

  test("fails the run when an agent returns malformed structured output", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          companyName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          contactName: "John Doe",
          contactRole: "Founder",
          estimatedRevenue: 400000,
          salesNotes: "Interested in reducing no-shows.",
        },
        database,
        fetchWebsite,
        researchAgent: async () => ({
          groundedFacts: ["The clinic supports online booking."],
          operationalSignals: [],
          unknowns: [],
          risks: [],
          sourcePages: [],
          confidence: 0.8,
        }),
        writerAgent: async () => ({
          subject: "Missing body draft",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 90,
          issues: [],
          requiredFixes: [],
          confidence: 0.8,
        }),
      });

      const detail = database.getRunDetail(workflow.runId);

      expect(workflow.status).toBe("failed");
      expect(detail?.run.status).toBe("failed");
      expect(detail?.runEvents.some((event) => event.level === "error")).toBe(true);
    } finally {
      database.close();
    }
  });

  test("auto-revises once after evaluator rejection and stops when approved", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();
    const writerAgent = vi
      .fn()
      .mockResolvedValueOnce({
        subject: "Generic intro",
        body: "Hi there,\n\nWanted to reach out.\n\nBest,\nAlex",
        personalizationAnchors: [],
        claimsMade: [],
        callToAction: "Open to chatting?",
      })
      .mockResolvedValueOnce({
        subject: "got a sec, John?",
        body: "Hi John,\n\nI noticed Bright Smile Dental could scale their marketing.\nCheck out our approach at https://try.leanmarketing.com/our-approach and case studies at https://leanmarketing.com/case-studies.\n\nBest,\nAlex",
        personalizationAnchors: ["Bright Smile Dental could scale their marketing."],
        claimsMade: ["Bright Smile Dental could scale their marketing."],
        callToAction: "Open to a quick intro?",
      });

    const evaluatorAgent = vi
      .fn()
      .mockResolvedValueOnce({
        approved: false,
        score: 51,
        issues: ["Too generic."],
        requiredFixes: ["Ground the opening in website evidence."],
        confidence: 0.7,
      })
      .mockResolvedValueOnce({
        approved: true,
        score: 88,
        issues: [],
        requiredFixes: [],
        confidence: 0.78,
      });

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          companyName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          contactName: "John Doe",
          contactRole: "Founder",
          estimatedRevenue: 400000,
          salesNotes: null,
        },
        database,
        fetchWebsite,
        researchAgent: async () => ({
          groundedFacts: ["Bright Smile Dental could scale their marketing."],
          operationalSignals: [],
          unknowns: [],
          risks: [],
          sourcePages: [],
          confidence: 0.76,
        }),
        writerAgent,
        evaluatorAgent,
      });

      const detail = database.getRunDetail(workflow.runId);
      const writerStages =
        detail?.stageResults.filter((stage) => stage.stageName === "outreach_writer") ?? [];

      expect(workflow.status).toBe("completed");
      expect(writerAgent).toHaveBeenCalledTimes(2);
      expect(evaluatorAgent).toHaveBeenCalledTimes(2);
      expect(writerStages).toHaveLength(2);
    } finally {
      database.close();
    }
  });

  test("stops after the max evaluator retries and keeps Gmail blocked", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          companyName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          contactName: "John Doe",
          contactRole: "Founder",
          estimatedRevenue: 400000,
          salesNotes: null,
        },
        database,
        fetchWebsite,
        researchAgent: async () => ({
          groundedFacts: ["The clinic supports online booking."],
          operationalSignals: [],
          unknowns: [],
          risks: [],
          sourcePages: [],
          confidence: 0.76,
        }),
        writerAgent: async () => ({
          subject: "Generic intro",
          body: "Hi there,\n\nWanted to reach out.\n\nBest,\nAlex",
          personalizationAnchors: [],
          claimsMade: [],
          callToAction: "Open to chatting?",
        }),
        evaluatorAgent: async () => ({
          approved: false,
          score: 40,
          issues: ["Too generic."],
          requiredFixes: ["Ground the opening in website evidence."],
          confidence: 0.69,
        }),
      });

      const detail = database.getRunDetail(workflow.runId);
      const evaluatorStages =
        detail?.stageResults.filter((stage) => stage.stageName === "evaluation") ?? [];

      expect(workflow.status).toBe("failed");
      expect(detail?.run.gmailDraftStatus).toBe("blocked");
      expect(evaluatorStages).toHaveLength(3);
    } finally {
      database.close();
    }
  });
});
