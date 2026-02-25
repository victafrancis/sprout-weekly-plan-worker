const requiredMarkdownHeaders = [
  '# 🌱 Weekly Developmental Plan',
  '# 🎯 Weekly Goals (Observable)',
  '# 🧺 Weekly Activity Menu (Pick 3–5 per day, repeat favorites)',
  '## Monday',
  '## Tuesday',
  '## Wednesday',
  '## Thursday',
  '## Friday',
  '## Weekend (Repeat & Extend)',
  '# 👶 Caregiving-as-Learning Scripts',
  '# 🔎 What to Observe This Week',
  '# 🔁 End-of-Week Reflection',
  '# ➡️ How Next Week Might Progress',
  '# 🛟 Safety Reminders',
]

export function validateWeeklyPlanMarkdown(markdownText: string): void {
  const normalizedMarkdown = markdownText.trim()

  if (normalizedMarkdown.length === 0) {
    throw new Error('Generated markdown is empty')
  }

  const missingHeaders: string[] = []
  const markdownHeadingLines = normalizedMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))

  for (const requiredHeader of requiredMarkdownHeaders) {
    const hasSubstringMatch = normalizedMarkdown.includes(requiredHeader)
    const hasExactHeadingLineMatch = markdownHeadingLines.includes(requiredHeader)

    if (!hasSubstringMatch) {
      missingHeaders.push(requiredHeader)
      continue
    }

    if (!hasExactHeadingLineMatch) {
      console.warn('[weekly-plan-worker] Header requirement only matched as substring, not exact heading line', {
        requiredHeader,
      })
    }
  }

  if (missingHeaders.length > 0) {
    const formattedList = missingHeaders.join(' | ')
    console.warn('[weekly-plan-worker] Generated markdown failed required header validation', {
      missingHeaders,
      headingLinesFound: markdownHeadingLines,
    })
    throw new Error(`Generated markdown is missing required headers: ${formattedList}`)
  }

  console.info('[weekly-plan-worker] Generated markdown passed required header validation', {
    requiredHeaderCount: requiredMarkdownHeaders.length,
    headingLinesFoundCount: markdownHeadingLines.length,
  })
}

export function getRequiredWeeklyPlanHeaders(): string[] {
  return [...requiredMarkdownHeaders]
}

