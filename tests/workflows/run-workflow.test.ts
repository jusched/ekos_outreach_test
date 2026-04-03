import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createAppDatabase } from "@/src/db/client";
import {
  applyHumanReviewDecision,
  createGmailDraftForRun,
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
  test("runs the happy path through human approval and Gmail draft creation", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();
    const gmailClient = {
      createDraft: vi.fn(async () => ({ id: "draft_123", messageId: "msg_123" })),
    };

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
          salesNotes: "Interested in reducing no-shows.",
        },
        database,
        fetchWebsite,
        researchAgent: async () => ({
          groundedFacts: [
            "The clinic supports online booking.",
            "The clinic mentions insurance verification.",
          ],
          operationalSignals: ["The website emphasizes digital patient intake."],
          unknowns: [],
          risks: [],
          sourcePages: [
            {
              pageUrl: "https://brightsmile.example.com/",
              textSnippet: "Book online and verify insurance before your visit.",
            },
          ],
          confidence: 0.86,
        }),
        writerAgent: async () => ({
          subject: "Idea for Bright Smile Dental's booking workflow",
          body: "Hi team,\n\nI noticed Bright Smile Dental highlights online booking and insurance verification.\n\nBest,\nAlex",
          personalizationAnchors: [
            "Bright Smile Dental highlights online booking and insurance verification.",
          ],
          claimsMade: [
            "Bright Smile Dental highlights online booking and insurance verification.",
          ],
          callToAction: "Open to a quick look at scheduling and front-desk workflow improvements?",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 91,
          issues: [],
          requiredFixes: [],
          confidence: 0.84,
        }),
      });

      expect(workflow.status).toBe("needs_review");

      await applyHumanReviewDecision({
        runId: workflow.runId,
        approved: true,
        database,
      });
      database.saveGmailAccount({
        email: "rep@example.com",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiryDate: 1730000000000,
      });

      const draft = await createGmailDraftForRun({
        runId: workflow.runId,
        recipientEmail: "manager@brightsmile.example.com",
        database,
        gmailClient,
      });

      const detail = database.getRunDetail(workflow.runId);

      expect(draft.id).toBe("draft_123");
      expect(gmailClient.createDraft).toHaveBeenCalledTimes(1);
      expect(detail?.run.gmailDraftStatus).toBe("created");
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
          clinicName: "Riverside Clinic",
          websiteUrl: "https://riverside.example.com",
          specialty: "family medicine",
          location: "Bogota, Colombia",
          salesNotes: "Asked about reducing missed appointments.",
        },
        database,
        fetchWebsite: async () => {
          throw new Error("fetch failed");
        },
        researchAgent,
        writerAgent: async () => ({
          subject: "Quick idea for Riverside Clinic",
          body: "Hi Riverside Clinic team,\n\nYou mentioned reducing missed appointments.\n\nBest,\nAlex",
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

      expect(workflow.status).toBe("needs_review");
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
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
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
        subject: "Idea for Bright Smile Dental's booking workflow",
        body: "Hi team,\n\nI noticed Bright Smile Dental highlights online booking.\n\nBest,\nAlex",
        personalizationAnchors: ["Bright Smile Dental highlights online booking."],
        claimsMade: ["Bright Smile Dental highlights online booking."],
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
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
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
        writerAgent,
        evaluatorAgent,
      });

      const detail = database.getRunDetail(workflow.runId);
      const writerStages =
        detail?.stageResults.filter((stage) => stage.stageName === "outreach_writer") ?? [];

      expect(workflow.status).toBe("needs_review");
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
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
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

  test("prevents Gmail draft creation after human rejection", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();
    const gmailClient = {
      createDraft: vi.fn(async () => ({ id: "draft_123", messageId: "msg_123" })),
    };

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
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
          subject: "Idea for Bright Smile Dental",
          body: "Hi Bright Smile Dental team,\n\nI noticed your online booking flow.\n\nBest,\nAlex",
          personalizationAnchors: ["The clinic supports online booking."],
          claimsMade: ["The clinic supports online booking."],
          callToAction: "Open to a quick intro?",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 90,
          issues: [],
          requiredFixes: [],
          confidence: 0.8,
        }),
      });

      await applyHumanReviewDecision({
        runId: workflow.runId,
        approved: false,
        database,
      });

      await expect(
        createGmailDraftForRun({
          runId: workflow.runId,
          recipientEmail: "manager@brightsmile.example.com",
          database,
          gmailClient,
        }),
      ).rejects.toThrow("Human review must approve");

      expect(gmailClient.createDraft).not.toHaveBeenCalled();
    } finally {
      database.close();
    }
  });

  test("keeps artifacts and marks blocked or failed when Gmail auth or draft creation is unavailable", async () => {
    const { database, fetchWebsite } = createWorkflowHarness();

    try {
      const workflow = await executeProspectWorkflow({
        input: {
          clinicName: "Bright Smile Dental",
          websiteUrl: "https://brightsmile.example.com",
          specialty: "dentistry",
          location: "Austin, TX",
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
          subject: "Idea for Bright Smile Dental",
          body: "Hi Bright Smile Dental team,\n\nI noticed your online booking flow.\n\nBest,\nAlex",
          personalizationAnchors: ["The clinic supports online booking."],
          claimsMade: ["The clinic supports online booking."],
          callToAction: "Open to a quick intro?",
        }),
        evaluatorAgent: async () => ({
          approved: true,
          score: 90,
          issues: [],
          requiredFixes: [],
          confidence: 0.8,
        }),
      });

      await applyHumanReviewDecision({
        runId: workflow.runId,
        approved: true,
        database,
      });

      await expect(
        createGmailDraftForRun({
          runId: workflow.runId,
          recipientEmail: "manager@brightsmile.example.com",
          database,
        }),
      ).rejects.toThrow("No Gmail account connected");

      database.saveGmailAccount({
        email: "rep@example.com",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiryDate: 1730000000000,
      });

      await expect(
        createGmailDraftForRun({
          runId: workflow.runId,
          recipientEmail: "manager@brightsmile.example.com",
          database,
          gmailClient: {
            createDraft: async () => {
              throw new Error("Gmail draft failed");
            },
          },
        }),
      ).rejects.toThrow("Gmail draft failed");

      const detail = database.getRunDetail(workflow.runId);
      expect(detail?.stageResults.length).toBeGreaterThan(0);
      expect(detail?.run.gmailDraftStatus).toBe("failed");
    } finally {
      database.close();
    }
  });
});
