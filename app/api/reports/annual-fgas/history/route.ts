import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildSignedAnnualReportHistoryWhere,
  mapSignedAnnualReportHistoryItem,
} from "@/lib/reports/signedAnnualFgasReports"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const records = await prisma.signedAnnualFgasReport.findMany({
      where: {
        ...buildSignedAnnualReportHistoryWhere({
          companyId: auth.user.companyId,
          isContractor: isContractor(auth.user),
          userId: auth.user.userId,
        }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    })

    return NextResponse.json(
      records.map(mapSignedAnnualReportHistoryItem),
      { status: 200 }
    )
  } catch (error) {
    console.error("List signed annual F-gas report history error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta signerade rapporter" },
      { status: 500 }
    )
  }
}
