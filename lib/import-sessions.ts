import { ImportStatus, ImportType, Prisma } from "@prisma/client"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const ROLLBACK_EDIT_TOLERANCE_MS = 5_000

export type ImportSessionSummary = {
  id: string
  importType: ImportType
  importTypeLabel: string
  status: ImportStatus
  statusLabel: string
  sourceFileName: string | null
  rowsProcessed: number
  rowsImported: number
  rowsSkipped: number
  rowsFailed: number
  createdAt: string
  completedAt: string | null
  rolledBackAt: string | null
  createdBy: {
    name: string
    email: string
  }
  rolledBackBy?: {
    name: string
    email: string
  } | null
  rollback: ImportRollbackEvaluation
}

export type ImportRollbackEvaluation = {
  canRollback: boolean
  blockers: string[]
  affectedCount: number
  importedCount: number
}

export function getImportTypeLabel(type: ImportType) {
  if (type === "PROPERTIES") return "Fastigheter"
  if (type === "INSTALLATIONS") return "Aggregat"
  return "Händelser och historik"
}

export function getImportStatusLabel(status: ImportStatus) {
  if (status === "PROCESSING") return "Bearbetas"
  if (status === "COMPLETED") return "Klar"
  if (status === "FAILED") return "Misslyckad"
  return "Ångrad"
}

export async function createImportSession({
  companyId,
  createdByUserId,
  importType,
  sourceFileName,
}: {
  companyId: string
  createdByUserId: string
  importType: ImportType
  sourceFileName?: string | null
}) {
  return prisma.importSession.create({
    data: {
      companyId,
      createdByUserId,
      importType,
      sourceFileName: normalizeFileName(sourceFileName),
      status: "PROCESSING",
    },
    select: {
      id: true,
    },
  })
}

export async function completeImportSession({
  companyId,
  errorSummary,
  importSessionId,
  rowsFailed,
  rowsImported,
  rowsProcessed,
  rowsSkipped,
  userId,
}: {
  companyId: string
  errorSummary?: string | null
  importSessionId: string
  rowsFailed: number
  rowsImported: number
  rowsProcessed: number
  rowsSkipped: number
  userId: string
}) {
  const session = await prisma.importSession.update({
    where: {
      id: importSessionId,
      companyId,
    },
    data: {
      completedAt: new Date(),
      errorSummary: errorSummary ?? null,
      rowsFailed,
      rowsImported,
      rowsProcessed,
      rowsSkipped,
      status: "COMPLETED",
    },
    select: {
      id: true,
      importType: true,
    },
  })

  await logActivity({
    action: "import_completed",
    companyId,
    entityId: importSessionId,
    entityType: "IMPORT_SESSION",
    metadata: {
      importType: session.importType,
      rowsFailed,
      rowsImported,
      rowsProcessed,
      rowsSkipped,
    },
    userId,
  })
}

export async function failImportSession({
  companyId,
  errorSummary,
  importSessionId,
  rowsFailed,
  rowsImported,
  rowsProcessed,
  rowsSkipped,
}: {
  companyId: string
  errorSummary: string
  importSessionId: string
  rowsFailed: number
  rowsImported: number
  rowsProcessed: number
  rowsSkipped: number
}) {
  await prisma.importSession.update({
    where: {
      id: importSessionId,
      companyId,
    },
    data: {
      completedAt: new Date(),
      errorSummary: errorSummary.slice(0, 500),
      rowsFailed,
      rowsImported,
      rowsProcessed,
      rowsSkipped,
      status: "FAILED",
    },
  })
}

export async function getImportSessionForCompany(id: string, companyId: string) {
  return prisma.importSession.findFirst({
    where: {
      id,
      companyId,
    },
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
      rolledBackBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  })
}

export async function listImportSessions(companyId: string, limit = 50) {
  const sessions = await prisma.importSession.findMany({
    where: {
      companyId,
    },
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
      rolledBackBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.min(Math.max(limit, 1), 100),
  })

  return Promise.all(sessions.map(toImportSessionSummary))
}

export async function toImportSessionSummary(
  session: Awaited<ReturnType<typeof getImportSessionForCompany>>
): Promise<ImportSessionSummary> {
  if (!session) throw new Error("Import session missing")

  const rollback = await evaluateImportRollback(session.id, session.companyId)

  return {
    id: session.id,
    importType: session.importType,
    importTypeLabel: getImportTypeLabel(session.importType),
    status: session.status,
    statusLabel: getImportStatusLabel(session.status),
    sourceFileName: session.sourceFileName,
    rowsProcessed: session.rowsProcessed,
    rowsImported: session.rowsImported,
    rowsSkipped: session.rowsSkipped,
    rowsFailed: session.rowsFailed,
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    rolledBackAt: session.rolledBackAt?.toISOString() ?? null,
    createdBy: {
      email: session.createdBy.email,
      name: session.createdBy.name,
    },
    rolledBackBy: session.rolledBackBy
      ? {
          email: session.rolledBackBy.email,
          name: session.rolledBackBy.name,
        }
      : null,
    rollback,
  }
}

export async function evaluateImportRollback(
  importSessionId: string,
  companyId: string
): Promise<ImportRollbackEvaluation> {
  const session = await prisma.importSession.findFirst({
    where: {
      id: importSessionId,
      companyId,
    },
    select: {
      completedAt: true,
      importType: true,
      status: true,
    },
  })

  if (!session) {
    return {
      affectedCount: 0,
      blockers: ["Importen hittades inte."],
      canRollback: false,
      importedCount: 0,
    }
  }

  if (session.status === "ROLLED_BACK") {
    return {
      affectedCount: 0,
      blockers: ["Importen är redan ångrad."],
      canRollback: false,
      importedCount: 0,
    }
  }

  if (session.status !== "COMPLETED" || !session.completedAt) {
    return {
      affectedCount: 0,
      blockers: ["Endast slutförda importer kan ångras."],
      canRollback: false,
      importedCount: 0,
    }
  }

  if (session.importType === "PROPERTIES") {
    return evaluatePropertyImportRollback(importSessionId, companyId, session.completedAt)
  }

  if (session.importType === "INSTALLATIONS") {
    return evaluateInstallationImportRollback(importSessionId, companyId, session.completedAt)
  }

  return evaluateEventImportRollback(importSessionId, companyId)
}

export async function rollbackImportSession({
  companyId,
  importSessionId,
  userId,
}: {
  companyId: string
  importSessionId: string
  userId: string
}) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: importSessionId,
      companyId,
    },
    select: {
      id: true,
      importType: true,
      status: true,
    },
  })

  if (!session) return null

  if (session.status === "ROLLED_BACK") {
    return {
      alreadyRolledBack: true,
      rolledBack: false,
      rollback: await evaluateImportRollback(importSessionId, companyId),
    }
  }

  const rollback = await evaluateImportRollback(importSessionId, companyId)
  if (!rollback.canRollback) {
    return {
      alreadyRolledBack: false,
      rolledBack: false,
      rollback,
    }
  }

  await prisma.$transaction(async (tx) => {
    if (session.importType === "PROPERTIES") {
      await tx.property.deleteMany({
        where: {
          companyId,
          importSessionId,
        },
      })
    } else if (session.importType === "INSTALLATIONS") {
      await tx.installation.deleteMany({
        where: {
          companyId,
          importSessionId,
        },
      })
    } else {
      await tx.installationEvent.deleteMany({
        where: {
          importSessionId,
          installation: {
            companyId,
          },
        },
      })
    }

    await tx.importSession.update({
      where: {
        id: importSessionId,
        companyId,
      },
      data: {
        rolledBackAt: new Date(),
        rolledBackByUserId: userId,
        status: "ROLLED_BACK",
      },
    })
  })

  await logActivity({
    action: "import_rolled_back",
    companyId,
    entityId: importSessionId,
    entityType: "IMPORT_SESSION",
    metadata: {
      affectedCount: rollback.affectedCount,
      importType: session.importType,
    },
    userId,
  })

  return {
    alreadyRolledBack: false,
    rolledBack: true,
    rollback: {
      ...rollback,
      canRollback: false,
      blockers: ["Importen är ångrad."],
    },
  }
}

async function evaluatePropertyImportRollback(
  importSessionId: string,
  companyId: string,
  completedAt: Date
): Promise<ImportRollbackEvaluation> {
  const properties = await prisma.property.findMany({
    where: {
      companyId,
      importSessionId,
    },
    select: {
      id: true,
      updatedAt: true,
      _count: {
        select: {
          installations: true,
        },
      },
    },
  })
  const propertyIds = properties.map((property) => property.id)
  const blockers: string[] = []
  const linkedInstallationCount = properties.filter(
    (property) => property._count.installations > 0
  ).length
  const editedCount = properties.filter((property) =>
    wasEditedAfterImport(property.updatedAt, completedAt)
  ).length

  if (linkedInstallationCount > 0) {
    blockers.push(
      `Importen kan inte ångras eftersom ${linkedInstallationCount} importerade fastigheter har kopplade aggregat.`
    )
  }

  if (editedCount > 0) {
    blockers.push(
      `Importen kan inte ångras eftersom ${editedCount} importerade fastigheter har ändrats efter importen.`
    )
  }

  if (propertyIds.length > 0) {
    const [signedAnnualReports, signedArtifacts] = await Promise.all([
      prisma.signedAnnualFgasReport.count({
        where: {
          companyId,
          propertyId: {
            in: propertyIds,
          },
        },
      }),
      prisma.signedReportArtifact.count({
        where: {
          companyId,
          scopeType: "PROPERTY",
          scopeId: {
            in: propertyIds,
          },
          status: {
            not: "DELETED",
          },
        },
      }),
    ])

    if (signedAnnualReports + signedArtifacts > 0) {
      blockers.push(
        "Importen kan inte ångras eftersom importerade fastigheter används i signerade rapporter."
      )
    }
  }

  return {
    affectedCount: properties.length,
    blockers,
    canRollback: properties.length > 0 && blockers.length === 0,
    importedCount: properties.length,
  }
}

async function evaluateInstallationImportRollback(
  importSessionId: string,
  companyId: string,
  completedAt: Date
): Promise<ImportRollbackEvaluation> {
  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      importSessionId,
    },
    select: {
      id: true,
      updatedAt: true,
      scrappedAt: true,
      assignedContractorId: true,
      assignedServicePartnerCompanyId: true,
      _count: {
        select: {
          activityLogs: true,
          documents: true,
          events: true,
          inspections: true,
          reminderLogs: true,
        },
      },
    },
  })
  const blockers: string[] = []
  const editedCount = installations.filter((installation) =>
    wasEditedAfterImport(installation.updatedAt, completedAt)
  ).length
  const eventCount = installations.filter((installation) => installation._count.events > 0).length
  const inspectionCount = installations.filter(
    (installation) => installation._count.inspections > 0
  ).length
  const documentCount = installations.filter(
    (installation) => installation._count.documents > 0
  ).length
  const reminderCount = installations.filter(
    (installation) => installation._count.reminderLogs > 0
  ).length
  const activityCount = installations.filter(
    (installation) => installation._count.activityLogs > 0
  ).length
  const assignedCount = installations.filter(
    (installation) =>
      installation.assignedContractorId ||
      installation.assignedServicePartnerCompanyId ||
      installation.scrappedAt
  ).length

  if (editedCount > 0) {
    blockers.push(
      `Importen kan inte ångras eftersom ${editedCount} importerade aggregat har ändrats efter importen.`
    )
  }

  if (eventCount > 0 || inspectionCount > 0 || documentCount > 0 || reminderCount > 0) {
    blockers.push(
      "Importen kan inte ångras eftersom importerade aggregat har fått händelser, kontroller, dokument eller påminnelser."
    )
  }

  if (activityCount > 0 || assignedCount > 0) {
    blockers.push(
      "Importen kan inte ångras eftersom importerade aggregat har börjat användas i drift eller serviceflöden."
    )
  }

  return {
    affectedCount: installations.length,
    blockers,
    canRollback: installations.length > 0 && blockers.length === 0,
    importedCount: installations.length,
  }
}

async function evaluateEventImportRollback(
  importSessionId: string,
  companyId: string
): Promise<ImportRollbackEvaluation> {
  const events = await prisma.installationEvent.findMany({
    where: {
      importSessionId,
      installation: {
        companyId,
      },
    },
    select: {
      supersededAt: true,
      type: true,
      _count: {
        select: {
          documents: true,
        },
      },
    },
  })
  const blockers: string[] = []
  const documentCount = events.filter((event) => event._count.documents > 0).length
  const sideEffectCount = events.filter(
    (event) => event.type === "INSPECTION" || event.type === "REFRIGERANT_CHANGE"
  ).length
  const supersededCount = events.filter((event) => event.supersededAt).length

  if (documentCount > 0) {
    blockers.push(
      `Importen kan inte ångras eftersom ${documentCount} importerade händelser har dokument.`
    )
  }

  if (sideEffectCount > 0) {
    blockers.push(
      "Importen kan inte ångras automatiskt eftersom importerade kontroller eller köldmediebyten har uppdaterat aggregatets historik."
    )
  }

  if (supersededCount > 0) {
    blockers.push(
      "Importen kan inte ångras eftersom importerade händelser har ersatts eller korrigerats."
    )
  }

  return {
    affectedCount: events.length,
    blockers,
    canRollback: events.length > 0 && blockers.length === 0,
    importedCount: events.length,
  }
}

function normalizeFileName(fileName?: string | null) {
  const trimmed = fileName?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 255)
}

function wasEditedAfterImport(updatedAt: Date, completedAt: Date) {
  return updatedAt.getTime() > completedAt.getTime() + ROLLBACK_EDIT_TOLERANCE_MS
}

export type ImportSessionTx = Prisma.TransactionClient
