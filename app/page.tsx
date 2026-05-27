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
            <p className="eyebrow">Lean Marketing</p>
            <h1>Outreach Agent</h1>
          </div>
          <div className="statusRow">
            <StatusPill
              label={readiness.workflowReady ? "System Ready" : "System Blocked"}
              tone={readiness.workflowReady ? "good" : "warn"}
            />
          </div>
        </div>
        <p className="muted">
          Enter a target company and decision maker, run the multi-step research, scoring, and drafting workflow, and copy the final approved email draft.
        </p>
        {error ? <p className="banner banner--error">{error}</p> : null}
        {message ? <p className="banner banner--info">{message}</p> : null}
        <form action={submitProspectAction} className="gridForm">
          <label>
            Company name
            <input name="companyName" placeholder="Agzaga" required type="text" />
          </label>
          <label>
            Website URL
            <input
              name="websiteUrl"
              placeholder="https://agzaga.com"
              required
              type="text"
            />
          </label>
          <label>
            Contact name
            <input name="contactName" placeholder="John Doe" required type="text" />
          </label>
          <label>
            Contact role
            <input name="contactRole" placeholder="Founder & CEO" required type="text" />
          </label>
          <label className="fullWidth">
            Estimated annual revenue (USD)
            <input
              name="estimatedRevenue"
              placeholder="360000"
              required
              type="number"
              min="0"
            />
          </label>
          <label className="fullWidth">
            Sales notes
            <textarea
              name="salesNotes"
              placeholder="Optional discovery notes or known marketing challenges."
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
                  <strong>{run.normalizedInput.companyName}</strong>
                  <span>{run.normalizedInput.contactRole} ({run.normalizedInput.contactName})</span>
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
