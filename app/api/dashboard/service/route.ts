import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isContractor } from "@/lib/auth"
import { getInstallationAccessWhereClause } from "@/lib/access/installation-access"
import { createComplianceExplanation } from "@/lib/compliance/compliancePresentation"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isContractor(auth.user)) return forbiddenResponse()

    const installations = await prisma.installation.findMany({
      where: {
        AND: [
          getInstallationAccessWhereClause(auth.user),
          {
            archivedAt: null,
            scrappedAt: null,
          },
        ],
      },
      orderBy: {
        name: "asc",
      },
      include: {
        assignedContractor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const rows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection,
        installation.isHermeticallySealed
      )

      return {
        id: installation.id,
        name: installation.name,
        location: installation.location,
        installationRegisterType: installation.installationRegisterType,
        mobileUnitId: installation.mobileUnitId,
        mobileUnitName: installation.mobileUnitName,
        mobileRegistrationOrVehicleNumber:
          installation.mobileRegistrationOrVehicleNumber,
        mobileBaseLocation: installation.mobileBaseLocation,
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        isHermeticallySealed: installation.isHermeticallySealed,
        nextInspection: installation.nextInspection,
        complianceStatus: compliance.status,
        complianceExplanation: createComplianceExplanation({
          ...compliance,
          refrigerantAmountKg: installation.refrigerantAmount,
          isHermeticallySealed: installation.isHermeticallySealed,
          lastInspection: installation.lastInspection,
        }),
        daysUntilDue: compliance.daysUntilDue,
        assignedContractorId: installation.assignedContractorId,
        assignedContractor: installation.assignedContractor,
      }
    })

    return NextResponse.json(rows, { status: 200 })
  } catch (error: unknown) {
    console.error("Get service dashboard error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
