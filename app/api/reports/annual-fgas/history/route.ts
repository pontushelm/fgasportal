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

    const year = parseReportYear(request.nextUrl.searchParams.get("year"))
    const municipality = request.nextUrl.searchParams.get("municipality")?.trim()
    const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim()

    const records = await prisma.signedAnnualFgasReport.findMany({
      where: {
        ...buildSignedAnnualReportHistoryWhere({
          companyId: auth.user.companyId,
          isContractor: isContractor(auth.user),
          userId: auth.user.userId,
        }),
        ...(year ? { reportYear: year } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(!propertyId && municipality ? { municipality } : {}),
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

function parseReportYear(value: string | null) {
  const year = value ? Number(value) : null

  if (year === null) return null
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 1) {
    return null
  }

  return year
}
