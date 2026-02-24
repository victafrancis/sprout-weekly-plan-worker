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

