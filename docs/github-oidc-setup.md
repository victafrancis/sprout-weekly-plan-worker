# GitHub OIDC Setup for Lambda Deploy

This document defines the minimum setup for GitHub Actions to deploy Lambda without long-lived AWS keys.

## 1) Create OIDC identity provider in AWS

In IAM, add an OpenID Connect provider with:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

## 2) Create deploy role for GitHub Actions

Create an IAM role trusted by the GitHub OIDC provider.

### Trust policy example

Replace `<account-id>`, `<org>`, and `<repo>`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<org>/<repo>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

## 3) Attach least-privilege policy to the role

Minimum permissions for this repository workflow:

- `lambda:UpdateFunctionCode`
- `lambda:UpdateFunctionConfiguration`
- `lambda:GetFunction`

Optional if you later create functions from CI:

- `lambda:CreateFunction`
- `iam:PassRole` (scoped to Lambda execution role)

Scope resources to the specific Lambda ARN whenever possible.

## 4) Configure GitHub repository settings

Set secret:

- `AWS_GITHUB_ACTIONS_ROLE_ARN` = deploy role ARN

Set repository variables used by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- `REGION`
- `LAMBDA_FUNCTION_NAME`
- `DYNAMODB_TABLE`
- `S3_BUCKET`
- `CHILD_ID`
- `OPENROUTER_MODEL`
- `S3_PROMPT_KEY`
- `S3_DEVELOPMENT_GUIDES_PREFIX`
- `S3_WEEKLY_PLANS_PREFIX`

## 5) Validate

1. Push a small change to `main`.
2. Confirm workflow run succeeds.
3. Confirm Lambda code/configuration update in AWS console.

