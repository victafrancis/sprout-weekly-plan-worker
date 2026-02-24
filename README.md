# Sprout Weekly Plan Worker

This repository contains the background worker for Sprout that generates a weekly developmental plan from recent child activity logs.

## What this worker does

- Reads child profile data from DynamoDB using the single-table key contract.
- Reads the last 7 days of daily logs for the configured child.
- Loads the weekly-plan prompt from S3 at `prompts/create-weekly-plan-prompt.md` with local fallback.
- Sends assembled context to OpenRouter using a model configured by environment variable.
- Validates the markdown output shape.
- Writes the generated weekly plan artifact to S3 under `plans/<childId>/<timestamp>.md`.

## v1 scope

- Runtime: TypeScript on AWS Lambda `nodejs22.x`
- Trigger: manual API-triggered invocation
- Child selection: single `CHILD_ID` from environment
- Delivery: S3 markdown artifact only
- Not in v1: SES email, scheduled EventBridge trigger

## Key references

- Architecture: [`architecture.md`](architecture.md)
- Implementation plan: [`plan.md`](plan.md)
- Agent guardrails: [`.clinerules`](.clinerules)

## Deployment approach

1. Validate quickly with AWS CLI deploy/update flow.
2. Add GitHub Actions auto-deploy on push to `main` using AWS OIDC.

## Quickstart (CLI-first)

### 1) Install dependencies

```bash
npm install
```

### 2) Build and package

```bash
npm run package
```

### 3) Set required environment variables (Windows `cmd.exe`)

```cmd
set REGION=us-east-1
set LAMBDA_FUNCTION_NAME=sprout-weekly-plan-worker
set LAMBDA_ROLE_ARN=arn:aws:iam::<account-id>:role/<lambda-exec-role>
set DYNAMODB_TABLE=Sprout_Data
set S3_BUCKET=sprout-knowledge-base
set CHILD_ID=Bambam
set OPENROUTER_MODEL=google/gemini-3.1-pro-preview
set S3_PROMPT_KEY=prompts/create-weekly-plan-prompt.md
set S3_DEVELOPMENT_GUIDES_PREFIX=development_guides/
set S3_WEEKLY_PLANS_PREFIX=plans/
```

### 4) Deploy with AWS CLI

```cmd
npm run deploy:cli
```

### 5) Invoke health-check handler

```cmd
aws lambda invoke --function-name %LAMBDA_FUNCTION_NAME% --payload "{}" --cli-binary-format raw-in-base64-out --region %REGION% out.json && type out.json
```

## CI/CD (GitHub Actions + OIDC)

- Workflow file: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
- Trigger: push to `main`
- Required repository secret:
  - `AWS_GITHUB_ACTIONS_ROLE_ARN`
- Required repository variables:
  - `REGION`
  - `LAMBDA_FUNCTION_NAME`
  - `DYNAMODB_TABLE`
  - `S3_BUCKET`
  - `CHILD_ID`
  - `OPENROUTER_MODEL`
  - `S3_PROMPT_KEY`
  - `S3_DEVELOPMENT_GUIDES_PREFIX`
  - `S3_WEEKLY_PLANS_PREFIX`

See OIDC requirements in [`docs/github-oidc-setup.md`](docs/github-oidc-setup.md).

