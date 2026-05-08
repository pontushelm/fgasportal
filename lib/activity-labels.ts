export const ACTIVITY_LABELS: Record<string, string> = {
  installation_created: "Aggregat skapat",
  installation_updated: "Aggregat uppdaterat",
  installation_scrapped: "Aggregat skrotat",
  service_partner_assigned: "Servicekontakt tilldelad",
  property_assigned: "Fastighet tilldelad",
  property_removed: "Fastighet borttagen",
  company_billing_updated: "Fakturauppgifter uppdaterade",
  user_added_to_company: "Användare tillagd i företag",
  user_role_changed: "Användarroll ändrad",
  user_removed: "Användare borttagen",
  ownership_transferred: "Ägarskap överfört",
  inspection_added: "Kontroll registrerad",
  leak_registered: "Läckage registrerat",
  refill_registered: "Påfyllning registrerad",
  service_added: "Service registrerad",
  repair_registered: "Reparation registrerad",
  recovery_registered: "Tömning/återvinning registrerad",
  refrigerant_change_registered: "Byte av köldmedium registrerat",
  document_uploaded: "Dokument uppladdat",
  document_deleted: "Dokument borttaget",
  report_exported: "Rapport exporterad",
  inspection_due_reminder_sent: "Påminnelse skickad",
  inspection_overdue_reminder_sent: "Förseningspåminnelse skickad",
}

export const ACTIVITY_EVENT_OPTIONS = Object.entries(ACTIVITY_LABELS).map(
  ([value, label]) => ({ label, value })
)

export function formatActivityLabel(action: string) {
  return ACTIVITY_LABELS[action] ?? action
}

export function formatActivityDescription({
  action,
  entityType,
  metadata,
}: {
  action: string
  entityType: string
  metadata?: Record<string, unknown> | null
}) {
  if (metadata) {
    if (typeof metadata.fileName === "string") return metadata.fileName
    if (typeof metadata.originalFileName === "string") return metadata.originalFileName
    if (typeof metadata.inspectorName === "string") return metadata.inspectorName
    if (typeof metadata.contractorName === "string") {
      return `Servicekontakt: ${metadata.contractorName}`
    }
    if (typeof metadata.propertyName === "string") {
      return `Fastighet: ${metadata.propertyName}`
    }
    if (typeof metadata.installationName === "string") {
      return metadata.installationName
    }
    if (typeof metadata.eventType === "string") {
      return formatInstallationEventType(metadata.eventType)
    }
    if (typeof metadata.format === "string" && typeof metadata.year === "number") {
      return `F-gas årsrapport ${metadata.year} (${metadata.format.toUpperCase()})`
    }
    if (typeof metadata.name === "string") return metadata.name
    if (typeof metadata.targetUserEmail === "string") {
      return metadata.targetUserEmail
    }
    if (typeof metadata.newOwnerEmail === "string") {
      return `Ny ägare: ${metadata.newOwnerEmail}`
    }
  }

  if (action === "report_exported") return "Rapport exporterad"
  return entityType
}

function formatInstallationEventType(eventType: string) {
  if (eventType === "INSPECTION") return "Kontroll"
  if (eventType === "LEAK") return "Läckage"
  if (eventType === "REFILL") return "Påfyllning"
  if (eventType === "SERVICE") return "Service"
  if (eventType === "REPAIR") return "Reparation"
  if (eventType === "RECOVERY") return "Tömning/återvinning"
  if (eventType === "REFRIGERANT_CHANGE") return "Byte av köldmedium"

  return eventType
}
