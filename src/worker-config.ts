import type { WorkerConfig } from './worker-types.js'

type EnvironmentMap = NodeJS.ProcessEnv

function readOptionalThinkingLevel(environment: EnvironmentMap): 'low' | 'medium' | 'high' | undefined {
  const rawValue = environment.OPENROUTER_THINKING_LEVEL

  if (rawValue === undefined) {
    return undefined
  }

  const normalizedValue = rawValue.trim().toLowerCase()

  if (normalizedValue.length === 0) {
    return undefined
  }

  if (normalizedValue === 'low' || normalizedValue === 'medium' || normalizedValue === 'high') {
    return normalizedValue
  }

  throw new Error('OPENROUTER_THINKING_LEVEL must be one of: low, medium, high')
}

function readOptionalReasoningEnabled(environment: EnvironmentMap): boolean | undefined {
  const rawValue = environment.OPENROUTER_REASONING_ENABLED

  if (rawValue === undefined) {
    return undefined
  }

  const normalizedValue = rawValue.trim().toLowerCase()

  if (normalizedValue.length === 0) {
    return undefined
  }

  if (normalizedValue === 'true') {
    return true
  }

  if (normalizedValue === 'false') {
    return false
  }

  throw new Error('OPENROUTER_REASONING_ENABLED must be true or false')
}

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
  const openRouterThinkingLevel = readOptionalThinkingLevel(environment)
  const openRouterReasoningEnabled = readOptionalReasoningEnabled(environment)
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
    openRouterThinkingLevel,
    openRouterReasoningEnabled,
    dynamoDbTable,
    childId,
    s3Bucket,
    s3DevelopmentGuidesPrefix,
    s3PromptKey,
    s3WeeklyPlansPrefix,
    logWindowDays: 7,
  }
}

