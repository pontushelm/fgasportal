import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

const CSV_HEADERS = [
  "Name",
  "Location",
  "Equipment ID",
  "Serial number",
  "Property",
  "Equipment type",
  "Operator",
  "Refrigerant",
  "Refrigerant amount kg",
  "Leak detection system",
  "GWP",
  "CO2e ton",
  "Inspection interval months",
  "Last inspection",
  "Next inspection",
  "Latest inspection status",
  "Compliance status",
  "Notes",
]

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId } = auth.user

    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
      },
      include: {
        inspections: {
          orderBy: {
            inspectionDate: "desc",
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const rows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      return [
        installation.name,
        installation.location,
        installation.equipmentId ?? "",
        installation.serialNumber ?? "",
        installation.propertyName ?? "",
        installation.equipmentType ?? "",
        installation.operatorName ?? "",
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem ? "Yes" : "No",
        compliance.gwp,
        compliance.co2eTon.toFixed(2),
        compliance.inspectionIntervalMonths ?? "",
        formatCsvDate(installation.lastInspection),
        formatCsvDate(installation.nextInspection),
        installation.inspections[0]?.status ??
          installation.inspections[0]?.findings ??
          "",
        compliance.status,
        installation.notes ?? "",
      ]
    })

    const csv = [CSV_HEADERS, ...rows]
      .map((row) => row.map(formatCsvCell).join(","))
      .join("\r\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fgas-installations.csv"',
      },
    })
  } catch (error: unknown) {
    console.error("Export installations error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function formatCsvCell(value: string | number) {
  const cell = String(value)
  return `"${cell.replace(/"/g, '""')}"`
}

function formatCsvDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ""
}
