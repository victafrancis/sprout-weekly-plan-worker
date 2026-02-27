export type WorkerInputEvent = {
  requestSource?: 'manual' | string
  requestedAt?: string
}

export type WorkerOutput = {
  ok: boolean
  childId: string
  outputObjectKey?: string
  model: string
  logWindowDays: 7
  logsCount: number
  error?: string
}

export type ChildProfileItem = {
  PK: string
  SK: 'PROFILE'
  birth_date?: string
  milestones?: string[]
  schemas?: string[]
  interests?: string[]
  [key: string]: unknown
}

export type DailyLogItem = {
  PK: string
  SK: string
  raw_text?: string
  key_takeaways?: string[]
  sentiment?: 'positive' | 'neutral' | 'mixed' | 'frustrated' | string
  plan_reference?: {
    referenceContentMarkdown?: string
  }
}

export type WorkerConfig = {
  region: string
  openRouterApiKey: string
  openRouterModel: string
  openRouterThinkingLevel?: 'low' | 'medium' | 'high'
  openRouterReasoningEnabled?: boolean
  dynamoDbTable: string
  childId: string
  s3Bucket: string
  s3DevelopmentGuidesPrefix: string
  s3PromptKey: string
  s3WeeklyPlansPrefix: string
  logWindowDays: 7
}

