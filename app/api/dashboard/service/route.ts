import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isContractor } from "@/lib/auth"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isContractor(auth.user)) return forbiddenResponse()

    const installations = await prisma.installation.findMany({
      where: {
        companyId: auth.user.companyId,
        assignedContractorId: auth.user.userId,
        archivedAt: null,
      },
      orderBy: {
        name: "asc",
      },
    })

    const rows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      return {
        id: installation.id,
        name: installation.name,
        location: installation.location,
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        nextInspection: installation.nextInspection,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
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
