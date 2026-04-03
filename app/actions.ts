"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createGmailDraftForRun,
  executeProspectWorkflow,
  applyHumanReviewDecision,
} from "@/src/workflows/run-workflow";
import { runEvaluatorAgent } from "@/src/agents/evaluator";
import { runResearchAgent } from "@/src/agents/research";
import { runOutreachWriterAgent } from "@/src/agents/writer";
import { getAppDatabase } from "@/src/lib/app-database";
import { rethrowIfRedirectError } from "@/src/lib/action-errors";
import { assertGoogleConfig, assertWorkflowConfig } from "@/src/lib/config";
import { createPersistedGmailDraftClient } from "@/src/lib/google";
import { fetchWebsiteHtml } from "@/src/lib/web-fetch";

function withMessage(path: string, key: "error" | "message", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export async function submitProspectAction(formData: FormData) {
  try {
    assertWorkflowConfig();
    const database = getAppDatabase();
    const result = await executeProspectWorkflow({
      input: {
        clinicName: String(formData.get("clinicName") ?? ""),
        websiteUrl: String(formData.get("websiteUrl") ?? ""),
        specialty: String(formData.get("specialty") ?? ""),
        location: String(formData.get("location") ?? ""),
        salesNotes: String(formData.get("salesNotes") ?? ""),
      },
      database,
      fetchWebsite: fetchWebsiteHtml,
      researchAgent: runResearchAgent,
      writerAgent: runOutreachWriterAgent,
      evaluatorAgent: runEvaluatorAgent,
    });

    redirect(`/runs/${result.runId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      withMessage(
        "/",
        "error",
        error instanceof Error ? error.message : "Workflow execution failed.",
      ),
    );
  }
}

export async function rerunWorkflowAction(runId: string) {
  const database = getAppDatabase();
  const detail = database.getRunDetail(runId);

  if (!detail) {
    redirect(withMessage("/", "error", `Run ${runId} not found.`));
  }

  try {
    assertWorkflowConfig();
    const rerun = await executeProspectWorkflow({
      input: detail.run.normalizedInput,
      database,
      fetchWebsite: fetchWebsiteHtml,
      researchAgent: runResearchAgent,
      writerAgent: runOutreachWriterAgent,
      evaluatorAgent: runEvaluatorAgent,
    });

    redirect(`/runs/${rerun.runId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      withMessage(
        `/runs/${runId}`,
        "error",
        error instanceof Error ? error.message : "Rerun failed.",
      ),
    );
  }
}

export async function reviewRunAction(runId: string, approved: boolean) {
  const database = getAppDatabase();

  await applyHumanReviewDecision({
    runId,
    approved,
    database,
  });

  revalidatePath(`/runs/${runId}`);
  redirect(
    withMessage(
      `/runs/${runId}`,
      "message",
      approved ? "Draft approved for Gmail draft creation." : "Draft rejected by human review.",
    ),
  );
}

export async function createGmailDraftAction(runId: string, formData: FormData) {
  const recipientEmail = String(formData.get("recipientEmail") ?? "");

  try {
    assertGoogleConfig();
    const database = getAppDatabase();
    const gmailClient = createPersistedGmailDraftClient();

    if (!gmailClient) {
      throw new Error("No Gmail account connected.");
    }

    await createGmailDraftForRun({
      runId,
      recipientEmail,
      database,
      gmailClient,
    });

    revalidatePath(`/runs/${runId}`);
    redirect(withMessage(`/runs/${runId}`, "message", "Gmail draft created."));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      withMessage(
        `/runs/${runId}`,
        "error",
        error instanceof Error ? error.message : "Gmail draft creation failed.",
      ),
    );
  }
}
