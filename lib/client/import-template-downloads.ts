import * as XLSX from "xlsx"

export type ImportTemplateType = "properties" | "installations" | "events"

const PROPERTY_TEMPLATE_COLUMNS = [
  "Fastighetsbeteckning",
  "Namn",
  "Kommun",
  "Ort",
  "Adress",
  "Postnummer",
  "Intern referens",
  "Kommentar",
]

const INSTALLATION_TEMPLATE_COLUMNS = [
  "Registertyp",
  "Aggregat-ID / märkning",
  "Aggregatnamn / benämning",
  "Enhets-ID / inventarienummer",
  "Namn / beteckning",
  "Registreringsnummer / fordonsnummer",
  "Primär depå / hemmahamn / bas",
  "Placering",
  "Fastighet",
  "Köldmedium",
  "Fyllnadsmängd kg",
  "Läckagevarningssystem",
  "Hermetiskt slutet aggregat",
  "Senaste kontroll",
  "Nästa kontroll",
  "Driftsättningsdatum",
  "Serienummer",
  "Kommentar",
]

const EVENT_TEMPLATE_COLUMNS = [
  "Aggregat-ID",
  "Fastighet",
  "Händelsetyp",
  "Händelsedatum",
  "Händelseår",
  "Mängd",
  "Tidigare köldmedium",
  "Nytt köldmedium",
  "Omhändertagen mängd",
  "Kommentar",
]

export const IMPORT_TEMPLATE_OPTIONS: Array<{
  type: ImportTemplateType
  title: string
  description: string
  fileName: string
}> = [
  {
    description: "Grunduppgifter, adress, kommun och fastighetsbeteckning.",
    fileName: "helm-polar-importmall-fastigheter.xlsx",
    title: "Mall för fastigheter",
    type: "properties",
  },
  {
    description: "Aggregat, köldmedium, fyllnadsmängder och placering.",
    fileName: "helm-polar-importmall-aggregat.xlsx",
    title: "Mall för aggregat",
    type: "installations",
  },
  {
    description: "Kontroller, läckage, service, påfyllningar och historik.",
    fileName: "helm-polar-importmall-handelser.xlsx",
    title: "Mall för händelser",
    type: "events",
  },
]

export function downloadImportTemplate(type: ImportTemplateType) {
  const option = IMPORT_TEMPLATE_OPTIONS.find((item) => item.type === type)
  const fileName = option?.fileName ?? "helm-polar-importmall.xlsx"

  if (type === "properties") {
    return writeWorkbook({
      columns: PROPERTY_TEMPLATE_COLUMNS,
      fileName,
      instructionRows: [
        ["Helm Polar - importmall för fastigheter"],
        [""],
        ["Fyll i fliken Fastigheter och behåll rubrikraden överst."],
        ["Obligatoriska fält", "Fastighetsbeteckning"],
        ["Rekommenderade fält", "Namn, Kommun, Ort, Adress"],
        [
          "Fastighetsbeteckning",
          "Använd den juridiskt relevanta beteckningen som ska synas i årsrapporten.",
        ],
      ],
      rows: [
        {
          Adress: "Skolgatan 1",
          Fastighetsbeteckning: "Åsen 1:23",
          Kommentar: "",
          Kommun: "Stockholm",
          Namn: "Förskolan Åsen",
          Ort: "Stockholm",
          Postnummer: "123 45",
          "Intern referens": "OBJ-1001",
        },
      ],
      sheetName: "Fastigheter",
    })
  }

  if (type === "installations") {
    return writeWorkbook({
      columns: INSTALLATION_TEMPLATE_COLUMNS,
      fileName,
      instructionRows: [
        ["Helm Polar - importmall för aggregat"],
        [""],
        ["Fyll i fliken Aggregat och behåll rubrikraden överst."],
        ["Obligatoriska fält", "Aggregat-ID / märkning, Köldmedium, Fyllnadsmängd kg"],
        [
          "Beräkningar",
          "Importera normalt inte GWP eller CO₂e. Polar beräknar detta från köldmedium och fyllnadsmängd.",
        ],
      ],
      rows: [
        {
          "Aggregat-ID / märkning": "AGG-001",
          "Aggregatnamn / benämning": "Kylaggregat 1",
          Kommentar: "Exempelrad - byt ut eller ta bort",
          Fastighet: "Stadshuset",
          "Fyllnadsmängd kg": 12.5,
          "Hermetiskt slutet aggregat": "Nej",
          Köldmedium: "R410A",
          Läckagevarningssystem: "Nej",
          Placering: "Tak plan 3",
          Registertyp: "Stationärt",
          "Senaste kontroll": "2026-01-15",
          "Nästa kontroll": "2027-01-15",
          Driftsättningsdatum: "2021-05-01",
          Serienummer: "SN-12345",
        },
      ],
      sheetName: "Aggregat",
    })
  }

  return writeWorkbook({
    columns: EVENT_TEMPLATE_COLUMNS,
    fileName,
    instructionRows: [
      ["Helm Polar - importmall för händelser"],
      [""],
      ["Fyll i fliken Händelser och behåll rubrikraden överst."],
      ["Obligatoriska fält", "Aggregat-ID, Händelsetyp, Händelsedatum eller Händelseår"],
      [
        "Aggregat-ID",
        "Måste matcha ett befintligt aggregat i Polar. Nya aggregat skapas inte i händelseimporten.",
      ],
    ],
    rows: [
      {
        "Aggregat-ID": "AGG-001",
        Fastighet: "Stadshuset",
        Händelsedatum: "2026-01-15",
        Händelseår: "",
        Händelsetyp: "Kontroll",
        Kommentar: "Importerad historisk kontroll",
        Mängd: "",
      },
    ],
    sheetName: "Händelser",
  })
}

function writeWorkbook({
  columns,
  fileName,
  instructionRows,
  rows,
  sheetName,
}: {
  columns: string[]
  fileName: string
  instructionRows: unknown[][]
  rows: Record<string, unknown>[]
  sheetName: string
}) {
  const workbook = XLSX.utils.book_new()
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows)
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns })

  instructionSheet["!cols"] = [{ wch: 24 }, { wch: 110 }]
  worksheet["!cols"] = columns.map(() => ({ wch: 24 }))
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      e: { c: columns.length - 1, r: Math.max(rows.length, 1) },
      s: { c: 0, r: 0 },
    }),
  }
  ;(worksheet as XLSX.WorkSheet & { "!freeze"?: unknown })["!freeze"] = {
    activePane: "bottomLeft",
    state: "frozen",
    topLeftCell: "A2",
    xSplit: 0,
    ySplit: 1,
  }

  XLSX.utils.book_append_sheet(workbook, instructionSheet, "Läs först")
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}
