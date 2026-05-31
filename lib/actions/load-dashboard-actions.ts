import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { getInstallationAccessWhereClause } from "@/lib/access/installation-access"
import type { AuthenticatedUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateInstallationRisk } from "@/lib/risk-classification"

export async function loadDashboardActions(user: AuthenticatedUser) {
  const queryStartTime = getDevelopmentTimingStart()
  const installations = await prisma.installation.findMany({
    where: {
      AND: [
        getInstallationAccessWhereClause(user),
        {
          archivedAt: null,
          scrappedAt: null,
        },
      ],
    },
    select: {
      id: true,
      name: true,
      equipmentId: true,
      propertyName: true,
      nextInspection: true,
      refrigerantType: true,
      refrigerantAmount: true,
      hasLeakDetectionSystem: true,
      lastInspection: true,
      assignedContractorId: true,
      events: {
        where: {
          type: "LEAK",
          supersededAt: null,
        },
        select: {
          id: true,
          date: true,
        },
        orderBy: {
          date: "desc",
        },
      },
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedContractor: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            where: {
              companyId: user.companyId,
              role: "CONTRACTOR",
              isActive: true,
            },
            select: {
              servicePartnerCompany: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: 1,
          },
        },
      },
      assignedServicePartnerCompany: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
  logDevelopmentTiming("loadDashboardActions installation query", queryStartTime)

  const generationStartTime = getDevelopmentTimingStart()
  const actionInstallations = installations.map((installation) => {
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )
    const risk = calculateInstallationRisk({
      refrigerantType: installation.refrigerantType,
      refrigerantAmount: installation.refrigerantAmount,
      gwp: compliance.gwp,
      hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
      leakageEventsCount: installation.events.length,
      isInspectionOverdue: compliance.status === "OVERDUE",
    })
    const servicePartnerCompany =
      installation.assignedServicePartnerCompany ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany ??
      null

    return {
      id: installation.id,
      name: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      nextInspection: installation.nextInspection,
      inspectionInterval: compliance.inspectionIntervalMonths,
      complianceStatus: compliance.status,
      refrigerantType: installation.refrigerantType,
      refrigerantAmount: installation.refrigerantAmount,
      assignedContractorId: installation.assignedContractorId,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      risk,
    }
  })

  const leakageEvents = installations.flatMap((installation) => {
    const servicePartnerCompany =
      installation.assignedServicePartnerCompany ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany ??
      null

    return installation.events.map((event) => ({
      id: event.id,
      installationId: installation.id,
      installationName: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      date: event.date,
    }))
  })

  const actions = generateDashboardActions({
    installations: actionInstallations,
    leakageEvents,
  })
  logDevelopmentTiming("loadDashboardActions action generation", generationStartTime)

  return actions
}

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}
