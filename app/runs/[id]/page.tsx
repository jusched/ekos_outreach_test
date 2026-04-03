import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createGmailDraftAction,
  rerunWorkflowAction,
  reviewRunAction,
} from "@/app/actions";
import { ReviewControls } from "@/src/components/review-controls";
import { StatusPill } from "@/src/components/status-pill";
import { SubmitButton } from "@/src/components/submit-button";
import { getAppDatabase } from "@/src/lib/app-database";

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
  const gmailAccount = database.getGmailAccount();

  if (!detail) {
    notFound();
  }

  const evaluatorResults = detail.stageResults.filter((stage) => stage.stageName === "evaluation");
  const outreachDrafts = detail.stageResults.filter(
    (stage) => stage.stageName === "outreach_writer",
  );
  const evaluatorApproved =
    Boolean(evaluatorResults.at(-1)?.payload) &&
    Boolean((evaluatorResults.at(-1)?.payload as { approved?: boolean }).approved);
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
            <h1>{detail.run.normalizedInput.clinicName}</h1>
            <p className="muted">Run ID: {detail.run.id}</p>
          </div>
          <div className="statusRow">
            <StatusPill label={detail.run.status} tone={toneForStatus(detail.run.status)} />
            <StatusPill
              label={`Human: ${detail.run.humanReviewStatus}`}
              tone={toneForStatus(detail.run.humanReviewStatus)}
            />
            <StatusPill
              label={`Gmail: ${detail.run.gmailDraftStatus}`}
              tone={toneForStatus(detail.run.gmailDraftStatus)}
            />
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
              <div className="buttonRow">
                <form action={reviewRunAction.bind(null, detail.run.id, true)}>
                  <button type="submit">Approve Draft</button>
                </form>
                <form action={reviewRunAction.bind(null, detail.run.id, false)}>
                  <button className="secondaryButton" type="submit">
                    Reject Draft
                  </button>
                </form>
              </div>
              <div className="oauthBox">
                <p className="muted">
                  Gmail connection: {gmailAccount ? gmailAccount.email : "not connected"}
                </p>
                <Link
                  className="buttonLink"
                  href={`/api/google/connect?next=${encodeURIComponent(`/runs/${detail.run.id}`)}`}
                >
                  {gmailAccount ? "Reconnect Gmail" : "Connect Gmail"}
                </Link>
              </div>
              <form action={createGmailDraftAction.bind(null, detail.run.id)} className="stack">
                <label>
                  Recipient email
                  <input
                    name="recipientEmail"
                    placeholder="manager@clinic.example.com"
                    required
                    type="email"
                  />
                </label>
                <ReviewControls
                  evaluatorApproved={evaluatorApproved}
                  gmailConnected={Boolean(gmailAccount)}
                  gmailDraftStatus={detail.run.gmailDraftStatus}
                  humanReviewStatus={detail.run.humanReviewStatus}
                />
              </form>
            </div>
          </div>
        </div>
      </section>

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
