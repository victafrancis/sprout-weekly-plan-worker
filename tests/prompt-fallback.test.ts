import test from 'node:test'
import assert from 'node:assert/strict'

import { resolvePromptTemplate } from '../src/prompt-fallback.ts'

test('resolvePromptTemplate returns remote prompt when available', () => {
  const prompt = resolvePromptTemplate({
    remotePromptMarkdown: '# Remote Prompt',
    fallbackPromptMarkdown: '# Local Prompt',
  })

  assert.equal(prompt, '# Remote Prompt')
})

test('resolvePromptTemplate falls back to local prompt when remote is empty', () => {
  const prompt = resolvePromptTemplate({
    remotePromptMarkdown: '   ',
    fallbackPromptMarkdown: '# Local Prompt',
  })

  assert.equal(prompt, '# Local Prompt')
})

test('resolvePromptTemplate throws when both remote and local prompts are empty', () => {
  assert.throws(() => {
    resolvePromptTemplate({
      remotePromptMarkdown: null,
      fallbackPromptMarkdown: ' ',
    })
  }, /fallback is empty/i)
})

