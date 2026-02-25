import test from 'node:test'
import assert from 'node:assert/strict'

import { validateWeeklyPlanMarkdown } from '../src/markdown-validation.ts'

const validMarkdown = `
# 🌱 Weekly Developmental Plan
Intro section

# 🎯 Weekly Goals (Observable)
Goal section

# 🧺 Weekly Activity Menu (Pick 3–5 per day, repeat favorites)
Menu intro

## Monday
Content

## Tuesday
Content

## Wednesday
Content

## Thursday
Content

## Friday
Content

## Weekend (Repeat & Extend)
Content

# 👶 Caregiving-as-Learning Scripts
Content

# 🔎 What to Observe This Week
Content

# 🔁 End-of-Week Reflection
Content

# ➡️ How Next Week Might Progress
Content

# 🛟 Safety Reminders
Content
`.trim()

test('validateWeeklyPlanMarkdown accepts markdown with all required headers', () => {
  assert.doesNotThrow(() => {
    validateWeeklyPlanMarkdown(validMarkdown)
  })
})

test('validateWeeklyPlanMarkdown throws when one required header is missing', () => {
  const brokenMarkdown = validMarkdown.replace('# 🛟 Safety Reminders', '# Safety Notes')

  assert.throws(() => {
    validateWeeklyPlanMarkdown(brokenMarkdown)
  }, /missing required headers/i)
})

