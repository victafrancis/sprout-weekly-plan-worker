import type { Handler } from 'aws-lambda'

type InputEvent = {
  requestSource?: 'manual' | string
  requestedAt?: string
}

type HealthResponse = {
  ok: boolean
  service: 'sprout-weekly-plan-worker'
  stage: 'bootstrap'
  requestSource: string
  requestedAt: string
  timestamp: string
  checks: {
    region: boolean
    dynamoTable: boolean
    s3Bucket: boolean
    childId: boolean
    openrouterModel: boolean
  }
}

const hasValue = (v: string | undefined): boolean => Boolean(v && v.trim().length > 0)

export const handler: Handler<InputEvent, HealthResponse> = async (event) => {
  const checks = {
    region: hasValue(process.env.REGION),
    dynamoTable: hasValue(process.env.DYNAMODB_TABLE),
    s3Bucket: hasValue(process.env.S3_BUCKET),
    childId: hasValue(process.env.CHILD_ID),
    openrouterModel: hasValue(process.env.OPENROUTER_MODEL),
  }

  return {
    ok: Object.values(checks).every(Boolean),
    service: 'sprout-weekly-plan-worker',
    stage: 'bootstrap',
    requestSource: event?.requestSource ?? 'manual',
    requestedAt: event?.requestedAt ?? new Date().toISOString(),
    timestamp: new Date().toISOString(),
    checks,
  }
}

