import Link from "next/link";

import { submitProspectAction } from "@/app/actions";
import { StatusPill } from "@/src/components/status-pill";
import { SubmitButton } from "@/src/components/submit-button";
import { getAppDatabase } from "@/src/lib/app-database";
import { getEnvironmentReadiness } from "@/src/lib/config";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const database = getAppDatabase();
  const runs = database.listRuns();
  const readiness = getEnvironmentReadiness();
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <main className="pageGrid">
      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Track B</p>
            <h1>Clinic Sales & Outreach Agent</h1>
          </div>
          <div className="statusRow">
            <StatusPill
              label={readiness.workflowReady ? "Workflow Ready" : "Workflow Blocked"}
              tone={readiness.workflowReady ? "good" : "warn"}
            />
            <StatusPill
              label={readiness.gmailReady ? "Gmail OAuth Ready" : "Gmail OAuth Missing"}
              tone={readiness.gmailReady ? "good" : "warn"}
            />
          </div>
        </div>
        <p className="muted">
          Enter a clinic, run the multi-step workflow, review the evidence and draft, then
          create a Gmail draft only after evaluator and human approval.
        </p>
        {error ? <p className="banner banner--error">{error}</p> : null}
        {message ? <p className="banner banner--info">{message}</p> : null}
        <form action={submitProspectAction} className="gridForm">
          <label>
            Clinic name
            <input name="clinicName" placeholder="Bright Smile Dental" required type="text" />
          </label>
          <label>
            Website URL
            <input
              name="websiteUrl"
              placeholder="https://brightsmile.example.com"
              required
              type="text"
            />
          </label>
          <label>
            Specialty / practice type
            <input name="specialty" placeholder="Dentistry" required type="text" />
          </label>
          <label>
            Location
            <input name="location" placeholder="Austin, TX" required type="text" />
          </label>
          <label className="fullWidth">
            Sales notes
            <textarea
              name="salesNotes"
              placeholder="Optional operator context or discovery notes."
              rows={5}
            />
          </label>
          <div className="fullWidth">
            <SubmitButton idleLabel="Run Workflow" pendingLabel="Running Workflow..." />
          </div>
        </form>
      </section>

      <section className="card stack">
        <div className="sectionHeader">
          <h2>Recent Runs</h2>
          <span className="muted">{runs.length} stored locally</span>
        </div>
        {runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <ul className="runList">
            {runs.map((run) => (
              <li key={run.id}>
                <Link href={`/runs/${run.id}`}>
                  <strong>{run.normalizedInput.clinicName}</strong>
                  <span>{run.normalizedInput.specialty}</span>
                  <StatusPill
                    label={run.status}
                    tone={
                      run.status === "completed"
                        ? "good"
                        : run.status === "failed"
                          ? "bad"
                          : "neutral"
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
