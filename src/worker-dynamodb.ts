import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

import type { ChildProfileItem, DailyLogItem } from './worker-types.js'

type FetchProfileInput = {
  region: string
  tableName: string
  childId: string
}

type FetchLogsInput = {
  region: string
  tableName: string
  childId: string
  nowIso: string
  logWindowDays: number
}

function createDocumentClient(region: string): DynamoDBDocumentClient {
  const lowLevelClient = new DynamoDBClient({ region })
  return DynamoDBDocumentClient.from(lowLevelClient)
}

function extractDateFromSortKey(sortKey: string): string | null {
  if (!sortKey.startsWith('DATE#')) {
    return null
  }

  const datePart = sortKey.slice('DATE#'.length)

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart
  }

  const timestampDatePrefix = datePart.slice(0, 10)

  if (/^\d{4}-\d{2}-\d{2}$/.test(timestampDatePrefix)) {
    return timestampDatePrefix
  }

  return null
}

function toDateAtUtcMidnight(dateText: string): Date {
  return new Date(`${dateText}T00:00:00.000Z`)
}

function toIsoDate(dateValue: Date): string {
  return dateValue.toISOString().slice(0, 10)
}

function getRollingWindowBounds(nowIso: string, logWindowDays: number): { startDateText: string; endDateText: string } {
  const nowDate = new Date(nowIso)

  if (Number.isNaN(nowDate.getTime())) {
    throw new Error(`Invalid nowIso timestamp: ${nowIso}`)
  }

  const endDateText = toIsoDate(nowDate)
  const startDate = new Date(nowDate.getTime())
  startDate.setUTCDate(startDate.getUTCDate() - (logWindowDays - 1))
  const startDateText = toIsoDate(startDate)

  return {
    startDateText,
    endDateText,
  }
}

export function selectLogsForRollingWindow(input: {
  logs: DailyLogItem[]
  nowIso: string
  logWindowDays: number
}): DailyLogItem[] {
  const { startDateText, endDateText } = getRollingWindowBounds(input.nowIso, input.logWindowDays)

  const logsInsideWindow: DailyLogItem[] = []

  for (const logItem of input.logs) {
    const logDateText = extractDateFromSortKey(logItem.SK)

    if (logDateText === null) {
      continue
    }

    if (logDateText < startDateText) {
      continue
    }

    if (logDateText > endDateText) {
      continue
    }

    logsInsideWindow.push(logItem)
  }

  logsInsideWindow.sort((leftLog, rightLog) => {
    const leftDateText = extractDateFromSortKey(leftLog.SK)
    const rightDateText = extractDateFromSortKey(rightLog.SK)

    if (leftDateText === null || rightDateText === null) {
      return 0
    }

    const leftTime = toDateAtUtcMidnight(leftDateText).getTime()
    const rightTime = toDateAtUtcMidnight(rightDateText).getTime()

    return leftTime - rightTime
  })

  return logsInsideWindow
}

export async function fetchProfileItem(input: FetchProfileInput): Promise<ChildProfileItem> {
  const documentClient = createDocumentClient(input.region)
  const profilePartitionKey = `USER#${input.childId}`

  const profileResult = await documentClient.send(
    new GetCommand({
      TableName: input.tableName,
      Key: {
        PK: profilePartitionKey,
        SK: 'PROFILE',
      },
    }),
  )

  if (!profileResult.Item) {
    throw new Error(`Profile item not found for childId=${input.childId}`)
  }

  return profileResult.Item as ChildProfileItem
}

export async function fetchLogsForWindow(input: FetchLogsInput): Promise<DailyLogItem[]> {
  const documentClient = createDocumentClient(input.region)
  const logsPartitionKey = `LOG#${input.childId}`
  const { startDateText, endDateText } = getRollingWindowBounds(input.nowIso, input.logWindowDays)

  const logQueryResult = await documentClient.send(
    new QueryCommand({
      TableName: input.tableName,
      KeyConditionExpression: 'PK = :partitionKey',
      ExpressionAttributeValues: {
        ':partitionKey': logsPartitionKey,
      },
    }),
  )

  const allChildLogs = (logQueryResult.Items ?? []) as DailyLogItem[]
  const selectedLogs = selectLogsForRollingWindow({
    logs: allChildLogs,
    nowIso: input.nowIso,
    logWindowDays: input.logWindowDays,
  })

  const selectedLogDates: string[] = []

  for (const logItem of selectedLogs) {
    const logDateText = extractDateFromSortKey(logItem.SK)

    if (!logDateText) {
      continue
    }

    selectedLogDates.push(logDateText)
  }

  console.info(
    JSON.stringify({
      event: 'weekly-plan.logs-window',
      childId: input.childId,
      nowIso: input.nowIso,
      logWindowDays: input.logWindowDays,
      windowStartDate: startDateText,
      windowEndDate: endDateText,
      queriedLogsCount: allChildLogs.length,
      selectedLogsCount: selectedLogs.length,
      selectedLogDates,
    }),
  )

  return selectedLogs
}

