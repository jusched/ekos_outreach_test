"use server";

import { redirect } from "next/navigation";

import { executeProspectWorkflow } from "@/src/workflows/run-workflow";
import { runEvaluatorAgent } from "@/src/agents/evaluator";
import { runResearchAgent } from "@/src/agents/research";
import { runOutreachWriterAgent } from "@/src/agents/writer";
import { getAppDatabase } from "@/src/lib/app-database";
import { rethrowIfRedirectError } from "@/src/lib/action-errors";
import { assertWorkflowConfig } from "@/src/lib/config";
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
        companyName: String(formData.get("companyName") ?? ""),
        websiteUrl: String(formData.get("websiteUrl") ?? ""),
        contactName: String(formData.get("contactName") ?? ""),
        contactRole: String(formData.get("contactRole") ?? ""),
        estimatedRevenue: Number(formData.get("estimatedRevenue") ?? 0),
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
