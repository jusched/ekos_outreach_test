# Clinic Sales & Outreach Agent

Local standalone app for Track B of the assignment: a sales rep can enter a clinic prospect, run a multi-step research/scoring/outreach workflow, review the result, and create a Gmail draft only after evaluator approval and explicit human approval.

## What Was Built

- A local `Next.js + TypeScript` app with:
  - prospect intake form
  - persisted workflow runs in local SQLite
  - explicit multi-step pipeline with structured outputs
  - evaluator gate before any Gmail action
  - human approval gate before Gmail draft creation
  - Gmail OAuth + `drafts.create` integration only
- A tested core workflow:
  - intake normalization
  - website evidence extraction
  - deterministic fit scoring
  - outreach drafting
  - evaluator review with up to 2 auto-revision retries
  - human approve/reject
  - Gmail draft creation

## Why This Workflow

The assignment asked for something real, multi-step, and useful to an actual sales rep. The highest-value narrow path was:

1. Normalize the prospect input.
2. Pull grounded evidence from the clinic website.
3. Score fit against a simple rubric.
4. Draft a personalized email from that evidence.
5. Run an evaluator pass that can block or force revision.
6. Require human approval.
7. Create a Gmail draft, never send.

That produces a useful operator workflow without hiding decisions inside one prompt.

## Key Design Decisions

- Multiple agents/modules with explicit contracts:
  - research
  - fit scoring
  - outreach writer
  - evaluator
- Structured outputs with `zod` at every stage boundary.
- Local SQLite persistence with stage-by-stage artifacts and run events.
- Deterministic logic where it matters:
  - input normalization
  - website extraction
  - fit rubric scoring
  - hard evaluator rules
  - Gmail MIME payload building
- Gmail draft only. No send path exists in the code.
- Minimal orchestration inside the app. No heavy workflow framework.

## Stack

- Next.js 16 App Router
- TypeScript
- `drizzle-orm` + `better-sqlite3`
- OpenAI SDK for structured agent outputs
- Google Gmail API for OAuth + draft creation
- Vitest + Testing Library

## Assumptions

- V1 supports both dental and medical clinics with a shared rubric.
- Single local operator only.
- Recipient email is entered by the human reviewer at draft-creation time.
  - Reason: the assignment did not provide a reliable contact-email source, and inventing or scraping contact emails would require additional integrations or less-grounded behavior.
- No deployment, CRM sync, search API, or paid scraping service.

## Setup

### 1. Install dependencies

PowerShell on this machine blocks `npm.ps1`, so use:

```powershell
cmd /c npm install
```

### 2. Create environment file

```powershell
Copy-Item .env.example .env
```

Fill in the values in `.env`.

### 3. Run the app

```powershell
cmd /c npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.example`.

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DATABASE_FILE`
- `APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

## Gmail OAuth Setup

This app uses Gmail draft creation only and needs the Gmail compose scope.

1. Create a Google Cloud project.
2. Enable the Gmail API.
3. Create an OAuth client for a desktop/local web flow.
4. Add a redirect URI matching `GOOGLE_OAUTH_REDIRECT_URI`.
   - Example: `http://localhost:3000/api/google/callback`
5. Put the client ID, client secret, and redirect URI into `.env`.
6. Start the app and use the `Connect Gmail` button inside a run detail page.

## Run Commands

```powershell
cmd /c npm run dev
cmd /c npm run test
cmd /c npm run lint
cmd /c npm run typecheck
cmd /c npm run build
```

## Workflow Behavior

- Intake validates and normalizes the prospect.
- Research fetches the homepage and up to two same-domain high-signal pages.
- Research output is grounded and structured.
- Fit scoring is deterministic and evidence-backed.
- Writer drafts an email from normalized input, research, and fit.
- Evaluator checks relevance, grounding, personalization, and tone.
- If evaluator rejects, the writer gets up to 2 automatic revision attempts.
- Human approval is required after the evaluator.
- Gmail draft creation only proceeds when:
  - evaluator approved
  - human approved
  - Gmail is connected
  - recipient email is supplied

## Validation And Error Handling

- `zod` validation at every agent boundary.
- Website fetch failure falls back to notes-only research instead of inventing evidence.
- Malformed agent output fails the run instead of silently continuing.
- Gmail failures preserve the run and stage artifacts.
- Run events are stored locally for inspection.

## Test Coverage

Automated coverage includes:

- schema normalization
- HTML extraction
- fit scoring
- token encryption
- Gmail MIME payload creation
- local DB persistence
- workflow happy path
- notes-only fallback
- malformed model output failure
- evaluator revision loop
- max retry exhaustion
- human rejection gate
- Gmail blocked/failed paths
- UI gate state for Gmail draft creation

## Manual Verification Checklist

1. Start the app with valid OpenAI env vars.
2. Create a prospect run from the home page.
3. Confirm the run detail page shows:
   - normalized input
   - research result
   - fit score
   - outreach draft history
   - evaluator output
   - run events
4. Approve the draft manually.
5. Connect Gmail.
6. Enter a recipient email.
7. Create a Gmail draft and confirm it appears in Gmail drafts.

## Known Tradeoffs

- No background job queue; workflow execution happens inline from the server action.
- Website research is intentionally narrow and grounded to the provided domain only.
- Shared rubric across dental and medical reduces specialization depth.
- Recipient email entry is manual by design.
- No CRM writeback or contact discovery.

## What I Would Improve Next

- Add specialty-aware scoring and prompt variants for dental vs. medical clinics.
- Add resumable stage-level retries from the UI instead of rerunning the full workflow.
- Add richer evidence extraction from common clinic subpages such as services, insurance, and providers.
- Add authentication and multi-user separation.
- Add evaluation telemetry over time so draft quality can be measured across runs.
