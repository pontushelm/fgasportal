import { calculateInstallationCompliance } from "@/lib/fgas-calculations"

export type InstallationQualityFilter =
  | "missing-property"
  | "missing-refrigerant"
  | "missing-charge"
  | "missing-gwp"

export type PropertyQualityFilter = "missing-designation" | "missing-municipality"

export type ServicePartnerQualityFilter =
  | "missing-company-certificate"
  | "expired-company-certificate"

export type TechnicianQualityFilter =
  | "missing-technician-certificate"
  | "expired-technician-certificate"

export type DataQualityFilter =
  | InstallationQualityFilter
  | PropertyQualityFilter
  | ServicePartnerQualityFilter
  | TechnicianQualityFilter

export const DATA_QUALITY_FILTER_LABELS: Record<DataQualityFilter, string> = {
  "expired-company-certificate": "Företagscertifikat har gått ut",
  "expired-technician-certificate": "Teknikercertifikat har gått ut",
  "missing-charge": "Saknar fyllnadsmängd",
  "missing-company-certificate": "Servicepartner saknar företagscertifikat",
  "missing-designation": "Saknar fastighetsbeteckning",
  "missing-gwp": "Saknar känt GWP/CO₂e",
  "missing-municipality": "Saknar kommun",
  "missing-property": "Saknar fastighet",
  "missing-refrigerant": "Saknar köldmedium",
  "missing-technician-certificate": "Tekniker saknar personcertifikat",
}

const INSTALLATION_QUALITY_FILTERS = new Set<InstallationQualityFilter>([
  "missing-property",
  "missing-refrigerant",
  "missing-charge",
  "missing-gwp",
])

const PROPERTY_QUALITY_FILTERS = new Set<PropertyQualityFilter>([
  "missing-designation",
  "missing-municipality",
])

const SERVICEPARTNER_QUALITY_FILTERS = new Set<ServicePartnerQualityFilter>([
  "missing-company-certificate",
  "expired-company-certificate",
])

const TECHNICIAN_QUALITY_FILTERS = new Set<TechnicianQualityFilter>([
  "missing-technician-certificate",
  "expired-technician-certificate",
])

export function getInstallationQualityFilter(
  value: string | null
): InstallationQualityFilter | null {
  return INSTALLATION_QUALITY_FILTERS.has(value as InstallationQualityFilter)
    ? (value as InstallationQualityFilter)
    : null
}

export function getPropertyQualityFilter(
  value: string | null
): PropertyQualityFilter | null {
  return PROPERTY_QUALITY_FILTERS.has(value as PropertyQualityFilter)
    ? (value as PropertyQualityFilter)
    : null
}

export function getServicePartnerQualityFilter(
  value: string | null
): ServicePartnerQualityFilter | null {
  return SERVICEPARTNER_QUALITY_FILTERS.has(value as ServicePartnerQualityFilter)
    ? (value as ServicePartnerQualityFilter)
    : null
}

export function getTechnicianQualityFilter(
  value: string | null
): TechnicianQualityFilter | null {
  return TECHNICIAN_QUALITY_FILTERS.has(value as TechnicianQualityFilter)
    ? (value as TechnicianQualityFilter)
    : null
}

export function matchesInstallationQualityFilter(
  installation: {
    co2eTon?: number | null
    propertyId?: string | null
    refrigerantAmount?: number | null
    refrigerantType?: string | null
  },
  filter: InstallationQualityFilter | null
) {
  if (!filter) return true

  switch (filter) {
    case "missing-property":
      return !installation.propertyId
    case "missing-refrigerant":
      return !installation.refrigerantType?.trim()
    case "missing-charge":
      return (
        installation.refrigerantAmount == null ||
        installation.refrigerantAmount <= 0
      )
    case "missing-gwp":
      if (!installation.refrigerantType?.trim()) return false
      if (
        installation.refrigerantAmount == null ||
        installation.refrigerantAmount <= 0
      ) {
        return false
      }
      return (
        installation.co2eTon == null ||
        calculateInstallationCompliance(
          installation.refrigerantType,
          installation.refrigerantAmount
        ).co2eKg === null
      )
  }
}

export function matchesPropertyQualityFilter(
  property: {
    municipality?: string | null
    propertyDesignation?: string | null
  },
  filter: PropertyQualityFilter | null
) {
  if (!filter) return true

  switch (filter) {
    case "missing-designation":
      return !property.propertyDesignation?.trim()
    case "missing-municipality":
      return !property.municipality?.trim()
  }
}

export function matchesServicePartnerQualityFilter(
  certificationStatus: string | null | undefined,
  filter: ServicePartnerQualityFilter | null
) {
  if (!filter) return true

  switch (filter) {
    case "missing-company-certificate":
      return certificationStatus === "MISSING"
    case "expired-company-certificate":
      return certificationStatus === "EXPIRED"
  }
}

export function matchesTechnicianQualityFilter(
  certificationStatus: string | null | undefined,
  filter: TechnicianQualityFilter | null
) {
  if (!filter) return true

  switch (filter) {
    case "missing-technician-certificate":
      return certificationStatus === "MISSING"
    case "expired-technician-certificate":
      return certificationStatus === "EXPIRED"
  }
}
