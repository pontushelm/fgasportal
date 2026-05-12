import type {
  AnnualFgasCertificateEntry,
  AnnualFgasEquipmentRow,
  AnnualFgasRefrigerantHandlingRow,
  AnnualFgasReportQualitySummary,
  AnnualFgasReportReadinessStatus,
  AnnualFgasReportWarning,
  AnnualFgasScrappedEquipmentRow,
} from "@/lib/reports/annualFgasReportTypes"

export const ANNUAL_FGAS_EVENT_LABELS = {
  INSPECTION: "Läckagekontroll",
  LEAK: "Läckage/reparation",
  REFILL: "Påfyllning",
  SERVICE: "Service",
  REPAIR: "Reparation",
  RECOVERY: "Tömning / Återvinning",
  REFRIGERANT_CHANGE: "Byte av köldmedium",
} as const

export type AnnualFgasEventType = keyof typeof ANNUAL_FGAS_EVENT_LABELS

export function buildRefrigerantHandlingRow({
  equipmentId,
  equipmentName,
  event,
  fallbackRefrigerantType,
}: {
  equipmentId: string | null
  equipmentName: string
  event: {
    id: string
    date: Date
    type: AnnualFgasEventType
    refrigerantAddedKg: number | null
    notes: string | null
  }
  fallbackRefrigerantType: string
}): AnnualFgasRefrigerantHandlingRow {
  const parsedChange = parseRefrigerantChangeNotes(event.notes)
  const isRefrigerantChange = event.type === "REFRIGERANT_CHANGE"

  return {
    id: event.id,
    date: event.date,
    equipmentName,
    equipmentId,
    refrigerantType: parsedChange.newRefrigerantType ?? fallbackRefrigerantType,
    eventType: ANNUAL_FGAS_EVENT_LABELS[event.type],
    previousRefrigerantType: parsedChange.previousRefrigerantType,
    newRefrigerantType: parsedChange.newRefrigerantType,
    addedKg:
      event.type === "REFILL" || isRefrigerantChange
        ? event.refrigerantAddedKg
        : null,
    recoveredKg:
      event.type === "RECOVERY"
        ? event.refrigerantAddedKg
        : isRefrigerantChange
          ? parsedChange.recoveredKg
          : null,
    regeneratedReusedKg: null,
    notes: event.notes,
  }
}

export function buildAnnualFgasReportWarnings({
  certificateRegister,
  co2eSummary,
  equipment,
  periodEndDate,
  reportInstallations,
  scrappedEquipment,
}: {
  certificateRegister: AnnualFgasCertificateEntry[]
  co2eSummary: { unknownCo2eEquipmentCount: number }
  equipment: AnnualFgasEquipmentRow[]
  periodEndDate?: Date
  refrigerantHandlingLog: AnnualFgasRefrigerantHandlingRow[]
  reportInstallations: Array<{
    id: string
    name: string
    equipmentId: string | null
    assignedContractorId: string | null
    property?: {
      municipality: string | null
      propertyDesignation: string | null
    } | null
    assignedContractor: {
      memberships: Array<{ certificationNumber: string | null }>
    } | null
    events: Array<{
      id: string
      type: AnnualFgasEventType
      refrigerantAddedKg: number | null
      notes: string | null
    }>
  }>
  scrappedEquipment: AnnualFgasScrappedEquipmentRow[]
}): AnnualFgasReportWarning[] {
  const warnings: AnnualFgasReportWarning[] = []

  if (co2eSummary.unknownCo2eEquipmentCount > 0) {
    warnings.push({
      id: "unknown-co2e",
      severity: "blocking",
      message: `${co2eSummary.unknownCo2eEquipmentCount} aggregat saknar känt GWP/CO₂e-värde.`,
    })
  }

  reportInstallations.forEach((installation) => {
    const equipmentRow = equipment.find((row) => row.id === installation.id)

    if (installation.property === null) {
      warnings.push({
        id: `missing-property-${installation.id}`,
        severity: "blocking",
        equipmentName: installation.name,
        equipmentId: installation.equipmentId,
        message: "Aggregatet saknar kopplad fastighet och kommun i rapportunderlaget.",
      })
    } else if (installation.property) {
      if (!installation.property.municipality) {
        warnings.push({
          id: `missing-municipality-${installation.id}`,
          severity: "blocking",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Aggregatets fastighet saknar kommun.",
        })
      }

      if (!installation.property.propertyDesignation) {
        warnings.push({
          id: `missing-property-designation-${installation.id}`,
          severity: "review",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Aggregatets fastighet saknar fastighetsbeteckning.",
        })
      }
    }

    if (equipmentRow) {
      if (equipmentRow.controlRequired && !equipmentRow.lastInspectionAt) {
        warnings.push({
          id: `missing-inspection-history-${installation.id}`,
          severity: "blocking",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Kontrollpliktigt aggregat saknar registrerad kontrollhistorik.",
        })
      }

      if (
        equipmentRow.controlRequired &&
        equipmentRow.nextInspectionAt &&
        periodEndDate &&
        equipmentRow.nextInspectionAt < periodEndDate
      ) {
        warnings.push({
          id: `overdue-inspection-year-end-${installation.id}`,
          severity: "review",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Aggregatet hade försenad kontroll vid rapportårets slut.",
        })
      }

      if (
        !equipmentRow.refrigerantType.trim() ||
        equipmentRow.refrigerantType.toLowerCase().includes("okänt")
      ) {
        warnings.push({
          id: `unknown-refrigerant-${installation.id}`,
          severity: "blocking",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Aggregatet saknar känt köldmedium.",
        })
      }

      if (equipmentRow.refrigerantAmountKg <= 0) {
        warnings.push({
          id: `missing-refrigerant-amount-${installation.id}`,
          severity: "blocking",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Aggregatet saknar tydlig köldmediemängd.",
        })
      }
    }

    if (!installation.assignedContractorId) {
      warnings.push({
        id: `missing-service-contact-${installation.id}`,
        severity: "review",
        equipmentName: installation.name,
        equipmentId: installation.equipmentId,
        message: "Aggregatet saknar tilldelad servicekontakt.",
      })
    } else if (!installation.assignedContractor?.memberships[0]?.certificationNumber) {
      warnings.push({
        id: `missing-certificate-${installation.id}`,
        severity: "review",
        equipmentName: installation.name,
        equipmentId: installation.equipmentId,
        message: "Tilldelad servicekontakt saknar registrerat certifikatnummer.",
      })
    }

    installation.events.forEach((event) => {
      if (event.type === "LEAK" && event.refrigerantAddedKg == null) {
        warnings.push({
          id: `leak-missing-amount-${event.id}`,
          severity: "review",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Läckagehändelse saknar läckagemängd.",
        })
      }
      if (event.type === "RECOVERY" && event.refrigerantAddedKg == null) {
        warnings.push({
          id: `recovery-missing-amount-${event.id}`,
          severity: "review",
          equipmentName: installation.name,
          equipmentId: installation.equipmentId,
          message: "Tömning/återvinning saknar omhändertagen mängd.",
        })
      }
      if (event.type === "REFRIGERANT_CHANGE") {
        const parsedChange = parseRefrigerantChangeNotes(event.notes)
        if (!parsedChange.newRefrigerantType) {
          warnings.push({
            id: `refrigerant-change-missing-new-refrigerant-${event.id}`,
            severity: "review",
            equipmentName: installation.name,
            equipmentId: installation.equipmentId,
            message: "Köldmediebyte saknar tydligt nytt köldmedium i rapportunderlaget.",
          })
        }
        if (event.refrigerantAddedKg == null) {
          warnings.push({
            id: `refrigerant-change-missing-amount-${event.id}`,
            severity: "review",
            equipmentName: installation.name,
            equipmentId: installation.equipmentId,
            message: "Köldmediebyte saknar ny fyllnadsmängd.",
          })
        }
      }
    })
  })

  scrappedEquipment.forEach((row) => {
    if (row.recoveredKg == null) {
      warnings.push({
        id: `scrap-missing-recovered-${row.id}`,
        severity: "review",
        equipmentName: row.equipmentName,
        equipmentId: row.equipmentId,
        message: "Skrotat aggregat saknar återvunnen mängd.",
      })
    }
    if (!row.certificateFileName) {
      warnings.push({
        id: `scrap-missing-certificate-${row.id}`,
        severity: "review",
        equipmentName: row.equipmentName,
        equipmentId: row.equipmentId,
        message: "Skrotat aggregat saknar intyg/dokumentreferens.",
      })
    }
  })

  if (certificateRegister.length === 0 && equipment.length > 0) {
    warnings.push({
      id: "empty-certificate-register",
      severity: "review",
      message: "Certifikatregister saknar registrerade tekniker/servicepartners.",
    })
  }

  return warnings.sort((first, second) => {
    if (first.severity !== second.severity) {
      return first.severity === "blocking" ? -1 : 1
    }

    return first.id.localeCompare(second.id, "sv")
  })
}

export function buildAnnualFgasReportQualitySummary(
  warnings: AnnualFgasReportWarning[]
): AnnualFgasReportQualitySummary {
  const blockingIssueCount = warnings.filter(
    (warning) => warning.severity === "blocking"
  ).length
  const warningCount = warnings.length - blockingIssueCount
  const status: AnnualFgasReportReadinessStatus =
    blockingIssueCount > 0
      ? "MISSING_REQUIRED_DATA"
      : warningCount > 0
        ? "HAS_WARNINGS"
        : "READY"

  return {
    status,
    blockingIssueCount,
    warningCount,
    totalIssueCount: warnings.length,
  }
}

function parseRefrigerantChangeNotes(notes: string | null) {
  const text = notes ?? ""
  const changeMatch = text.match(/Byte av köldmedium från\s+(.+?)\s+till\s+(.+?)\./i)
  const importPreviousMatch = text.match(/Tidigare köldmedium enligt import:\s*(.+?)\./i)
  const importNewMatch = text.match(/Nytt köldmedium enligt import:\s*(.+?)\./i)
  const recoveredMatch = text.match(/Omhändertagen mängd:\s*([\d,.]+)\s*kg/i)

  return {
    previousRefrigerantType:
      changeMatch?.[1]?.trim() ?? importPreviousMatch?.[1]?.trim() ?? null,
    newRefrigerantType:
      changeMatch?.[2]?.trim() ?? importNewMatch?.[1]?.trim() ?? null,
    recoveredKg: recoveredMatch ? parseNumber(recoveredMatch[1]) : null,
  }
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}
