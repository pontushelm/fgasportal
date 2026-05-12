import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { authenticateApiRequest, forbiddenResponse, isAdmin, isContractor } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { calculateInstallationRisk } from "@/lib/risk-classification"
import { buildServicePartnerCompanyMetrics } from "@/lib/service-partner-company-metrics"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const servicePartnerCompanySchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(160),
  organizationNumber: optionalText(40),
  contactEmail: z.string().trim().email("Ogiltig e-postadress").optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  notes: optionalText(1000),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (isContractor(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(currentYear, 0, 1))
    const nextYearStart = new Date(Date.UTC(currentYear + 1, 0, 1))

    const servicePartnerCompany = await prisma.servicePartnerCompany.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        organizationNumber: true,
        contactEmail: true,
        phone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: {
            companyId: auth.user.companyId,
            role: "CONTRACTOR",
            isActive: true,
            user: {
              isActive: true,
            },
          },
          select: {
            id: true,
            isCertifiedCompany: true,
            certificationNumber: true,
            certificationOrganization: true,
            certificationValidUntil: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                assignedInstallations: {
                  where: {
                    companyId: auth.user.companyId,
                    archivedAt: null,
                    scrappedAt: null,
                  },
                  include: {
                    property: {
                      select: {
                        name: true,
                      },
                    },
                    events: {
                      where: {
                        type: "LEAK",
                        date: {
                          gte: yearStart,
                          lt: nextYearStart,
                        },
                      },
                      select: {
                        id: true,
                        date: true,
                      },
                    },
                    activityLogs: {
                      orderBy: {
                        createdAt: "desc",
                      },
                      select: {
                        createdAt: true,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            user: {
              name: "asc",
            },
          },
        },
      },
    })

    if (!servicePartnerCompany) {
      return NextResponse.json(
        { error: "Serviceföretaget hittades inte" },
        { status: 404 }
      )
    }

    const contractors = servicePartnerCompany.memberships.map((membership) => {
      let overdueInspections = 0
      let dueSoonInspections = 0
      let highRiskInstallations = 0
      let leakageEventsCount = 0
      let latestActivityDate: Date | null = null

      membership.user.assignedInstallations.forEach((installation) => {
        const compliance = calculateInstallationCompliance(
          installation.refrigerantType,
          installation.refrigerantAmount,
          installation.hasLeakDetectionSystem,
          installation.lastInspection,
          installation.nextInspection
        )

        if (compliance.status === "OVERDUE") overdueInspections += 1
        if (compliance.status === "DUE_SOON") dueSoonInspections += 1

        const installationLeakageEventsCount = installation.events.length
        leakageEventsCount += installationLeakageEventsCount

        const risk = calculateInstallationRisk({
          refrigerantType: installation.refrigerantType,
          refrigerantAmount: installation.refrigerantAmount,
          gwp: compliance.gwp,
          hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
          leakageEventsCount: installationLeakageEventsCount,
          isInspectionOverdue: compliance.status === "OVERDUE",
        })

        if (risk.level === "HIGH") highRiskInstallations += 1

        const latestInstallationActivity = installation.activityLogs[0]?.createdAt
        if (
          latestInstallationActivity &&
          (!latestActivityDate || latestInstallationActivity > latestActivityDate)
        ) {
          latestActivityDate = latestInstallationActivity
        }
      })

      const certificationStatus = getCertificationStatus({
        isCertifiedCompany: membership.isCertifiedCompany,
        validUntil: membership.certificationValidUntil,
      })

      return {
        id: membership.user.id,
        membershipId: membership.id,
        name: membership.user.name,
        email: membership.user.email,
        isCertifiedCompany: membership.isCertifiedCompany,
        certificationNumber: membership.certificationNumber,
        certificationOrganization: membership.certificationOrganization,
        certificationValidUntil: membership.certificationValidUntil,
        certificationStatus,
        servicePartnerCompany: {
          id: servicePartnerCompany.id,
          name: servicePartnerCompany.name,
          organizationNumber: servicePartnerCompany.organizationNumber,
          contactEmail: servicePartnerCompany.contactEmail,
          phone: servicePartnerCompany.phone,
          notes: servicePartnerCompany.notes,
        },
        assignedInstallationsCount: membership.user.assignedInstallations.length,
        overdueInspections,
        dueSoonInspections,
        highRiskInstallations,
        leakageEventsCount,
        latestActivityDate,
      }
    })

    const installations = servicePartnerCompany.memberships
      .flatMap((membership) =>
        membership.user.assignedInstallations.map((installation) => {
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

          return {
            id: installation.id,
            name: installation.name,
            equipmentId: installation.equipmentId,
            propertyName: installation.property?.name ?? installation.propertyName,
            refrigerantType: installation.refrigerantType,
            refrigerantAmount: installation.refrigerantAmount,
            nextInspection: installation.nextInspection,
            complianceStatus: compliance.status,
            riskLevel: risk.level,
            assignedContractor: {
              id: membership.user.id,
              name: membership.user.name,
              email: membership.user.email,
            },
            leakageEventsCount: installation.events.length,
            latestActivityDate: installation.activityLogs[0]?.createdAt ?? null,
          }
        })
      )
      .sort((first, second) => first.name.localeCompare(second.name, "sv"))
    const actionInstallations = servicePartnerCompany.memberships.flatMap((membership) =>
      membership.user.assignedInstallations.map((installation) => {
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

        return {
          id: installation.id,
          name: installation.name,
          equipmentId: installation.equipmentId,
          propertyName: installation.property?.name ?? installation.propertyName,
          nextInspection: installation.nextInspection,
          inspectionInterval: compliance.inspectionIntervalMonths,
          complianceStatus: compliance.status,
          assignedContractorId: membership.user.id,
          assignedServiceContactId: membership.user.id,
          assignedServiceContactName: membership.user.name,
          assignedServiceContactEmail: membership.user.email,
          servicePartnerCompanyId: servicePartnerCompany.id,
          servicePartnerCompanyName: servicePartnerCompany.name,
          risk,
        }
      })
    )
    const actionLeakageEvents = servicePartnerCompany.memberships.flatMap((membership) =>
      membership.user.assignedInstallations.flatMap((installation) =>
        installation.events.map((event) => ({
          id: event.id,
          installationId: installation.id,
          installationName: installation.name,
          equipmentId: installation.equipmentId,
          propertyName: installation.property?.name ?? installation.propertyName,
          assignedServiceContactId: membership.user.id,
          assignedServiceContactName: membership.user.name,
          assignedServiceContactEmail: membership.user.email,
          servicePartnerCompanyId: servicePartnerCompany.id,
          servicePartnerCompanyName: servicePartnerCompany.name,
          date: event.date,
        }))
      )
    )
    const actions = generateDashboardActions({
      installations: actionInstallations,
      leakageEvents: actionLeakageEvents,
    })

    const [metrics] = buildServicePartnerCompanyMetrics({
      companies: [servicePartnerCompany],
      contractors,
    })

    return NextResponse.json(
      {
        company: {
          id: servicePartnerCompany.id,
          name: servicePartnerCompany.name,
          organizationNumber: servicePartnerCompany.organizationNumber,
          contactEmail: servicePartnerCompany.contactEmail,
          phone: servicePartnerCompany.phone,
          notes: servicePartnerCompany.notes,
          createdAt: servicePartnerCompany.createdAt,
          updatedAt: servicePartnerCompany.updatedAt,
        },
        metrics,
        contractors,
        installations,
        actions: actions.slice(0, 8),
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get service partner company detail error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const body = await request.json()
    const data = servicePartnerCompanySchema.parse(body)

    const existingServicePartnerCompany =
      await prisma.servicePartnerCompany.findFirst({
        where: {
          id,
          companyId: auth.user.companyId,
        },
        select: {
          id: true,
        },
      })

    if (!existingServicePartnerCompany) {
      return NextResponse.json(
        { error: "Serviceföretaget hittades inte" },
        { status: 404 }
      )
    }

    const servicePartnerCompany = await prisma.servicePartnerCompany.update({
      where: {
        id,
      },
      data,
      select: servicePartnerCompanySelect,
    })

    return NextResponse.json(servicePartnerCompany, { status: 200 })
  } catch (error: unknown) {
    console.error("Update service partner company error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Det finns redan ett serviceföretag med samma namn." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function optionalText(maxLength: number) {
  return z.string().trim().max(maxLength).optional().or(z.literal("")).transform((value) => value || null)
}

const servicePartnerCompanySelect = {
  id: true,
  name: true,
  organizationNumber: true,
  contactEmail: true,
  phone: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServicePartnerCompanySelect
