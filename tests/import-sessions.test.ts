import { beforeEach, describe, expect, it, vi } from "vitest"

const logActivity = vi.fn()
const importSessionCreate = vi.fn()
const importSessionFindFirst = vi.fn()
const importSessionFindMany = vi.fn()
const importSessionUpdate = vi.fn()
const propertyDeleteMany = vi.fn()
const propertyFindMany = vi.fn()
const signedAnnualFgasReportCount = vi.fn()
const signedReportArtifactCount = vi.fn()
const installationDeleteMany = vi.fn()
const installationFindMany = vi.fn()
const installationEventDeleteMany = vi.fn()
const installationEventFindMany = vi.fn()
const transaction = vi.fn()

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    importSession: {
      create: importSessionCreate,
      findFirst: importSessionFindFirst,
      findMany: importSessionFindMany,
      update: importSessionUpdate,
    },
    installation: {
      deleteMany: installationDeleteMany,
      findMany: installationFindMany,
    },
    installationEvent: {
      deleteMany: installationEventDeleteMany,
      findMany: installationEventFindMany,
    },
    property: {
      deleteMany: propertyDeleteMany,
      findMany: propertyFindMany,
    },
    signedAnnualFgasReport: {
      count: signedAnnualFgasReportCount,
    },
    signedReportArtifact: {
      count: signedReportArtifactCount,
    },
  },
}))

describe("import sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    logActivity.mockResolvedValue("activity-1")
    transaction.mockImplementation(async (callback) =>
      callback({
        importSession: {
          update: importSessionUpdate,
        },
        installation: {
          deleteMany: installationDeleteMany,
        },
        installationEvent: {
          deleteMany: installationEventDeleteMany,
        },
        property: {
          deleteMany: propertyDeleteMany,
        },
      })
    )
  })

  it("creates a processing import session with normalized file name", async () => {
    const { createImportSession } = await import("@/lib/import-sessions")
    importSessionCreate.mockResolvedValueOnce({ id: "session-1" })

    await createImportSession({
      companyId: "company-1",
      createdByUserId: "user-1",
      importType: "PROPERTIES",
      sourceFileName: " properties.xlsx ",
    })

    expect(importSessionCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        createdByUserId: "user-1",
        importType: "PROPERTIES",
        sourceFileName: "properties.xlsx",
        status: "PROCESSING",
      },
      select: {
        id: true,
      },
    })
  })

  it("returns friendly import type and status labels", async () => {
    const { getImportStatusLabel, getImportTypeLabel } = await import(
      "@/lib/import-sessions"
    )

    expect(getImportTypeLabel("PROPERTIES")).toBe("Fastigheter")
    expect(getImportTypeLabel("INSTALLATIONS")).toBe("Aggregat")
    expect(getImportTypeLabel("INSTALLATION_EVENTS")).toBe(
      "Händelser och historik"
    )
    expect(getImportStatusLabel("ROLLED_BACK")).toBe("Ångrad")
  })

  it("blocks property rollback when imported properties have installations", async () => {
    const { evaluateImportRollback } = await import("@/lib/import-sessions")
    importSessionFindFirst.mockResolvedValueOnce(completedSession("PROPERTIES"))
    propertyFindMany.mockResolvedValueOnce([
      propertyRow("property-1", 2, completedAt),
    ])
    signedAnnualFgasReportCount.mockResolvedValueOnce(0)
    signedReportArtifactCount.mockResolvedValueOnce(0)

    const rollback = await evaluateImportRollback("session-1", "company-1")

    expect(rollback.canRollback).toBe(false)
    expect(rollback.blockers.join(" ")).toContain("kopplade aggregat")
    expect(propertyDeleteMany).not.toHaveBeenCalled()
  })

  it("rolls back safe property imports without deleting the session", async () => {
    const { rollbackImportSession } = await import("@/lib/import-sessions")
    importSessionFindFirst
      .mockResolvedValueOnce({
        id: "session-1",
        importType: "PROPERTIES",
        status: "COMPLETED",
      })
      .mockResolvedValueOnce(completedSession("PROPERTIES"))
    propertyFindMany.mockResolvedValueOnce([
      propertyRow("property-1", 0, completedAt),
      propertyRow("property-2", 0, completedAt),
    ])
    signedAnnualFgasReportCount.mockResolvedValueOnce(0)
    signedReportArtifactCount.mockResolvedValueOnce(0)

    const result = await rollbackImportSession({
      companyId: "company-1",
      importSessionId: "session-1",
      userId: "owner-1",
    })

    expect(result?.rolledBack).toBe(true)
    expect(propertyDeleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        importSessionId: "session-1",
      },
    })
    expect(importSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rolledBackByUserId: "owner-1",
          status: "ROLLED_BACK",
        }),
      })
    )
  })

  it("treats repeated rollback as idempotent", async () => {
    const { rollbackImportSession } = await import("@/lib/import-sessions")
    importSessionFindFirst
      .mockResolvedValueOnce({
        id: "session-1",
        importType: "PROPERTIES",
        status: "ROLLED_BACK",
      })
      .mockResolvedValueOnce({
        completedAt,
        importType: "PROPERTIES",
        status: "ROLLED_BACK",
      })

    const result = await rollbackImportSession({
      companyId: "company-1",
      importSessionId: "session-1",
      userId: "owner-1",
    })

    expect(result?.alreadyRolledBack).toBe(true)
    expect(propertyDeleteMany).not.toHaveBeenCalled()
  })

  it("blocks installation rollback when imported aggregat have business history", async () => {
    const { evaluateImportRollback } = await import("@/lib/import-sessions")
    importSessionFindFirst.mockResolvedValueOnce(completedSession("INSTALLATIONS"))
    installationFindMany.mockResolvedValueOnce([
      installationRow({ documents: 1, events: 1 }),
    ])

    const rollback = await evaluateImportRollback("session-1", "company-1")

    expect(rollback.canRollback).toBe(false)
    expect(rollback.blockers.join(" ")).toContain("händelser")
  })

  it("rolls back safe event imports without deleting parent installations", async () => {
    const { rollbackImportSession } = await import("@/lib/import-sessions")
    importSessionFindFirst
      .mockResolvedValueOnce({
        id: "session-1",
        importType: "INSTALLATION_EVENTS",
        status: "COMPLETED",
      })
      .mockResolvedValueOnce(completedSession("INSTALLATION_EVENTS"))
    installationEventFindMany.mockResolvedValueOnce([
      eventRow("LEAK"),
      eventRow("SERVICE"),
    ])

    const result = await rollbackImportSession({
      companyId: "company-1",
      importSessionId: "session-1",
      userId: "owner-1",
    })

    expect(result?.rolledBack).toBe(true)
    expect(installationEventDeleteMany).toHaveBeenCalledWith({
      where: {
        importSessionId: "session-1",
        installation: {
          companyId: "company-1",
        },
      },
    })
    expect(installationDeleteMany).not.toHaveBeenCalled()
  })

  it("blocks event rollback for inspection side effects", async () => {
    const { evaluateImportRollback } = await import("@/lib/import-sessions")
    importSessionFindFirst.mockResolvedValueOnce(
      completedSession("INSTALLATION_EVENTS")
    )
    installationEventFindMany.mockResolvedValueOnce([eventRow("INSPECTION")])

    const rollback = await evaluateImportRollback("session-1", "company-1")

    expect(rollback.canRollback).toBe(false)
    expect(rollback.blockers.join(" ")).toContain("kontroller")
  })
})

const completedAt = new Date("2026-01-01T10:00:00.000Z")

function completedSession(importType: string) {
  return {
    completedAt,
    importType,
    status: "COMPLETED",
  }
}

function propertyRow(id: string, installations: number, updatedAt: Date) {
  return {
    id,
    updatedAt,
    _count: {
      installations,
    },
  }
}

function installationRow({
  activityLogs = 0,
  documents = 0,
  events = 0,
  inspections = 0,
  reminderLogs = 0,
}: {
  activityLogs?: number
  documents?: number
  events?: number
  inspections?: number
  reminderLogs?: number
}) {
  return {
    assignedContractorId: null,
    assignedServicePartnerCompanyId: null,
    id: "installation-1",
    scrappedAt: null,
    updatedAt: completedAt,
    _count: {
      activityLogs,
      documents,
      events,
      inspections,
      reminderLogs,
    },
  }
}

function eventRow(type: string) {
  return {
    supersededAt: null,
    type,
    _count: {
      documents: 0,
    },
  }
}
