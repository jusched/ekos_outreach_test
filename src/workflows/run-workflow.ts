import { randomUUID } from "node:crypto";

import type { AppDatabase } from "@/src/db/client";
import { scoreProspectFit } from "@/src/agents/fit";
import { validateDraftHardRules } from "@/src/agents/evaluator-rules";
import { gmailDraftResultSchema } from "@/src/schemas/gmail";
import {
  evaluationResultSchema,
  type EvaluationResult,
} from "@/src/schemas/evaluation";
import {
  outreachDraftSchema,
  type OutreachDraft,
} from "@/src/schemas/outreach";
import {
  normalizeProspectInput,
  prospectFormSchema,
  type ProspectFormInput,
} from "@/src/schemas/prospect";
import {
  pageEvidenceSchema,
  researchReportSchema,
  type PageEvidence,
  type ResearchReport,
} from "@/src/schemas/research";
import { extractWebsiteEvidence, selectHighSignalLinks } from "@/src/lib/html";

const MAX_EVALUATION_ATTEMPTS = 3;

type ResearchAgentInput = {
  prospect: ReturnType<typeof normalizeProspectInput>;
  websiteEvidence: PageEvidence[];
};

type WriterAgentInput = {
  prospect: ReturnType<typeof normalizeProspectInput>;
  research: ResearchReport;
  fitAssessment: ReturnType<typeof scoreProspectFit>;
  requiredFixes: string[];
};

type EvaluatorAgentInput = {
  prospect: ReturnType<typeof normalizeProspectInput>;
  research: ResearchReport;
  fitAssessment: ReturnType<typeof scoreProspectFit>;
  draft: OutreachDraft;
  deterministicIssues: string[];
};

type GmailClient = {
  createDraft(input: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ id: string; messageId?: string }>;
};

type WorkflowDependencies = {
  input: ProspectFormInput;
  database: AppDatabase;
  fetchWebsite(url: string): Promise<string>;
  researchAgent(input: ResearchAgentInput): Promise<unknown>;
  writerAgent(input: WriterAgentInput): Promise<unknown>;
  evaluatorAgent(input: EvaluatorAgentInput): Promise<unknown>;
};

function coerceEvaluation(
  evaluation: EvaluationResult,
  deterministicIssues: string[],
  deterministicFixes: string[],
): EvaluationResult {
  const mergedIssues = [...new Set([...evaluation.issues, ...deterministicIssues])];
  const mergedFixes = [...new Set([...evaluation.requiredFixes, ...deterministicFixes])];

  return evaluationResultSchema.parse({
    ...evaluation,
    approved: evaluation.approved && deterministicIssues.length === 0,
    issues: mergedIssues,
    requiredFixes: mergedFixes,
  });
}

async function collectWebsiteEvidence(
  websiteUrl: string,
  fetchWebsite: WorkflowDependencies["fetchWebsite"],
): Promise<PageEvidence[]> {
  const homepageHtml = await fetchWebsite(websiteUrl);
  const evidence = [extractWebsiteEvidence(websiteUrl, homepageHtml)];
  const links = selectHighSignalLinks(websiteUrl, homepageHtml, 2);

  for (const link of links) {
    try {
      const linkedHtml = await fetchWebsite(link);
      evidence.push(extractWebsiteEvidence(link, linkedHtml));
    } catch {
      continue;
    }
  }

  return evidence.map((page) => pageEvidenceSchema.parse(page));
}

export async function executeProspectWorkflow({
  input,
  database,
  fetchWebsite,
  researchAgent,
  writerAgent,
  evaluatorAgent,
}: WorkflowDependencies) {
  const normalized = normalizeProspectInput(prospectFormSchema.parse(input));
  const runId = randomUUID();
  database.createRun(createRunRecord(runId, normalized));
  database.updateRun(runId, { status: "running" });
  database.insertRunEvent({
    runId,
    level: "info",
    message: "Workflow started.",
    metadata: {},
  });

  let websiteEvidence: PageEvidence[] = [];

  try {
    websiteEvidence = await collectWebsiteEvidence(normalized.websiteUrl, fetchWebsite);
  } catch (error) {
    database.insertRunEvent({
      runId,
      level: "warn",
      message: "Website fetch failed; falling back to notes-only research.",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown website fetch error.",
      },
    });
  }

  try {
    const research = researchReportSchema.parse(
      await researchAgent({ prospect: normalized, websiteEvidence }),
    );
    database.insertStageResult({
      runId,
      stageName: "research",
      attemptNumber: 1,
      status: "completed",
      payload: research,
      errorMessage: null,
      durationMs: 0,
    });

    const fitAssessment = scoreProspectFit(normalized, research);
    database.insertStageResult({
      runId,
      stageName: "fit_assessment",
      attemptNumber: 1,
      status: "completed",
      payload: fitAssessment,
      errorMessage: null,
      durationMs: 0,
    });

    let latestDraft: OutreachDraft | null = null;
    let latestEvaluation: EvaluationResult | null = null;
    let requiredFixes: string[] = [];

    for (let attempt = 1; attempt <= MAX_EVALUATION_ATTEMPTS; attempt += 1) {
      const rawDraft = await writerAgent({
        prospect: normalized,
        research,
        fitAssessment,
        requiredFixes,
      });
      latestDraft = outreachDraftSchema.parse(rawDraft);
      database.insertStageResult({
        runId,
        stageName: "outreach_writer",
        attemptNumber: attempt,
        status: "completed",
        payload: latestDraft,
        errorMessage: null,
        durationMs: 0,
      });

      const deterministic = validateDraftHardRules({
        prospect: normalized,
        research,
        draft: latestDraft,
      });
      latestEvaluation = coerceEvaluation(
        evaluationResultSchema.parse(
          await evaluatorAgent({
            prospect: normalized,
            research,
            fitAssessment,
            draft: latestDraft,
            deterministicIssues: deterministic.issues,
          }),
        ),
        deterministic.issues,
        deterministic.requiredFixes,
      );
      database.insertStageResult({
        runId,
        stageName: "evaluation",
        attemptNumber: attempt,
        status: latestEvaluation.approved ? "completed" : "blocked",
        payload: latestEvaluation,
        errorMessage: null,
        durationMs: 0,
      });

      if (latestEvaluation.approved) {
        database.updateRun(runId, {
          status: "completed",
          gmailDraftStatus: "not_started",
        });
        database.insertRunEvent({
          runId,
          level: "info",
          message: "Workflow completed successfully. Outbound email is ready.",
          metadata: {},
        });
        return {
          runId,
          status: "completed" as const,
        };
      }

      requiredFixes = latestEvaluation.requiredFixes;
    }

    database.updateRun(runId, {
      status: "failed",
      gmailDraftStatus: "blocked",
    });
    database.insertRunEvent({
      runId,
      level: "error",
      message: "Workflow exhausted evaluator retries.",
      metadata: {
        finalIssues: latestEvaluation?.issues ?? [],
      },
    });

    return {
      runId,
      status: "failed" as const,
    };
  } catch (error) {
    database.updateRun(runId, {
      status: "failed",
      gmailDraftStatus: "blocked",
    });
    database.insertRunEvent({
      runId,
      level: "error",
      message: error instanceof Error ? error.message : "Workflow execution failed.",
      metadata: {},
    });

    return {
      runId,
      status: "failed" as const,
    };
  }
}

function createRunRecord(
  runId: string,
  normalized: ReturnType<typeof normalizeProspectInput>,
) {
  return {
    id: runId,
    status: "pending" as const,
    humanReviewStatus: "approved" as const,
    gmailDraftStatus: "not_started" as const,
    normalizedInput: normalized,
  };
}

function getLatestStagePayload<T>(
  detail: NonNullable<ReturnType<AppDatabase["getRunDetail"]>>,
  stageName: string,
): T | null {
  const matching = detail.stageResults.filter((stage) => stage.stageName === stageName);
  if (matching.length === 0) {
    return null;
  }

  return matching.at(-1)?.payload as T;
}

export async function applyHumanReviewDecision({
  runId,
  approved,
  database,
}: {
  runId: string;
  approved: boolean;
  database: AppDatabase;
}) {
  database.updateRun(runId, {
    humanReviewStatus: approved ? "approved" : "rejected",
    status: approved ? "needs_review" : "failed",
    gmailDraftStatus: approved ? "not_started" : "blocked",
  });
  database.insertRunEvent({
    runId,
    level: "info",
    message: approved ? "Human review approved the draft." : "Human review rejected the draft.",
    metadata: {},
  });
}

export async function createGmailDraftForRun({
  runId,
  recipientEmail,
  database,
  gmailClient,
}: {
  runId: string;
  recipientEmail: string;
  database: AppDatabase;
  gmailClient?: GmailClient;
}) {
  const detail = database.getRunDetail(runId);

  if (!detail) {
    throw new Error(`Run ${runId} not found.`);
  }

  if (detail.run.humanReviewStatus !== "approved") {
    throw new Error("Human review must approve the draft before Gmail draft creation.");
  }

  const latestEvaluation = getLatestStagePayload<EvaluationResult>(detail, "evaluation");
  if (!latestEvaluation?.approved) {
    throw new Error("Evaluator approval is required before Gmail draft creation.");
  }

  const gmailAccount = database.getGmailAccount();
  if (!gmailAccount) {
    database.updateRun(runId, { gmailDraftStatus: "blocked" });
    throw new Error("No Gmail account connected.");
  }

  if (!gmailClient) {
    throw new Error("No Gmail draft client configured.");
  }

  const latestDraft = getLatestStagePayload<OutreachDraft>(detail, "outreach_writer");
  if (!latestDraft) {
    throw new Error("No approved outreach draft found.");
  }

  try {
    const result = gmailDraftResultSchema.parse(
      await gmailClient.createDraft({
        to: recipientEmail,
        subject: latestDraft.subject,
        body: latestDraft.body,
      }),
    );

    database.insertStageResult({
      runId,
      stageName: "gmail_draft",
      attemptNumber: 1,
      status: "completed",
      payload: result,
      errorMessage: null,
      durationMs: 0,
    });
    database.updateRun(runId, {
      gmailDraftStatus: "created",
      status: "completed",
    });

    return result;
  } catch (error) {
    database.insertStageResult({
      runId,
      stageName: "gmail_draft",
      attemptNumber: 1,
      status: "failed",
      payload: {},
      errorMessage: error instanceof Error ? error.message : "Gmail draft creation failed.",
      durationMs: 0,
    });
    database.updateRun(runId, {
      gmailDraftStatus: "failed",
      status: "failed",
    });
    throw error;
  }
}
