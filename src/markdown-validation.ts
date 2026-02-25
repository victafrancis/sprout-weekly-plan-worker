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

  for (const requiredHeader of requiredMarkdownHeaders) {
    if (!normalizedMarkdown.includes(requiredHeader)) {
      missingHeaders.push(requiredHeader)
    }
  }

  if (missingHeaders.length > 0) {
    const formattedList = missingHeaders.join(' | ')
    throw new Error(`Generated markdown is missing required headers: ${formattedList}`)
  }
}

export function getRequiredWeeklyPlanHeaders(): string[] {
  return [...requiredMarkdownHeaders]
}

