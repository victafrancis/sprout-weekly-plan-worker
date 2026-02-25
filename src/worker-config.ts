import type { WorkerConfig } from './worker-types.js'

type EnvironmentMap = NodeJS.ProcessEnv

function readRequiredEnvironmentValue(environment: EnvironmentMap, variableName: string): string {
  const variableValue = environment[variableName]

  if (variableValue === undefined) {
    throw new Error(`Missing required environment variable: ${variableName}`)
  }

  const trimmedValue = variableValue.trim()

  if (trimmedValue.length === 0) {
    throw new Error(`Environment variable must not be empty: ${variableName}`)
  }

  return trimmedValue
}

function normalizePrefix(prefixValue: string): string {
  if (prefixValue.endsWith('/')) {
    return prefixValue
  }

  return `${prefixValue}/`
}

export function readWorkerConfig(environment: EnvironmentMap): WorkerConfig {
  const region = readRequiredEnvironmentValue(environment, 'REGION')
  const openRouterApiKey = readRequiredEnvironmentValue(environment, 'OPENROUTER_API_KEY')
  const openRouterModel = readRequiredEnvironmentValue(environment, 'OPENROUTER_MODEL')
  const dynamoDbTable = readRequiredEnvironmentValue(environment, 'DYNAMODB_TABLE')
  const childId = readRequiredEnvironmentValue(environment, 'CHILD_ID')
  const s3Bucket = readRequiredEnvironmentValue(environment, 'S3_BUCKET')
  const s3DevelopmentGuidesPrefix = normalizePrefix(
    readRequiredEnvironmentValue(environment, 'S3_DEVELOPMENT_GUIDES_PREFIX'),
  )
  const s3PromptKey = readRequiredEnvironmentValue(environment, 'S3_PROMPT_KEY')
  const s3WeeklyPlansPrefix = normalizePrefix(readRequiredEnvironmentValue(environment, 'S3_WEEKLY_PLANS_PREFIX'))

  return {
    region,
    openRouterApiKey,
    openRouterModel,
    dynamoDbTable,
    childId,
    s3Bucket,
    s3DevelopmentGuidesPrefix,
    s3PromptKey,
    s3WeeklyPlansPrefix,
    logWindowDays: 7,
  }
}

