import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runsTable = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  humanReviewStatus: text("human_review_status").notNull(),
  gmailDraftStatus: text("gmail_draft_status").notNull(),
  normalizedInputJson: text("normalized_input_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const stageResultsTable = sqliteTable("stage_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  stageName: text("stage_name").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const gmailAccountsTable = sqliteTable("gmail_accounts", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  expiryDate: integer("expiry_date", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const runEventsTable = sqliteTable("run_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  metadataJson: text("metadata_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
