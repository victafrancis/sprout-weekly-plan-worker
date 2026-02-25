import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import localPromptTemplate from '../create-weekly-plan-prompt.md'
import { resolvePromptTemplate } from './prompt-fallback.js'

type LoadGuidesInput = {
  region: string
  bucketName: string
  guidesPrefix: string
}

type LoadPromptInput = {
  region: string
  bucketName: string
  promptKey: string
}

type WriteArtifactInput = {
  region: string
  bucketName: string
  plansPrefix: string
  childId: string
  markdownContent: string
  requestedAtIso: string
}

function createS3Client(region: string): S3Client {
  return new S3Client({ region })
}

async function readObjectAsText(params: { region: string; bucketName: string; objectKey: string }): Promise<string> {
  const s3Client = createS3Client(params.region)
  const objectResponse = await s3Client.send(
    new GetObjectCommand({
      Bucket: params.bucketName,
      Key: params.objectKey,
    }),
  )

  if (!objectResponse.Body) {
    throw new Error(`S3 object has no body: s3://${params.bucketName}/${params.objectKey}`)
  }

  return await objectResponse.Body.transformToString()
}

function sanitizeTimestampForKey(isoTimestamp: string): string {
  return isoTimestamp.replace(/:/g, '-').replace(/\./g, '-').replace(/-\d+Z$/, 'Z')
}

function normalizeObjectPrefix(prefix: string): string {
  if (prefix.endsWith('/')) {
    return prefix
  }

  return `${prefix}/`
}

export async function loadPromptTemplateMarkdown(input: LoadPromptInput): Promise<string> {
  let remotePromptMarkdown: string | null = null

  try {
    remotePromptMarkdown = await readObjectAsText({
      region: input.region,
      bucketName: input.bucketName,
      objectKey: input.promptKey,
    })
  } catch {
    remotePromptMarkdown = null
  }

  return resolvePromptTemplate({
    remotePromptMarkdown,
    fallbackPromptMarkdown: localPromptTemplate,
  })
}

export async function loadDevelopmentGuidesMarkdown(input: LoadGuidesInput): Promise<string[]> {
  const s3Client = createS3Client(input.region)
  const guidesPrefix = normalizeObjectPrefix(input.guidesPrefix)

  const listedObjects = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: input.bucketName,
      Prefix: guidesPrefix,
    }),
  )

  const objectKeys: string[] = []

  for (const objectEntry of listedObjects.Contents ?? []) {
    if (!objectEntry.Key) {
      continue
    }

    if (!objectEntry.Key.endsWith('.md')) {
      continue
    }

    objectKeys.push(objectEntry.Key)
  }

  objectKeys.sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))

  const markdownGuides: string[] = []

  for (const objectKey of objectKeys) {
    const guideContent = await readObjectAsText({
      region: input.region,
      bucketName: input.bucketName,
      objectKey,
    })

    if (guideContent.trim().length === 0) {
      continue
    }

    markdownGuides.push(guideContent)
  }

  return markdownGuides
}

export async function writeWeeklyPlanArtifact(input: WriteArtifactInput): Promise<string> {
  const s3Client = createS3Client(input.region)
  const normalizedPrefix = normalizeObjectPrefix(input.plansPrefix)
  const keyTimestamp = sanitizeTimestampForKey(input.requestedAtIso)
  const objectKey = `${normalizedPrefix}${input.childId}/${keyTimestamp}.md`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: input.bucketName,
      Key: objectKey,
      ContentType: 'text/markdown; charset=utf-8',
      Body: input.markdownContent,
    }),
  )

  return objectKey
}

