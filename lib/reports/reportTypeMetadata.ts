export type ReportType =
  | "annual"
  | "climate"
  | "compliance"
  | "risk"
  | "refrigerants"

export type ReportSupportStatus = "FULL" | "PREVIEW" | "PLANNED"

export type ReportTypeMetadata = {
  value: ReportType
  label: string
  title: string
  subtitle: string
  contextTitle: string
  supportStatus: ReportSupportStatus
  supportLabel: string
  exportAvailable: boolean
  placeholderTitle?: string
  placeholderDescription?: string
}

export const REPORT_TYPE_OPTIONS: ReportTypeMetadata[] = [
  {
    value: "annual",
    label: "Årsrapport enligt F-gasförordningen",
    title: "F-gas årsrapport",
    subtitle:
      "Årssammanställning av aggregat, kontrollhändelser, läckagehändelser, påfyllningar och klimatpåverkan.",
    contextTitle: "Rapportunderlag",
    supportStatus: "FULL",
    supportLabel: "Fullt stöd",
    exportAvailable: true,
  },
  {
    value: "climate",
    label: "Klimatpåverkan",
    title: "Klimatpåverkan",
    subtitle:
      "Operativ översikt över CO₂e, köldmedier, läckage och påfyllningar för valt urval.",
    contextTitle: "Klimat- och läckageunderlag",
    supportStatus: "PREVIEW",
    supportLabel: "Operativ översikt",
    exportAvailable: false,
    placeholderTitle: "Planerad klimatrapport",
    placeholderDescription:
      "Kommer visa klimatpåverkan från installerade köldmedier och registrerade läckage över tid.",
  },
  {
    value: "compliance",
    label: "Kontrollstatus",
    title: "Kontrollstatus",
    subtitle:
      "Operativ översikt för uppföljning av kontrollplikt, utförda kontroller och status.",
    contextTitle: "Kontroll- och serviceunderlag",
    supportStatus: "PREVIEW",
    supportLabel: "Förhandsversion",
    exportAvailable: false,
    placeholderTitle: "Planerad kontrollstatusrapport",
    placeholderDescription:
      "Kommer ge översikt över kontrollplikt, försenade kontroller och kommande kontroller.",
  },
  {
    value: "risk",
    label: "Högriskaggregat",
    title: "Högriskaggregat",
    subtitle:
      "Planerad rapportvy för prioritering av aggregat med hög risk och operativa åtgärder.",
    contextTitle: "Prioriteringsunderlag",
    supportStatus: "PLANNED",
    supportLabel: "Kommer senare",
    exportAvailable: false,
    placeholderTitle: "Planerad riskrapport",
    placeholderDescription:
      "Kommer fokusera på aggregat med hög riskklassning och operativa åtgärder.",
  },
  {
    value: "refrigerants",
    label: "Köldmediesammanställning",
    title: "Köldmediesammanställning",
    subtitle:
      "Operativ översikt över köldmediefördelning, mängder, CO₂e, påfyllningar och läckage.",
    contextTitle: "Köldmedieunderlag",
    supportStatus: "PREVIEW",
    supportLabel: "Operativ översikt",
    exportAvailable: false,
    placeholderTitle: "Planerad köldmedierapport",
    placeholderDescription:
      "Kommer visa köldmediefördelning, mängder och CO₂e i ett färdigt rapportformat.",
  },
]

export function getReportTypeMetadata(reportType: ReportType) {
  return (
    REPORT_TYPE_OPTIONS.find((option) => option.value === reportType) ??
    REPORT_TYPE_OPTIONS[0]
  )
}

export function isReportExportAvailable(reportType: ReportType) {
  return getReportTypeMetadata(reportType).exportAvailable
}
