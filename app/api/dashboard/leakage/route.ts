import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { calculateCO2e } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

type LeakageGroup = {
  label: string
  eventCount: number
  totalLeakageKg: number
  totalCo2eTon: number
}

type InstallationLeakageGroup = LeakageGroup & {
  installationId: string
  location: string
  refrigerantType: string
  latestLeakage: Date | null
}

const UNKNOWN_REFRIGERANT = "Okänt köldmedium"
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
]

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const yearParam = request.nextUrl.searchParams.get("year")
    const year = parseReportYear(yearParam)

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    const startDate = new Date(Date.UTC(year, 0, 1))
    const endDate = new Date(Date.UTC(year + 1, 0, 1))
    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
      },
      include: {
        events: {
          where: {
            type: "LEAK",
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    })

    const refrigerantMap = new Map<string, LeakageGroup>()
    const installationMap = new Map<string, InstallationLeakageGroup>()
    const monthlyCounts = MONTH_LABELS.map((label, month) => ({
      label,
      month: month + 1,
      eventCount: 0,
    }))
    let totalLeakageKg = 0
    let totalCo2eTon = 0

    const events = installations.flatMap((installation) => {
      const refrigerantType =
        installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
      const refrigerantGroup = refrigerantMap.get(refrigerantType) ?? {
        label: refrigerantType,
        eventCount: 0,
        totalLeakageKg: 0,
        totalCo2eTon: 0,
      }
      const installationGroup = installationMap.get(installation.id) ?? {
        installationId: installation.id,
        label: installation.name,
        location: installation.location,
        refrigerantType,
        eventCount: 0,
        totalLeakageKg: 0,
        totalCo2eTon: 0,
        latestLeakage: null,
      }

      return installation.events.map((event) => {
        const leakageKg = event.refrigerantAddedKg
        const co2eTon =
          leakageKg === null
            ? null
            : calculateCO2e(installation.refrigerantType, leakageKg).co2eTon
        const eventMonth = event.date.getUTCMonth()

        refrigerantGroup.eventCount += 1
        installationGroup.eventCount += 1
        monthlyCounts[eventMonth].eventCount += 1

        if (!installationGroup.latestLeakage || event.date > installationGroup.latestLeakage) {
          installationGroup.latestLeakage = event.date
        }

        if (leakageKg !== null && co2eTon !== null) {
          totalLeakageKg += leakageKg
          totalCo2eTon += co2eTon
          refrigerantGroup.totalLeakageKg += leakageKg
          refrigerantGroup.totalCo2eTon += co2eTon
          installationGroup.totalLeakageKg += leakageKg
          installationGroup.totalCo2eTon += co2eTon
        }

        refrigerantMap.set(refrigerantType, refrigerantGroup)
        installationMap.set(installation.id, installationGroup)

        return {
          id: event.id,
          date: event.date,
          installationId: installation.id,
          installationName: installation.name,
          location: installation.location,
          refrigerantType,
          leakageKg,
          co2eTon,
          notes: event.notes,
        }
      })
    })

    const byRefrigerant = Array.from(refrigerantMap.values()).sort(
      compareLeakageGroups
    )
    const byInstallation = Array.from(installationMap.values()).sort(
      compareLeakageGroups
    )

    return NextResponse.json(
      {
        year,
        metrics: {
          leakageEvents: events.length,
          installationsWithLeakage: byInstallation.length,
          totalLeakageKg,
          totalCo2eTon,
          topRefrigerant: byRefrigerant[0]?.label ?? "-",
          topInstallation: byInstallation[0]?.label ?? "-",
        },
        byRefrigerant,
        byInstallation,
        monthlyCounts,
        events: events.sort(
          (first, second) => second.date.getTime() - first.date.getTime()
        ),
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get leakage dashboard error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function compareLeakageGroups(first: LeakageGroup, second: LeakageGroup) {
  const leakageDiff = second.totalLeakageKg - first.totalLeakageKg
  if (leakageDiff !== 0) return leakageDiff

  return second.eventCount - first.eventCount
}

function parseReportYear(value: string | null) {
  const currentYear = new Date().getFullYear()
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return null
  }

  return year
}
