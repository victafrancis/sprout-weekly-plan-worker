import type { Handler } from 'aws-lambda'
import { createHash } from 'node:crypto'

import { buildOpenRouterPromptMessages } from './prompt-context.js'
import { readWorkerConfig } from './worker-config.js'
import { fetchLogsForWindow, fetchProfileItem } from './worker-dynamodb.js'
import { generateWeeklyPlanMarkdown } from './worker-openrouter.js'
import { loadDevelopmentGuidesMarkdown, loadPromptTemplateMarkdown, writeWeeklyPlanArtifact } from './worker-s3.js'
import type { WorkerInputEvent, WorkerOutput } from './worker-types.js'

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export const handler: Handler<WorkerInputEvent, WorkerOutput> = async (event) => {
  const safeEvent = event ?? {}

  try {
    const config = readWorkerConfig(process.env)
    const requestTimestamp = safeEvent.requestedAt ?? new Date().toISOString()

    const profileItem = await fetchProfileItem({
      region: config.region,
      tableName: config.dynamoDbTable,
      childId: config.childId,
    })

    const recentLogs = await fetchLogsForWindow({
      region: config.region,
      tableName: config.dynamoDbTable,
      childId: config.childId,
      nowIso: requestTimestamp,
      logWindowDays: config.logWindowDays,
    })

    const developmentGuides = await loadDevelopmentGuidesMarkdown({
      region: config.region,
      bucketName: config.s3Bucket,
      guidesPrefix: config.s3DevelopmentGuidesPrefix,
    })

    const promptTemplate = await loadPromptTemplateMarkdown({
      region: config.region,
      bucketName: config.s3Bucket,
      promptKey: config.s3PromptKey,
    })

    const modelPromptMessages = buildOpenRouterPromptMessages({
      promptTemplate,
      childId: config.childId,
      profileItem,
      recentLogs,
      developmentGuides,
      requestSource: safeEvent.requestSource ?? 'manual',
      requestedAt: requestTimestamp,
    })

    console.info(
      JSON.stringify({
        event: 'weekly-plan.model-input-summary',
        childId: config.childId,
        requestSource: safeEvent.requestSource ?? 'manual',
        requestedAt: requestTimestamp,
        logsCount: recentLogs.length,
        guidesCount: developmentGuides.length,
        systemPromptCharacters: modelPromptMessages.systemPrompt.length,
        userPromptCharacters: modelPromptMessages.userPrompt.length,
        systemPromptSha256: hashText(modelPromptMessages.systemPrompt),
        userPromptSha256: hashText(modelPromptMessages.userPrompt),
        systemPromptFirstLine: modelPromptMessages.systemPrompt.split('\n')[0]?.trim() ?? '',
      }),
    )

    const generatedMarkdown = await generateWeeklyPlanMarkdown({
      apiKey: config.openRouterApiKey,
      model: config.openRouterModel,
      systemPrompt: modelPromptMessages.systemPrompt,
      userPrompt: modelPromptMessages.userPrompt,
      thinkingLevel: config.openRouterThinkingLevel,
      reasoningEnabled: config.openRouterReasoningEnabled,
    })

    const outputObjectKey = await writeWeeklyPlanArtifact({
      region: config.region,
      bucketName: config.s3Bucket,
      plansPrefix: config.s3WeeklyPlansPrefix,
      childId: config.childId,
      markdownContent: generatedMarkdown,
      requestedAtIso: requestTimestamp,
    })

    return {
      ok: true,
      childId: config.childId,
      outputObjectKey,
      model: config.openRouterModel,
      logWindowDays: config.logWindowDays,
      logsCount: recentLogs.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown weekly-plan worker error'

    return {
      ok: false,
      childId: process.env.CHILD_ID ?? 'unknown',
      model: process.env.OPENROUTER_MODEL ?? 'unknown',
      logWindowDays: 7,
      logsCount: 0,
      error: errorMessage,
    }
  }
}

