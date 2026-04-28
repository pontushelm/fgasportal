import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit/js/pdfkit.standalone.js"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

type PdfRow = {
  name: string
  location: string
  equipmentId: string
  serialNumber: string
  propertyName: string
  equipmentType: string
  refrigerant: string
  amountKg: string
  gwp: string
  co2eTon: string
  interval: string
  lastInspection: string
  nextInspection: string
  status: string
}

const PDF_COLUMNS: Array<{ label: string; key: keyof PdfRow; width: number }> = [
  { label: "Name", key: "name", width: 60 },
  { label: "Location", key: "location", width: 60 },
  { label: "Equipment ID", key: "equipmentId", width: 55 },
  { label: "Serial", key: "serialNumber", width: 55 },
  { label: "Property", key: "propertyName", width: 55 },
  { label: "Type", key: "equipmentType", width: 55 },
  { label: "Refrigerant", key: "refrigerant", width: 50 },
  { label: "Amount kg", key: "amountKg", width: 45 },
  { label: "GWP", key: "gwp", width: 34 },
  { label: "CO2e ton", key: "co2eTon", width: 45 },
  { label: "Interval", key: "interval", width: 45 },
  { label: "Next", key: "nextInspection", width: 50 },
  { label: "Status", key: "status", width: 60 },
]

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId } = auth.user

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        name: true,
      },
    })

    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const rows: PdfRow[] = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.nextInspection
      )

      return {
        name: installation.name,
        location: installation.location,
        equipmentId: installation.equipmentId ?? "-",
        serialNumber: installation.serialNumber ?? "-",
        propertyName: installation.propertyName ?? "-",
        equipmentType: installation.equipmentType ?? "-",
        refrigerant: installation.refrigerantType,
        amountKg: installation.refrigerantAmount.toString(),
        gwp: compliance.gwp.toString(),
        co2eTon: compliance.co2eTon.toFixed(2),
        interval: compliance.inspectionIntervalMonths
          ? `${compliance.inspectionIntervalMonths} months`
          : "-",
        lastInspection: formatPdfDate(installation.lastInspection),
        nextInspection: formatPdfDate(installation.nextInspection),
        status: compliance.status,
      }
    })

    const pdf = await createPdf(company?.name ?? null, rows)

    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="fgas-installations.pdf"',
      },
    })
  } catch (error: unknown) {
    console.error("Export installations PDF error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function createPdf(companyName: string | null, rows: PdfRow[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 36,
      size: "A4",
      layout: "landscape",
    })
    const chunks: Buffer[] = []

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.fontSize(20).text("F-gas register")
    doc.moveDown(0.4)
    doc.fontSize(10)
    doc.text(`Company: ${companyName || "-"}`)
    doc.text(`Export date: ${formatPdfDate(new Date())}`)
    doc.moveDown()

    drawTable(doc, rows)

    doc.end()
  })
}

function drawTable(doc: PDFKit.PDFDocument, rows: PdfRow[]) {
  const rowHeight = 34
  const tableLeft = doc.page.margins.left
  const tableWidth = PDF_COLUMNS.reduce((total, column) => total + column.width, 0)

  drawTableHeader(doc, tableLeft, doc.y, tableWidth)

  if (rows.length === 0) {
    doc.fontSize(9).text("No installations found.", tableLeft, doc.y + 8)
    return
  }

  rows.forEach((row) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
      drawTableHeader(doc, tableLeft, doc.y, tableWidth)
    }

    let x = tableLeft
    const y = doc.y
    doc.fontSize(8).fillColor("#111111")

    PDF_COLUMNS.forEach((column) => {
      doc.text(row[column.key], x + 3, y + 6, {
        width: column.width - 6,
        height: rowHeight - 8,
        ellipsis: true,
      })
      x += column.width
    })

    doc
      .strokeColor("#e5e5e5")
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
  tableWidth: number
) {
  let x = tableLeft
  const rowHeight = 24

  doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f5f5f5")
  doc.fontSize(8).fillColor("#111111")

  PDF_COLUMNS.forEach((column) => {
    doc.text(column.label, x + 3, y + 7, {
      width: column.width - 6,
      ellipsis: true,
    })
    x += column.width
  })

  doc.y = y + rowHeight
}

function formatPdfDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "-"
}
