import type { ChildProfileItem, DailyLogItem } from './worker-types.js'

type BuildPromptInput = {
  promptTemplate: string
  childId: string
  profileItem: ChildProfileItem
  recentLogs: DailyLogItem[]
  developmentGuides: string[]
  requestSource: string
  requestedAt: string
}

export type OpenRouterPromptMessages = {
  systemPrompt: string
  userPrompt: string
}

function formatJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function buildRuntimeContextSections(input: BuildPromptInput): string {
  const contextEnvelope = {
    childId: input.childId,
    requestSource: input.requestSource,
    requestedAt: input.requestedAt,
    profile: input.profileItem,
    recentLogs: input.recentLogs,
    guidesCount: input.developmentGuides.length,
  }

  const sections: string[] = []
  sections.push('## Runtime Context')
  sections.push(formatJsonBlock(contextEnvelope))
  sections.push('')
  sections.push('## Development Guides')

  if (input.developmentGuides.length === 0) {
    sections.push('No development guides were available in S3 for this run.')
  } else {
    for (let index = 0; index < input.developmentGuides.length; index += 1) {
      const guideNumber = index + 1
      sections.push(`### Guide ${guideNumber}`)
      sections.push(input.developmentGuides[index])
      sections.push('')
    }
  }

  sections.push('## Output Rules')
  sections.push('- Return markdown only.')
  sections.push('- Follow the planning structure and style guidance from the system prompt.')
  sections.push('- Keep guidance practical, concise, and parent-friendly.')

  return sections.join('\n').trim()
}

export function buildOpenRouterPromptMessages(input: BuildPromptInput): OpenRouterPromptMessages {
  const systemPrompt = input.promptTemplate.trim()
  const userPrompt = buildRuntimeContextSections(input)

  return {
    systemPrompt,
    userPrompt,
  }
}

export function buildOpenRouterPromptInput(input: BuildPromptInput): string {
  const sections: string[] = []
  sections.push(input.promptTemplate.trim())
  sections.push('')
  sections.push('---')
  sections.push('')
  sections.push(buildRuntimeContextSections(input))

  return sections.join('\n').trim()
}

