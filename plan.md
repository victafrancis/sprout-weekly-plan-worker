# Weekly Plan Lambda Specification

## Scope

- Runtime: TypeScript on AWS Lambda `nodejs22.x`
- Trigger in v1: manual trigger from Next.js API route
- Child scope in v1: single child from `CHILD_ID` environment variable
- Output in v1: markdown weekly plan artifact in S3
- Out of scope in v1: SES delivery and EventBridge schedule automation

## Goal

Build a background worker that assembles child profile context plus last 7 days of logs, calls OpenRouter with Gemini 3.1 Pro preview, and stores a markdown weekly plan under `plans/<childId>/`.

## Data Contracts

### DynamoDB Table

- Table: `Sprout_Data`

### Profile Item Shape

```ts
{
  PK: "USER#<childId>",
  SK: "PROFILE",
  birth_date: "YYYY-MM-DD",
  milestones: string[],
  schemas: string[],
  interests: string[]
}
```

### Daily Log Item Shape

```ts
{
  PK: "LOG#<childId>",
  SK: "DATE#YYYY-MM-DD",
  raw_text: string,
  key_takeaways: string[],
  sentiment: "positive" | "neutral" | "mixed" | "frustrated",
  plan_reference: {
    referenceContentMarkdown: string
  }
}
```

## Worker I O Contract

### Input Event v1

```ts
{
  requestSource: "manual",
  requestedAt?: string
}
```

### Output

```ts
{
  ok: boolean,
  childId: string,
  outputObjectKey?: string,
  model: string,
  logWindowDays: 7,
  logsCount: number,
  error?: string
}
```

## Prompt Strategy

### Decision

- Primary source: S3 object key `prompts/create-weekly-plan-prompt.md`
- Fallback source: repository file `create-weekly-plan-prompt.md`

### Why

- S3 primary enables no-redeploy prompt updates
- Repo fallback protects reliability if S3 read fails
- This keeps product iteration speed high while preserving resilience

## Model Strategy

- `OPENROUTER_MODEL` is required env var
- v1 default value target: Gemini 3.1 Pro preview model id available on OpenRouter at implementation time
- Keep temperature low for structured markdown reliability
- Enforce response as markdown and validate required headers before writing to S3

## Context Assembly Algorithm

1. Read profile by key `USER#<CHILD_ID>` and `PROFILE`
2. Query logs by partition `LOG#<CHILD_ID>`
3. Filter logs to last 7 days based on `SK` date suffix
4. Sort ascending by date
5. Include recommended fields only present in each log item when constructing model context (from `Daily Log Item Shape` above)
6. Load development guide docs from `S3_DEVELOPMENT_GUIDES_PREFIX`
7. Load prompt from `S3_PROMPT_KEY` fallback to local file
8. Build final model input with profile plus logs plus guides
9. Generate markdown
10. Validate required headings
11. Write to `plans/<childId>/<timestamp>.md`

## Required Environment Variables

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `DYNAMODB_TABLE`
- `CHILD_ID`
- `S3_BUCKET`
- `S3_DEVELOPMENT_GUIDES_PREFIX`
- `S3_PROMPT_KEY`
- `S3_WEEKLY_PLANS_PREFIX`
- `REGION`

## Local Testing Plan

### Fixtures

- `tests/fixtures/profile.ts` aligned to profile item shape
- `tests/fixtures/daily-logs.ts` aligned to daily log item shape

### Runner

- Build local script that:
  - loads fixture profile and fixture logs
  - simulates 7 day filtering
  - calls same prompt assembly path
  - can run with real OpenRouter key or stubbed model response
  - writes output markdown to local folder for inspection

## Deployment Options

### Option A AWS CLI Script First

Pros

- fastest to stand up
- easy to debug from terminal
- no CI setup overhead

Cons

- manual execution risk
- weaker audit trail vs CI
- easy to drift between local environments

### Option B GitHub Actions CI CD

Pros

- repeatable deployment on push
- stronger traceability and rollback history
- team friendly and safer long term

Cons

- initial setup overhead
- needs IAM OIDC role configuration
- pipeline debugging can be slower initially

### Recommendation

1. Start with AWS CLI deployment script for first stable iterations
2. Move to GitHub Actions with OIDC as soon as Lambda behavior is stable
3. Keep both paths available temporarily until CI is trusted

## Current Delivery Status (Updated)

### Completed

- ✅ CLI deployment path validated end-to-end (`build -> package -> deploy -> invoke`).
- ✅ GitHub Actions OIDC deployment path validated on push to `main`.
- ✅ Workflow now includes:
  - required input preflight checks,
  - Lambda update wait steps,
  - retry logic for configuration updates,
  - post-deploy status verification.
- ✅ Environment parity improved between CLI and CI paths, including `OPENROUTER_API_KEY` wiring.
- ✅ Weekly-plan generation runtime replaced bootstrap health handler in Lambda code.
- ✅ Packaging stabilized for Lambda runtime compatibility:
  - build emits CommonJS `handler.cjs` locally,
  - package step creates `handler.js` at zip root,
  - Lambda handler value standardized as `handler.handler`.
- ✅ Post-fix deployment validated after resolving:
  - `Dynamic require of "buffer" is not supported`,
  - `Runtime.HandlerNotFound` from handler-path mismatch,
  - cross-platform CI packaging issue (`copy: not found`).

### Remaining Work (Next Steps)

1. Add integration-level smoke test that confirms object creation in S3 after deploy.
2. Add an automated post-deploy invoke/check step in CI (optional but recommended).
3. Keep CI on `main` as primary deployment path; keep CLI only as break-glass fallback.

## Detailed Step by Step Execution Checklist

### Phase 0 Repository Bootstrap

1. Create GitHub repository named `sprout-weekly-plan-worker`.
2. Push current baseline files including `architecture.md`, `plan.md`, `.clinerules`, `.gitignore`.
3. Set default branch to `main`.
4. Enable branch protection on `main` with at least one review before merge.

### Phase 1 Lambda Build and AWS CLI Deployment Validation

Status: ✅ Completed (bootstrap implementation + successful deploy/invoke validation)

1. Scaffold Lambda TypeScript project structure with `src/`, `scripts/`, `tests/fixtures/`.
2. Add build tooling for single-file Lambda bundle targeting Node.js 22.
3. Implement environment variable validator at startup.
4. Implement DynamoDB profile read using `PK=USER#<CHILD_ID>` and `SK=PROFILE`.
5. Implement DynamoDB logs query using `PK=LOG#<CHILD_ID>` and date-key filtering.
6. Implement 7-day window filter and deterministic sort order.
7. Implement S3 prompt loader:
   - primary: `S3_PROMPT_KEY`
   - fallback: local `create-weekly-plan-prompt.md`
8. Implement development guides loader from `S3_DEVELOPMENT_GUIDES_PREFIX`.
9. Implement OpenRouter client using `OPENROUTER_MODEL`.
10. Implement prompt assembly that includes all fields from each selected log item.
11. Implement markdown header validation for required weekly-plan sections.
12. Implement S3 artifact write to `plans/<childId>/<timestamp>.md`.
13. Implement Lambda `handler` returning structured success/failure payload.
14. Add local runner using fixture profile and fixture logs.
15. Add CLI deployment script:
    - create function if missing
    - update code if exists
    - update configuration env vars
16. Run deployment script and invoke Lambda once to validate end-to-end flow.
17. Verify generated output object appears in S3 weekly plans prefix.

### Phase 2 GitHub Actions Auto Deploy on Main

Status: ✅ Completed (OIDC configured, workflow green after IAM and race-condition hardening)

1. Create AWS IAM role for GitHub OIDC trust scoped to this repository.
2. Grant minimum permissions for Lambda update, configuration update, and optional read checks.
3. Add GitHub Actions workflow triggered on push to `main`.
4. Configure workflow to:
   - install dependencies
   - run build
   - package Lambda artifact
   - deploy using AWS credentials from OIDC role
5. Add workflow safeguards:
   - fail-fast on build errors
   - explicit region/function checks
   - clear deploy summary in logs
6. Merge a small test change to confirm auto deploy path is healthy.

### Phase 3 Promotion and Operating Model

Status: ✅ Completed

1. ✅ Keep AWS CLI script as emergency fallback while CI stabilizes.
2. ✅ Use feature branches and PRs for every change.
3. ✅ Allow production deploy only through merge to `main`.
4. ✅ Require green CI checks before merge.
5. ✅ Treat GitHub Actions as primary deploy path.

### Code Mode Task Order

1. Scaffold project and build config.
2. Implement worker modules in this order:
   - env validation
   - Dynamo reads and 7-day filter
   - prompt and guides loading
   - OpenRouter generation and markdown validation
   - S3 output writer and handler
3. Add local runner and fixtures.
4. Add AWS CLI deploy script and validate deployment.
5. Add GitHub Actions OIDC workflow for push-to-main deploy.

