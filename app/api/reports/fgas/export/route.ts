import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import {
  getFgasAnnualReport,
  parseReportYear,
  type FgasReportEventType,
} from "@/lib/fgas-report"

const EVENT_LABELS: Record<FgasReportEventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service",
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const year = parseReportYear(request.nextUrl.searchParams.get("year"))
    const format = request.nextUrl.searchParams.get("format") ?? "csv"

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    if (format !== "csv") {
      return NextResponse.json(
        { error: "Formatet stöds inte" },
        { status: 400 }
      )
    }

    const report = await getFgasAnnualReport({
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      year,
    })
    const csv = createReportCsv(report)
    const filename = `fgas-arsrapport-${year}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error("Export F-gas report error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function createReportCsv(report: Awaited<ReturnType<typeof getFgasAnnualReport>>) {
  const rows: string[][] = [
    ["F-gas årsrapport"],
    ["År", String(report.year)],
    ["Genererad", formatDate(new Date())],
    [],
    ["Sammanfattning"],
    ["Mätvärde", "Värde"],
    ["Totalt antal aggregat", String(report.metrics.totalInstallations)],
    [
      "Total köldmediemängd kg",
      formatNumber(report.metrics.totalRefrigerantAmountKg),
    ],
    ["Total CO₂e ton", formatNumber(report.metrics.totalCo2eTon)],
    [
      "Kontrollpliktiga aggregat",
      String(report.metrics.requiringInspection),
    ],
    ["Utförda kontroller", String(report.metrics.inspectionsPerformed)],
    ["Läckagehändelser", String(report.metrics.leakageEvents)],
    ["Påfylld mängd kg", formatNumber(report.metrics.refilledAmountKg)],
    ["Servicehändelser", String(report.metrics.serviceEvents)],
    [],
    ["Köldmediesammanställning"],
    [
      "Köldmedium",
      "Antal aggregat",
      "Total mängd kg",
      "Total CO₂e ton",
      "Påfylld mängd kg",
      "Läckagehändelser",
    ],
    ...report.refrigerants.map((item) => [
      item.refrigerantType,
      String(item.installationCount),
      formatNumber(item.totalAmountKg),
      formatNumber(item.totalCo2eTon),
      formatNumber(item.refilledAmountKg),
      String(item.leakageEvents),
    ]),
    [],
    ["Händelser under året"],
    ["Datum", "Aggregat", "Typ", "Köldmedium", "Mängd kg", "Anteckningar"],
    ...report.events.map((event) => [
      formatDate(event.date),
      event.installationName,
      EVENT_LABELS[event.type],
      event.refrigerantType,
      event.refrigerantAddedKg === null
        ? ""
        : formatNumber(event.refrigerantAddedKg),
      event.notes ?? "",
    ]),
  ]

  return `\uFEFF${rows.map(formatCsvRow).join("\r\n")}`
}

function formatCsvRow(row: string[]) {
  return row.map(escapeCsvValue).join(",")
}

function escapeCsvValue(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sv-SE").format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value)
}
