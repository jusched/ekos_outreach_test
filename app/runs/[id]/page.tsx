import Link from "next/link";
import { notFound } from "next/navigation";

import { rerunWorkflowAction } from "@/app/actions";
import { CopyButton } from "@/src/components/copy-button";
import { StatusPill } from "@/src/components/status-pill";
import { SubmitButton } from "@/src/components/submit-button";
import { getAppDatabase } from "@/src/lib/app-database";
import type { OutreachDraft } from "@/src/schemas/outreach";

function toneForStatus(status: string) {
  if (status === "completed" || status === "created" || status === "approved") {
    return "good" as const;
  }

  if (status === "failed" || status === "rejected" || status === "blocked") {
    return "bad" as const;
  }

  return "neutral" as const;
}

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const database = getAppDatabase();
  const detail = database.getRunDetail(id);

  if (!detail) {
    notFound();
  }

  const outreachDrafts = detail.stageResults.filter(
    (stage) => stage.stageName === "outreach_writer",
  );

  const latestApprovedDraft = detail.run.status === "completed" && outreachDrafts.length > 0
    ? (outreachDrafts.at(-1)?.payload as OutreachDraft)
    : null;

  const error = typeof query.error === "string" ? query.error : null;
  const message = typeof query.message === "string" ? query.message : null;

  return (
    <main className="pageGrid">
      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <Link className="textLink" href="/">
              ← Back to intake
            </Link>
            <h1>{detail.run.normalizedInput.companyName}</h1>
            <p className="muted">Run ID: {detail.run.id}</p>
          </div>
          <div className="statusRow">
            <StatusPill label={detail.run.status} tone={toneForStatus(detail.run.status)} />
          </div>
        </div>
        {error ? <p className="banner banner--error">{error}</p> : null}
        {message ? <p className="banner banner--info">{message}</p> : null}
        <div className="summaryGrid">
          <div>
            <h2>Normalized Input</h2>
            <pre>{JSON.stringify(detail.run.normalizedInput, null, 2)}</pre>
          </div>
          <div>
            <h2>Operator Actions</h2>
            <div className="stack">
              <form action={rerunWorkflowAction.bind(null, detail.run.id)}>
                <SubmitButton idleLabel="Rerun Full Workflow" pendingLabel="Rerunning..." />
              </form>
            </div>
          </div>
        </div>
      </section>

      {latestApprovedDraft ? (
        <section className="card stack" style={{ border: "2px solid var(--accent)" }}>
          <div className="sectionHeader">
            <h2>Generated Outreach Email Draft</h2>
            <span className="statusPill statusPill--good">Ready to copy</span>
          </div>
          
          <div className="stack" style={{ gap: "1.5rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>Subject Line</strong>
                <CopyButton text={latestApprovedDraft.subject} label="Subject" />
              </div>
              <input
                readOnly
                value={latestApprovedDraft.subject}
                style={{ background: "#faf7f2", margin: 0, fontWeight: "600" }}
              />
            </div>
            
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>Email Body</strong>
                <CopyButton text={latestApprovedDraft.body} label="Body" />
              </div>
              <textarea
                readOnly
                rows={12}
                value={latestApprovedDraft.body}
                style={{ background: "#faf7f2", margin: 0, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <h2>Stage Results</h2>
        {detail.stageResults.map((stage) => (
          <article className="stageCard" key={`${stage.stageName}-${stage.attemptNumber}-${stage.id}`}>
            <div className="sectionHeader">
              <div>
                <h3>
                  {stage.stageName} · attempt {stage.attemptNumber}
                </h3>
                <p className="muted">{new Date(stage.createdAt).toLocaleString()}</p>
              </div>
              <StatusPill label={stage.status} tone={toneForStatus(stage.status)} />
            </div>
            {stage.errorMessage ? (
              <p className="banner banner--error">{stage.errorMessage}</p>
            ) : null}
            <pre>{JSON.stringify(stage.payload, null, 2)}</pre>
          </article>
        ))}
      </section>

      <section className="card stack">
        <h2>Draft History</h2>
        {outreachDrafts.length === 0 ? (
          <p className="muted">No drafts generated.</p>
        ) : (
          outreachDrafts.map((stage) => (
            <article className="stageCard" key={`draft-${stage.id}`}>
              <h3>Writer attempt {stage.attemptNumber}</h3>
              <pre>{JSON.stringify(stage.payload, null, 2)}</pre>
            </article>
          ))
        )}
      </section>

      <section className="card stack">
        <h2>Run Events</h2>
        {detail.runEvents.length === 0 ? (
          <p className="muted">No run events recorded.</p>
        ) : (
          detail.runEvents.map((event) => (
            <article className="eventRow" key={event.id}>
              <StatusPill label={event.level} tone={toneForStatus(event.level)} />
              <div>
                <strong>{event.message}</strong>
                <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
