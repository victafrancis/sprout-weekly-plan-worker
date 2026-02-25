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

function formatJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function buildOpenRouterPromptInput(input: BuildPromptInput): string {
  const contextEnvelope = {
    childId: input.childId,
    requestSource: input.requestSource,
    requestedAt: input.requestedAt,
    profile: input.profileItem,
    recentLogs: input.recentLogs,
    guidesCount: input.developmentGuides.length,
  }

  const sections: string[] = []
  sections.push(input.promptTemplate.trim())
  sections.push('')
  sections.push('---')
  sections.push('')
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
  sections.push('- Follow the exact required headers from the template.')
  sections.push('- Keep guidance practical, concise, and parent-friendly.')

  return sections.join('\n').trim()
}

