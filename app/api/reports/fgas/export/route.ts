import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit/js/pdfkit.standalone.js"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getFgasAnnualReport,
  parseReportYear,
  type FgasReportData,
  type FgasReportEventType,
} from "@/lib/fgas-report"
import { logActivity } from "@/lib/activity-log"

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

    if (format !== "csv" && format !== "pdf") {
      return NextResponse.json(
        { error: "Formatet stöds inte" },
        { status: 400 }
      )
    }

    const company = await prisma.company.findUnique({
      where: {
        id: auth.user.companyId,
      },
      select: {
        name: true,
      },
    })
    const report = await getFgasAnnualReport({
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      year,
    })

    if (format === "pdf") {
      const pdf = await createReportPdf(report, company?.name ?? null)
      const body = pdf.buffer.slice(
        pdf.byteOffset,
        pdf.byteOffset + pdf.byteLength
      ) as ArrayBuffer
      const filename = `fgas-arsrapport-${year}.pdf`

      await logActivity({
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        action: "report_exported",
        entityType: "report",
        entityId: `fgas-${year}`,
        metadata: {
          reportType: "fgas_annual",
          year,
          format: "pdf",
        },
      })

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    const csv = createReportCsv(report)
    const filename = `fgas-arsrapport-${year}.csv`

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "report_exported",
      entityType: "report",
      entityId: `fgas-${year}`,
      metadata: {
        reportType: "fgas_annual",
        year,
        format: "csv",
      },
    })

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

function createReportCsv(report: FgasReportData) {
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

function createReportPdf(report: FgasReportData, companyName: string | null) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 42,
      size: "A4",
    })
    const chunks: Buffer[] = []

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.fontSize(20).fillColor("#111111").text("F-gas årsrapport")
    doc.moveDown(0.4)
    doc.fontSize(10)
    doc.text(`År: ${report.year}`)
    doc.text(`Genererad: ${formatDate(new Date())}`)
    doc.text(`Företag: ${companyName || "-"}`)
    doc.moveDown()

    drawSectionTitle(doc, "Sammanfattning")
    drawKeyValueRows(doc, [
      ["Totalt antal aggregat", String(report.metrics.totalInstallations)],
      [
        "Total köldmediemängd kg",
        formatNumber(report.metrics.totalRefrigerantAmountKg),
      ],
      ["Total CO2e ton", formatNumber(report.metrics.totalCo2eTon)],
      [
        "Kontrollpliktiga aggregat",
        String(report.metrics.requiringInspection),
      ],
      ["Utförda kontroller", String(report.metrics.inspectionsPerformed)],
      ["Läckagehändelser", String(report.metrics.leakageEvents)],
      ["Påfylld mängd kg", formatNumber(report.metrics.refilledAmountKg)],
      ["Servicehändelser", String(report.metrics.serviceEvents)],
    ])

    drawSectionTitle(doc, "Köldmediesammanställning")
    drawTable(
      doc,
      ["Köldmedium", "Aggregat", "Mängd kg", "CO2e ton", "Påfyllt kg", "Läckage"],
      report.refrigerants.map((item) => [
        item.refrigerantType,
        String(item.installationCount),
        formatNumber(item.totalAmountKg),
        formatNumber(item.totalCo2eTon),
        formatNumber(item.refilledAmountKg),
        String(item.leakageEvents),
      ]),
      [120, 62, 72, 72, 72, 62]
    )

    drawSectionTitle(doc, "Händelser under året")
    drawTable(
      doc,
      ["Datum", "Aggregat", "Typ", "Köldmedium", "Mängd kg", "Anteckningar"],
      report.events.map((event) => [
        formatDate(event.date),
        event.installationName,
        EVENT_LABELS[event.type],
        event.refrigerantType,
        event.refrigerantAddedKg === null
          ? "-"
          : formatNumber(event.refrigerantAddedKg),
        event.notes ?? "-",
      ]),
      [58, 92, 62, 74, 58, 116]
    )

    doc.end()
  })
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 52)
  doc.moveDown(0.8)
  doc.fontSize(13).fillColor("#111111").text(title)
  doc.moveDown(0.4)
}

function drawKeyValueRows(doc: PDFKit.PDFDocument, rows: string[][]) {
  const tableLeft = doc.page.margins.left
  const labelWidth = 220
  const valueWidth = 180
  const rowHeight = 22

  rows.forEach(([label, value]) => {
    ensureSpace(doc, rowHeight + 8)
    const y = doc.y

    doc.rect(tableLeft, y, labelWidth + valueWidth, rowHeight).fill("#f8fafc")
    doc.fontSize(9).fillColor("#111111")
    doc.text(label, tableLeft + 6, y + 6, {
      width: labelWidth - 12,
      ellipsis: true,
    })
    doc.text(value, tableLeft + labelWidth + 6, y + 6, {
      width: valueWidth - 12,
      ellipsis: true,
    })
    doc
      .strokeColor("#e2e8f0")
      .moveTo(tableLeft, y + rowHeight)
      .lineTo(tableLeft + labelWidth + valueWidth, y + rowHeight)
      .stroke()
    doc.y = y + rowHeight
  })
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  widths: number[]
) {
  const tableLeft = doc.page.margins.left
  const tableWidth = widths.reduce((total, width) => total + width, 0)
  const rowHeight = 30

  drawTableHeader(doc, tableLeft, doc.y, headers, widths, tableWidth)

  if (rows.length === 0) {
    doc
      .fontSize(9)
      .fillColor("#475569")
      .text("Inga rader att visa.", tableLeft, doc.y + 8)
    doc.moveDown()
    return
  }

  rows.forEach((row) => {
    ensureSpace(doc, rowHeight + 8)
    if (doc.y < doc.page.margins.top + 8) {
      drawTableHeader(doc, tableLeft, doc.y, headers, widths, tableWidth)
    }

    let x = tableLeft
    const y = doc.y
    doc.fontSize(8).fillColor("#111111")

    row.forEach((value, index) => {
      doc.text(value, x + 4, y + 6, {
        width: widths[index] - 8,
        height: rowHeight - 8,
        ellipsis: true,
      })
      x += widths[index]
    })

    doc
      .strokeColor("#e2e8f0")
      .moveTo(tableLeft, y + rowHeight)
      .lineTo(tableLeft + tableWidth, y + rowHeight)
      .stroke()
    doc.y = y + rowHeight
  })
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  tableLeft: number,
  y: number,
  headers: string[],
  widths: number[],
  tableWidth: number
) {
  const rowHeight = 24
  let x = tableLeft

  doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f1f5f9")
  doc.fontSize(8).fillColor("#111111")
  headers.forEach((header, index) => {
    doc.text(header, x + 4, y + 7, {
      width: widths[index] - 8,
      ellipsis: true,
    })
    x += widths[index]
  })
  doc.y = y + rowHeight
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage()
  }
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
