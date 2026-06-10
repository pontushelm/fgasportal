import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildDigestRecipientKey,
  getLatestDigest,
  normalizeDigestDate,
  recordDigestSent,
  shouldSendDigest,
} from "@/lib/notifications/digest-log"

const notificationDigestLogFindFirst = vi.fn()
const notificationDigestLogFindUnique = vi.fn()
const notificationDigestLogUpsert = vi.fn()

const prisma = {
  notificationDigestLog: {
    findFirst: notificationDigestLogFindFirst,
    findUnique: notificationDigestLogFindUnique,
    upsert: notificationDigestLogUpsert,
  },
}

describe("notification digest delivery logs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationDigestLogFindFirst.mockResolvedValue(null)
    notificationDigestLogFindUnique.mockResolvedValue(null)
    notificationDigestLogUpsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: "digest-log-1", ...create })
    )
  })

  it("prevents duplicate daily digest sends for the same recipient and date", async () => {
    notificationDigestLogFindUnique.mockResolvedValueOnce({ id: "existing-log" })

    const result = await shouldSendDigest({
      companyId: "company-1",
      digestDate: new Date("2026-06-10T13:45:00.000Z"),
      digestType: "DAILY",
      prisma,
      userId: "user-1",
    })

    expect(result).toBe(false)
    expect(notificationDigestLogFindUnique).toHaveBeenCalledWith({
      where: {
        companyId_recipientKey_digestDate_digestType: {
          companyId: "company-1",
          digestDate: new Date("2026-06-10T00:00:00.000Z"),
          digestType: "DAILY",
          recipientKey: "user:user-1",
        },
      },
      select: {
        id: true,
      },
    })
  })

  it("allows a different day", async () => {
    await shouldSendDigest({
      companyId: "company-1",
      digestDate: new Date("2026-06-11T08:00:00.000Z"),
      digestType: "DAILY",
      prisma,
      userId: "user-1",
    })

    expect(notificationDigestLogFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_recipientKey_digestDate_digestType: expect.objectContaining({
            digestDate: new Date("2026-06-11T00:00:00.000Z"),
          }),
        },
      })
    )
  })

  it("allows a different digest type", async () => {
    await shouldSendDigest({
      companyId: "company-1",
      digestDate: new Date("2026-06-10T08:00:00.000Z"),
      digestType: "WEEKLY",
      prisma,
      userId: "user-1",
    })

    expect(notificationDigestLogFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_recipientKey_digestDate_digestType: expect.objectContaining({
            digestType: "WEEKLY",
          }),
        },
      })
    )
  })

  it("records digest delivery idempotently using the unique recipient key", async () => {
    const result = await recordDigestSent({
      companyId: "company-1",
      digestDate: new Date("2026-06-10T08:00:00.000Z"),
      digestType: "DAILY",
      prisma,
      sentAt: new Date("2026-06-10T08:00:00.000Z"),
      totalItems: 7,
      userId: "user-1",
    })

    expect(result).toMatchObject({
      companyId: "company-1",
      digestType: "DAILY",
      totalItems: 7,
      userId: "user-1",
    })
    expect(notificationDigestLogUpsert).toHaveBeenCalledWith({
      where: {
        companyId_recipientKey_digestDate_digestType: {
          companyId: "company-1",
          digestDate: new Date("2026-06-10T00:00:00.000Z"),
          digestType: "DAILY",
          recipientKey: "user:user-1",
        },
      },
      create: expect.objectContaining({
        companyId: "company-1",
        recipientKey: "user:user-1",
        totalItems: 7,
      }),
      update: {},
    })
  })

  it("retrieves the latest digest for a user recipient", async () => {
    notificationDigestLogFindFirst.mockResolvedValueOnce({
      id: "latest-log",
      sentAt: new Date("2026-06-10T08:00:00.000Z"),
    })

    const result = await getLatestDigest({
      companyId: "company-1",
      prisma,
      userId: "user-1",
    })

    expect(result).toMatchObject({ id: "latest-log" })
    expect(notificationDigestLogFindFirst).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        recipientKey: "user:user-1",
      },
      orderBy: {
        sentAt: "desc",
      },
    })
  })

  it("keeps company and user recipient keys isolated", () => {
    expect(buildDigestRecipientKey({ companyId: "company-1", userId: "user-1" })).toBe(
      "user:user-1"
    )
    expect(buildDigestRecipientKey({ companyId: "company-1", userId: null })).toBe(
      "company:company-1"
    )
    expect(normalizeDigestDate(new Date("2026-06-10T23:59:00.000Z"))).toEqual(
      new Date("2026-06-10T00:00:00.000Z")
    )
  })

  it("keeps company isolation in latest digest lookup", async () => {
    await getLatestDigest({
      companyId: "company-2",
      digestType: "DAILY",
      prisma,
      userId: "user-1",
    })

    expect(notificationDigestLogFindFirst).toHaveBeenCalledWith({
      where: {
        companyId: "company-2",
        digestType: "DAILY",
        recipientKey: "user:user-1",
      },
      orderBy: {
        sentAt: "desc",
      },
    })
  })
})
