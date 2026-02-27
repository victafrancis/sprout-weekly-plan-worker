type GenerateInput = {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  thinkingLevel?: 'low' | 'medium' | 'high'
  reasoningEnabled?: boolean
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
}

type OpenRouterMessageContent = string | Array<{ type?: string; text?: string }> | undefined

function extractTextFromModelContent(content: OpenRouterMessageContent): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  const textParts: string[] = []

  for (const part of content) {
    if (part.type !== 'text') {
      continue
    }

    if (!part.text) {
      continue
    }

    textParts.push(part.text)
  }

  return textParts.join('\n').trim()
}

export async function generateWeeklyPlanMarkdown(input: GenerateInput): Promise<string> {
  const requestBody: Record<string, unknown> = {
    model: input.model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: input.systemPrompt,
      },
      {
        role: 'user',
        content: input.userPrompt,
      },
    ],
  }

  if (input.thinkingLevel !== undefined) {
    requestBody.thinking_level = input.thinkingLevel
  }

  if (input.reasoningEnabled !== undefined) {
    requestBody.reasoning = {
      enabled: input.reasoningEnabled,
    }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed with status ${response.status}: ${errorText}`)
  }

  const parsedResponse = (await response.json()) as OpenRouterResponse
  const firstChoice = parsedResponse.choices?.[0]
  const markdownContent = extractTextFromModelContent(firstChoice?.message?.content)

  if (markdownContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty content for weekly plan markdown')
  }

  return markdownContent
}

