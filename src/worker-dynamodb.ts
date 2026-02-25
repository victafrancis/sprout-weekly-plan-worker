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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null
  }

  return datePart
}

function toDateAtUtcMidnight(dateText: string): Date {
  return new Date(`${dateText}T00:00:00.000Z`)
}

function toIsoDate(dateValue: Date): string {
  return dateValue.toISOString().slice(0, 10)
}

export function selectLogsForRollingWindow(input: {
  logs: DailyLogItem[]
  nowIso: string
  logWindowDays: number
}): DailyLogItem[] {
  const nowDate = new Date(input.nowIso)

  if (Number.isNaN(nowDate.getTime())) {
    throw new Error(`Invalid nowIso timestamp: ${input.nowIso}`)
  }

  const endDateText = toIsoDate(nowDate)
  const startDate = new Date(nowDate.getTime())
  startDate.setUTCDate(startDate.getUTCDate() - (input.logWindowDays - 1))
  const startDateText = toIsoDate(startDate)

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

  return selectLogsForRollingWindow({
    logs: allChildLogs,
    nowIso: input.nowIso,
    logWindowDays: input.logWindowDays,
  })
}

