import { generateDashboardActions } from "@/lib/actions/generate-actions"
import type { AuthenticatedUser } from "@/lib/auth"
import { isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateInstallationRisk } from "@/lib/risk-classification"

export async function loadDashboardActions(user: AuthenticatedUser) {
  const installations = await prisma.installation.findMany({
    where: {
      companyId: user.companyId,
      archivedAt: null,
      scrappedAt: null,
      ...(isContractor(user) ? { assignedContractorId: user.userId } : {}),
    },
    include: {
      events: {
        where: {
          type: "LEAK",
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
    },
  })

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
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany ?? null

    return {
      id: installation.id,
      name: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      nextInspection: installation.nextInspection,
      inspectionInterval: compliance.inspectionIntervalMonths,
      complianceStatus: compliance.status,
      assignedContractorId: installation.assignedContractorId,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      risk,
    }
  })

  const leakageEvents = installations.flatMap((installation) =>
    installation.events.map((event) => ({
      id: event.id,
      installationId: installation.id,
      installationName: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId:
        installation.assignedContractor?.memberships[0]?.servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName:
        installation.assignedContractor?.memberships[0]?.servicePartnerCompany?.name ?? null,
      date: event.date,
    }))
  )

  return generateDashboardActions({
    installations: actionInstallations,
    leakageEvents,
  })
}
