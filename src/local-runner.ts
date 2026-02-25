import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildOpenRouterPromptInput } from './prompt-context.js'
import { selectLogsForRollingWindow } from './worker-dynamodb.js'
import { resolvePromptTemplate } from './prompt-fallback.js'
import { getRequiredWeeklyPlanHeaders, validateWeeklyPlanMarkdown } from './markdown-validation.js'
import type { ChildProfileItem, DailyLogItem } from './worker-types.js'

import { mockDailyLogItems } from '../daily-log'
import { mockChildProfileItem } from '../profile'

function readLocalPromptTemplate(): string {
  const promptPath = resolve(process.cwd(), 'create-weekly-plan-prompt.md')
  return readFileSync(promptPath, 'utf-8')
}

function createStubWeeklyPlanMarkdown(): string {
  const headers = getRequiredWeeklyPlanHeaders()
  const contentLines: string[] = []

  for (const header of headers) {
    contentLines.push(header)
    contentLines.push('Sample content for local runner validation.')
    contentLines.push('')
  }

  return contentLines.join('\n').trim()
}

async function runLocalFixtureFlow(): Promise<void> {
  const nowIso = new Date().toISOString()
  const fixtureProfile = mockChildProfileItem as ChildProfileItem
  const fixtureLogs = mockDailyLogItems as DailyLogItem[]

  const recentLogs = selectLogsForRollingWindow({
    logs: fixtureLogs,
    nowIso,
    logWindowDays: 7,
  })

  const resolvedPrompt = resolvePromptTemplate({
    remotePromptMarkdown: null,
    fallbackPromptMarkdown: readLocalPromptTemplate(),
  })

  const composedPrompt = buildOpenRouterPromptInput({
    promptTemplate: resolvedPrompt,
    childId: 'Bambam',
    profileItem: fixtureProfile,
    recentLogs,
    developmentGuides: ['# Example Guide\nUse repetition and responsive interaction.'],
    requestSource: 'manual',
    requestedAt: nowIso,
  })

  if (composedPrompt.trim().length === 0) {
    throw new Error('Local runner produced empty prompt input')
  }

  const stubMarkdown = createStubWeeklyPlanMarkdown()
  validateWeeklyPlanMarkdown(stubMarkdown)

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: 'Local fixture flow executed successfully',
        logsCount: recentLogs.length,
      },
      null,
      2,
    ),
  )
}

runLocalFixtureFlow().catch((error) => {
  console.error(error)
  process.exit(1)
})

