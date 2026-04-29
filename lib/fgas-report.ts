import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

export type FgasReportEventType = "INSPECTION" | "LEAK" | "REFILL" | "SERVICE"

export type FgasReportData = {
  year: number
  period: {
    startDate: Date
    endDate: Date
  }
  metrics: {
    totalInstallations: number
    totalRefrigerantAmountKg: number
    totalCo2eTon: number
    requiringInspection: number
    inspectionsPerformed: number
    leakageEvents: number
    refilledAmountKg: number
    serviceEvents: number
  }
  refrigerants: Array<{
    refrigerantType: string
    installationCount: number
    totalAmountKg: number
    totalCo2eTon: number
    refilledAmountKg: number
    leakageEvents: number
  }>
  events: Array<{
    id: string
    date: Date
    installationId: string
    installationName: string
    refrigerantType: string
    type: FgasReportEventType
    refrigerantAddedKg: number | null
    notes: string | null
  }>
}

type RefrigerantSummary = FgasReportData["refrigerants"][number]

const UNKNOWN_REFRIGERANT = "Okänt köldmedium"

export function parseReportYear(value: string | null) {
  const currentYear = new Date().getFullYear()
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return null
  }

  return year
}

export async function getFgasAnnualReport({
  companyId,
  assignedContractorId,
  year,
}: {
  companyId: string
  assignedContractorId?: string
  year: number
}): Promise<FgasReportData> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))
  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      archivedAt: null,
      ...(assignedContractorId ? { assignedContractorId } : {}),
    },
    include: {
      events: {
        where: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      },
      inspections: {
        where: {
          inspectionDate: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          inspectionDate: "desc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  const refrigerantMap = new Map<string, RefrigerantSummary>()
  let totalRefrigerantAmountKg = 0
  let totalCo2eTon = 0
  let requiringInspection = 0
  let inspectionEvents = 0
  let inspectionRecords = 0
  let leakageEvents = 0
  let refilledAmountKg = 0
  let serviceEvents = 0

  const events = installations.flatMap((installation) => {
    const refrigerantType =
      installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )
    const summary = refrigerantMap.get(refrigerantType) ?? {
      refrigerantType,
      installationCount: 0,
      totalAmountKg: 0,
      totalCo2eTon: 0,
      refilledAmountKg: 0,
      leakageEvents: 0,
    }

    summary.installationCount += 1
    summary.totalAmountKg += installation.refrigerantAmount
    summary.totalCo2eTon += compliance.co2eTon
    refrigerantMap.set(refrigerantType, summary)

    totalRefrigerantAmountKg += installation.refrigerantAmount
    totalCo2eTon += compliance.co2eTon
    if (compliance.inspectionIntervalMonths) requiringInspection += 1
    inspectionRecords += installation.inspections.length

    return installation.events.map((event) => {
      const addedAmount = event.refrigerantAddedKg ?? 0

      if (event.type === "INSPECTION") inspectionEvents += 1
      if (event.type === "LEAK") {
        leakageEvents += 1
        summary.leakageEvents += 1
      }
      if (event.type === "REFILL") {
        refilledAmountKg += addedAmount
        summary.refilledAmountKg += addedAmount
      }
      if (event.type === "SERVICE") serviceEvents += 1

      return {
        id: event.id,
        date: event.date,
        installationId: installation.id,
        installationName: installation.name,
        refrigerantType,
        type: event.type as FgasReportEventType,
        refrigerantAddedKg: event.refrigerantAddedKg,
        notes: event.notes,
      }
    })
  })

  return {
    year,
    period: {
      startDate,
      endDate,
    },
    metrics: {
      totalInstallations: installations.length,
      totalRefrigerantAmountKg,
      totalCo2eTon,
      requiringInspection,
      inspectionsPerformed: inspectionEvents + inspectionRecords,
      leakageEvents,
      refilledAmountKg,
      serviceEvents,
    },
    refrigerants: Array.from(refrigerantMap.values()).sort((first, second) =>
      first.refrigerantType.localeCompare(second.refrigerantType, "sv")
    ),
    events: events.sort(
      (first, second) => second.date.getTime() - first.date.getTime()
    ),
  }
}
