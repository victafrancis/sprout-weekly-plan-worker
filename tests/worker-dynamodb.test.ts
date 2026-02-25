import test from 'node:test'
import assert from 'node:assert/strict'

import { selectLogsForRollingWindow } from '../src/worker-dynamodb.ts'
import { mockDailyLogItems } from '../daily-log.ts'

test('selectLogsForRollingWindow keeps only last 7 days sorted ascending', () => {
  const selectedLogs = selectLogsForRollingWindow({
    logs: mockDailyLogItems,
    nowIso: '2026-02-24T15:00:00.000Z',
    logWindowDays: 7,
  })

  assert.equal(selectedLogs.length, 7)
  assert.equal(selectedLogs[0].SK, 'DATE#2026-02-18')
  assert.equal(selectedLogs[6].SK, 'DATE#2026-02-24')
})

