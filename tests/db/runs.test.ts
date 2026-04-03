import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import {
  createAppDatabase,
  type AppDatabase,
} from "@/src/db/client";
import { createEmptyRunRecord } from "@/src/schemas/prospect";

const tempDirs: string[] = [];

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), "sales-agent-db-"));
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

describe("app database", () => {
  test("persists runs, stage results, gmail account tokens, and run events", () => {
    const database: AppDatabase = createAppDatabase({
      filename: createTempDbPath(),
      appSecret: "test-secret",
    });
    try {
      const run = createEmptyRunRecord("run_123", {
        clinicName: "Bright Smile Dental",
        websiteUrl: "https://brightsmile.example.com",
        specialty: "dentistry",
        location: "Austin, TX",
        salesNotes: "Interested in fewer no-shows.",
        warnings: [],
      });

      database.createRun(run);
      database.insertStageResult({
        runId: "run_123",
        stageName: "research",
        attemptNumber: 1,
        status: "completed",
        payload: { groundedFacts: ["Online booking is available."] },
        errorMessage: null,
        durationMs: 1200,
      });
      database.insertRunEvent({
        runId: "run_123",
        level: "info",
        message: "Research stage completed.",
        metadata: { stageName: "research" },
      });
      database.saveGmailAccount({
        email: "rep@example.com",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiryDate: 1730000000000,
      });

      const detail = database.getRunDetail("run_123");
      const gmailAccount = database.getGmailAccount();

      expect(detail?.run.id).toBe("run_123");
      expect(detail?.stageResults).toHaveLength(1);
      expect(detail?.runEvents).toHaveLength(1);
      expect(detail?.stageResults[0]).toMatchObject({
        stageName: "research",
        status: "completed",
        payload: { groundedFacts: ["Online booking is available."] },
      });
      expect(gmailAccount).toMatchObject({
        email: "rep@example.com",
        refreshToken: "refresh-token",
      });
    } finally {
      database.close();
    }
  });
});
