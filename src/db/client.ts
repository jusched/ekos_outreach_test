import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { decryptSecret, encryptSecret } from "@/src/lib/crypto";
import { runRecordSchema, type RunRecord } from "@/src/schemas/prospect";
import {
  gmailAccountsTable,
  runEventsTable,
  runsTable,
  stageResultsTable,
} from "@/src/db/schema";

type StageStatus = "pending" | "completed" | "failed" | "blocked";

type StageResultInput = {
  runId: string;
  stageName: string;
  attemptNumber: number;
  status: StageStatus;
  payload: unknown;
  errorMessage: string | null;
  durationMs: number;
};

type RunEventInput = {
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata: Record<string, unknown>;
};

type GmailAccountInput = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
};

type RunDetail = {
  run: RunRecord;
  stageResults: Array<{
    id: number;
    stageName: string;
    attemptNumber: number;
    status: StageStatus;
    payload: unknown;
    errorMessage: string | null;
    durationMs: number;
    createdAt: number;
  }>;
  runEvents: Array<{
    id: number;
    level: "info" | "warn" | "error";
    message: string;
    metadata: Record<string, unknown>;
    createdAt: number;
  }>;
};

export type AppDatabase = ReturnType<typeof createAppDatabase>;

type CreateAppDatabaseOptions = {
  filename: string;
  appSecret: string;
};

function now() {
  return Date.now();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function createAppDatabase({
  filename,
  appSecret,
}: CreateAppDatabaseOptions) {
  const sqlite = new Database(filename);
  const db = drizzle(sqlite);

  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      human_review_status TEXT NOT NULL,
      gmail_draft_status TEXT NOT NULL,
      normalized_input_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stage_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      error_message TEXT,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT NOT NULL,
      expiry_date INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  return {
    close() {
      sqlite.close();
    },

    createRun(run: RunRecord) {
      const timestamp = now();
      db.insert(runsTable)
        .values({
          id: run.id,
          status: run.status,
          humanReviewStatus: run.humanReviewStatus,
          gmailDraftStatus: run.gmailDraftStatus,
          normalizedInputJson: JSON.stringify(run.normalizedInput),
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    },

    listRuns() {
      return db
        .select()
        .from(runsTable)
        .orderBy(desc(runsTable.updatedAt))
        .all()
        .map((row) =>
          runRecordSchema.parse({
            id: row.id,
            status: row.status,
            humanReviewStatus: row.humanReviewStatus,
            gmailDraftStatus: row.gmailDraftStatus,
            normalizedInput: parseJson(row.normalizedInputJson),
          }),
        );
    },

    updateRun(
      runId: string,
      patch: Partial<
        Pick<
          RunRecord,
          "status" | "humanReviewStatus" | "gmailDraftStatus" | "normalizedInput"
        >
      >,
    ) {
      const current = db
        .select()
        .from(runsTable)
        .where(eq(runsTable.id, runId))
        .get();

      if (!current) {
        throw new Error(`Run ${runId} not found.`);
      }

      db.update(runsTable)
        .set({
          status: patch.status ?? current.status,
          humanReviewStatus: patch.humanReviewStatus ?? current.humanReviewStatus,
          gmailDraftStatus: patch.gmailDraftStatus ?? current.gmailDraftStatus,
          normalizedInputJson: patch.normalizedInput
            ? JSON.stringify(patch.normalizedInput)
            : current.normalizedInputJson,
          updatedAt: now(),
        })
        .where(eq(runsTable.id, runId))
        .run();
    },

    insertStageResult(input: StageResultInput) {
      db.insert(stageResultsTable)
        .values({
          runId: input.runId,
          stageName: input.stageName,
          attemptNumber: input.attemptNumber,
          status: input.status,
          payloadJson: JSON.stringify(input.payload),
          errorMessage: input.errorMessage,
          durationMs: input.durationMs,
          createdAt: now(),
        })
        .run();

      this.updateRun(input.runId, {});
    },

    insertRunEvent(input: RunEventInput) {
      db.insert(runEventsTable)
        .values({
          runId: input.runId,
          level: input.level,
          message: input.message,
          metadataJson: JSON.stringify(input.metadata),
          createdAt: now(),
        })
        .run();
    },

    getRunDetail(runId: string): RunDetail | null {
      const runRow = db
        .select()
        .from(runsTable)
        .where(eq(runsTable.id, runId))
        .get();

      if (!runRow) {
        return null;
      }

      const stageRows = db
        .select()
        .from(stageResultsTable)
        .where(eq(stageResultsTable.runId, runId))
        .orderBy(stageResultsTable.id)
        .all();

      const eventRows = db
        .select()
        .from(runEventsTable)
        .where(eq(runEventsTable.runId, runId))
        .orderBy(runEventsTable.id)
        .all();

      return {
        run: runRecordSchema.parse({
          id: runRow.id,
          status: runRow.status,
          humanReviewStatus: runRow.humanReviewStatus,
          gmailDraftStatus: runRow.gmailDraftStatus,
          normalizedInput: parseJson(runRow.normalizedInputJson),
        }),
        stageResults: stageRows.map((row) => ({
          id: row.id,
          stageName: row.stageName,
          attemptNumber: row.attemptNumber,
          status: row.status as StageStatus,
          payload: parseJson(row.payloadJson),
          errorMessage: row.errorMessage,
          durationMs: row.durationMs,
          createdAt: row.createdAt,
        })),
        runEvents: eventRows.map((row) => ({
          id: row.id,
          level: row.level as "info" | "warn" | "error",
          message: row.message,
          metadata: parseJson(row.metadataJson),
          createdAt: row.createdAt,
        })),
      };
    },

    saveGmailAccount(account: GmailAccountInput) {
      db.insert(gmailAccountsTable)
        .values({
          id: 1,
          email: account.email,
          accessTokenEncrypted: encryptSecret(account.accessToken, appSecret),
          refreshTokenEncrypted: encryptSecret(account.refreshToken, appSecret),
          expiryDate: account.expiryDate,
          updatedAt: now(),
        })
        .onConflictDoUpdate({
          target: gmailAccountsTable.id,
          set: {
            email: account.email,
            accessTokenEncrypted: encryptSecret(account.accessToken, appSecret),
            refreshTokenEncrypted: encryptSecret(account.refreshToken, appSecret),
            expiryDate: account.expiryDate,
            updatedAt: now(),
          },
        })
        .run();
    },

    getGmailAccount() {
      const row = db.select().from(gmailAccountsTable).where(eq(gmailAccountsTable.id, 1)).get();

      if (!row) {
        return null;
      }

      return {
        email: row.email,
        accessToken: decryptSecret(row.accessTokenEncrypted, appSecret),
        refreshToken: decryptSecret(row.refreshTokenEncrypted, appSecret),
        expiryDate: row.expiryDate,
      };
    },

    clearRunData(runId: string) {
      db.delete(stageResultsTable)
        .where(eq(stageResultsTable.runId, runId))
        .run();
      db.delete(runEventsTable).where(eq(runEventsTable.runId, runId)).run();
      db.update(runsTable)
        .set({
          status: "pending",
          humanReviewStatus: "pending",
          gmailDraftStatus: "not_started",
          updatedAt: now(),
        })
        .where(eq(runsTable.id, runId))
        .run();
    },
  };
}
