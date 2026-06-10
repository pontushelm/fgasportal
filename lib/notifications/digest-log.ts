import type { NotificationDigestType, PrismaClient } from "@prisma/client"

type DigestLogFindUniqueClient = {
  notificationDigestLog: Pick<
    PrismaClient["notificationDigestLog"],
    "findUnique"
  >
}

export type DigestLogClient = {
  notificationDigestLog: Pick<
    PrismaClient["notificationDigestLog"],
    "findFirst" | "findUnique" | "upsert"
  >
}

export type DigestLogRecipient = {
  companyId: string
  userId?: string | null
}

export type DigestLogInput = DigestLogRecipient & {
  digestDate?: Date
  digestType: NotificationDigestType
}

export type RecordDigestSentInput = DigestLogInput & {
  sentAt?: Date
  totalItems: number
}

export async function shouldSendDigest({
  companyId,
  digestDate = new Date(),
  digestType,
  prisma,
  userId = null,
}: DigestLogInput & { prisma: DigestLogFindUniqueClient }) {
  const existing = await prisma.notificationDigestLog.findUnique({
    where: {
      companyId_recipientKey_digestDate_digestType: {
        companyId,
        digestDate: normalizeDigestDate(digestDate),
        digestType,
        recipientKey: buildDigestRecipientKey({ companyId, userId }),
      },
    },
    select: {
      id: true,
    },
  })

  return !existing
}

export async function recordDigestSent({
  companyId,
  digestDate = new Date(),
  digestType,
  prisma,
  sentAt = new Date(),
  totalItems,
  userId = null,
}: RecordDigestSentInput & { prisma: DigestLogClient }) {
  const normalizedDigestDate = normalizeDigestDate(digestDate)
  const recipientKey = buildDigestRecipientKey({ companyId, userId })

  return prisma.notificationDigestLog.upsert({
    where: {
      companyId_recipientKey_digestDate_digestType: {
        companyId,
        digestDate: normalizedDigestDate,
        digestType,
        recipientKey,
      },
    },
    create: {
      companyId,
      digestDate: normalizedDigestDate,
      digestType,
      recipientKey,
      sentAt,
      totalItems,
      userId,
    },
    update: {},
  })
}

export async function getLatestDigest({
  companyId,
  digestType,
  prisma,
  userId,
}: DigestLogRecipient & {
  digestType?: NotificationDigestType
  prisma: DigestLogClient
}) {
  return prisma.notificationDigestLog.findFirst({
    where: {
      companyId,
      ...(digestType ? { digestType } : {}),
      ...(userId === undefined
        ? {}
        : {
            recipientKey: buildDigestRecipientKey({ companyId, userId }),
          }),
    },
    orderBy: {
      sentAt: "desc",
    },
  })
}

export function buildDigestRecipientKey({
  companyId,
  userId,
}: DigestLogRecipient) {
  return userId ? `user:${userId}` : `company:${companyId}`
}

export function normalizeDigestDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
