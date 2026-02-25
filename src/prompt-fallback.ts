type ResolvePromptTemplateInput = {
  remotePromptMarkdown: string | null
  fallbackPromptMarkdown: string
}

export function resolvePromptTemplate(input: ResolvePromptTemplateInput): string {
  const normalizedRemotePrompt = input.remotePromptMarkdown?.trim() ?? ''

  if (normalizedRemotePrompt.length > 0) {
    return normalizedRemotePrompt
  }

  const normalizedFallbackPrompt = input.fallbackPromptMarkdown.trim()

  if (normalizedFallbackPrompt.length === 0) {
    throw new Error('Local prompt fallback is empty')
  }

  return normalizedFallbackPrompt
}

