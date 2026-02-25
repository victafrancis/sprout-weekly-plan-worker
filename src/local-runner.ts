import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildOpenRouterPromptMessages } from './prompt-context.js'
import { generateWeeklyPlanMarkdown } from './worker-openrouter.js'
import { selectLogsForRollingWindow } from './worker-dynamodb.js'
import { resolvePromptTemplate } from './prompt-fallback.js'
import type { ChildProfileItem, DailyLogItem } from './worker-types.js'

import { mockDailyLogItems } from '../daily-log'
import { mockChildProfileItem } from '../profile'

function readLocalPromptTemplate(): string {
  const promptPath = resolve(process.cwd(), 'create-weekly-plan-prompt.md')
  return readFileSync(promptPath, 'utf-8')
}

function loadEnvironmentFromDotEnvFile(): void {
  const dotEnvPath = resolve(process.cwd(), '.env')
  const dotEnvContent = readFileSync(dotEnvPath, 'utf-8')
  const lines = dotEnvContent.split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.length === 0) {
      continue
    }

    if (trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim()
    const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '')

    if (process.env[key] !== undefined) {
      continue
    }

    process.env[key] = unquotedValue
  }
}

function readRequiredEnvironmentVariable(variableName: 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL'): string {
  const rawValue = process.env[variableName]

  if (rawValue === undefined) {
    throw new Error(`Missing required environment variable for local generation: ${variableName}`)
  }

  const trimmedValue = rawValue.trim()

  if (trimmedValue.length === 0) {
    throw new Error(`Environment variable is empty for local generation: ${variableName}`)
  }

  return trimmedValue
}

function buildOutputFilePath(nowIso: string): string {
  const outputDirectory = resolve(process.cwd(), 'output', 'local-plans')
  mkdirSync(outputDirectory, { recursive: true })

  const safeTimestamp = nowIso.replace(/:/g, '-').replace(/\./g, '-')
  return resolve(outputDirectory, `${safeTimestamp}.md`)
}

async function runLocalFixtureFlow(): Promise<void> {
  loadEnvironmentFromDotEnvFile()

  const openRouterApiKey = readRequiredEnvironmentVariable('OPENROUTER_API_KEY')
  const openRouterModel = readRequiredEnvironmentVariable('OPENROUTER_MODEL')
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

  const promptMessages = buildOpenRouterPromptMessages({
    promptTemplate: resolvedPrompt,
    childId: 'Bambam',
    profileItem: fixtureProfile,
    recentLogs,
    developmentGuides: ['# Example Guide\nUse repetition and responsive interaction.'],
    requestSource: 'manual',
    requestedAt: nowIso,
  })

  if (promptMessages.systemPrompt.trim().length === 0) {
    throw new Error('Local runner produced an empty system prompt')
  }

  if (promptMessages.userPrompt.trim().length === 0) {
    throw new Error('Local runner produced an empty user prompt')
  }

  const generatedMarkdown = await generateWeeklyPlanMarkdown({
    apiKey: openRouterApiKey,
    model: openRouterModel,
    systemPrompt: promptMessages.systemPrompt,
    userPrompt: promptMessages.userPrompt,
  })

  const outputFilePath = buildOutputFilePath(nowIso)
  writeFileSync(outputFilePath, generatedMarkdown, 'utf-8')

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: 'Local fixture flow generated a weekly plan successfully',
        outputFilePath,
        model: openRouterModel,
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

