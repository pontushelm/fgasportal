import { calculateInstallationCompliance } from "@/lib/fgas-calculations"

export type DataQualitySeverity = "HIGH" | "MEDIUM" | "LOW"

export type DataQualityIssueId =
  | "PROPERTY_MISSING_DESIGNATION"
  | "PROPERTY_MISSING_MUNICIPALITY"
  | "INSTALLATION_MISSING_PROPERTY"
  | "INSTALLATION_MISSING_REFRIGERANT"
  | "INSTALLATION_MISSING_CHARGE"
  | "INSTALLATION_MISSING_GWP"
  | "SERVICEPARTNER_CERTIFICATE_MISSING"
  | "SERVICEPARTNER_CERTIFICATE_EXPIRED"
  | "TECHNICIAN_CERTIFICATE_MISSING"
  | "TECHNICIAN_CERTIFICATE_EXPIRED"

export type DataQualityGroupId =
  | "properties"
  | "installations"
  | "servicepartners"
  | "technicians"

export type DataQualityIssue = {
  id: DataQualityIssueId
  group: DataQualityGroupId
  title: string
  description: string
  count: number
  severity: DataQualitySeverity
  route: string
  ctaLabel: string
}

export const DATA_QUALITY_ISSUE_ROUTES: Record<DataQualityIssueId, string> = {
  INSTALLATION_MISSING_CHARGE: "/dashboard/installations?quality=missing-charge",
  INSTALLATION_MISSING_GWP: "/dashboard/installations?quality=missing-gwp",
  INSTALLATION_MISSING_PROPERTY: "/dashboard/installations?quality=missing-property",
  INSTALLATION_MISSING_REFRIGERANT:
    "/dashboard/installations?quality=missing-refrigerant",
  PROPERTY_MISSING_DESIGNATION:
    "/dashboard/properties?quality=missing-designation",
  PROPERTY_MISSING_MUNICIPALITY:
    "/dashboard/properties?quality=missing-municipality",
  SERVICEPARTNER_CERTIFICATE_EXPIRED:
    "/dashboard/contractors?quality=expired-company-certificate",
  SERVICEPARTNER_CERTIFICATE_MISSING:
    "/dashboard/contractors?quality=missing-company-certificate",
  TECHNICIAN_CERTIFICATE_EXPIRED:
    "/dashboard/contractors?quality=expired-technician-certificate",
  TECHNICIAN_CERTIFICATE_MISSING:
    "/dashboard/contractors?quality=missing-technician-certificate",
}

export type DataQualityReport = {
  score: number
  totalIssueCount: number
  issueCategoryCount: number
  issues: DataQualityIssue[]
  topIssues: DataQualityIssue[]
  groups: Array<{
    id: DataQualityGroupId
    title: string
    issues: DataQualityIssue[]
    totalIssueCount: number
  }>
}

export type DataQualityPropertyInput = {
  municipality?: string | null
  propertyDesignation?: string | null
}

export type DataQualityInstallationInput = {
  propertyId?: string | null
  refrigerantAmount?: number | null
  refrigerantType?: string | null
}

export type DataQualityCertificationInput = {
  certificateNumber?: string | null
  validUntil?: Date | string | null
}

const GROUP_LABELS: Record<DataQualityGroupId, string> = {
  installations: "Aggregat",
  properties: "Fastigheter",
  servicepartners: "Servicepartners",
  technicians: "Tekniker",
}

const SCORE_DEDUCTION: Record<DataQualitySeverity, number> = {
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5,
}

const SEVERITY_RANK: Record<DataQualitySeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

export function buildDataQualityReport({
  installations,
  properties,
  servicePartnerCertifications = [],
  technicianCertifications = [],
}: {
  installations: DataQualityInstallationInput[]
  properties: DataQualityPropertyInput[]
  servicePartnerCertifications?: DataQualityCertificationInput[]
  technicianCertifications?: DataQualityCertificationInput[]
}): DataQualityReport {
  const issues = [
    buildIssue({
      count: properties.filter((property) => !property.propertyDesignation?.trim()).length,
      description: "Fastighetsbeteckning behövs framför allt för årsrapportering.",
      group: "properties",
      id: "PROPERTY_MISSING_DESIGNATION",
      route: DATA_QUALITY_ISSUE_ROUTES.PROPERTY_MISSING_DESIGNATION,
      severity: "HIGH",
      title: "Fastigheter saknar fastighetsbeteckning",
      ctaLabel: "Visa fastigheter",
    }),
    buildIssue({
      count: properties.filter((property) => !property.municipality?.trim()).length,
      description: "Kommun används i rapporter och uppföljning per fastighet.",
      group: "properties",
      id: "PROPERTY_MISSING_MUNICIPALITY",
      route: DATA_QUALITY_ISSUE_ROUTES.PROPERTY_MISSING_MUNICIPALITY,
      severity: "MEDIUM",
      title: "Fastigheter saknar kommun",
      ctaLabel: "Visa fastigheter",
    }),
    buildIssue({
      count: installations.filter((installation) => !installation.propertyId).length,
      description: "Aggregat behöver kopplas till fastighet för rapportering och översikt.",
      group: "installations",
      id: "INSTALLATION_MISSING_PROPERTY",
      route: DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_PROPERTY,
      severity: "HIGH",
      title: "Aggregat saknar fastighet",
      ctaLabel: "Visa aggregat",
    }),
    buildIssue({
      count: installations.filter(
        (installation) => !installation.refrigerantType?.trim()
      ).length,
      description: "Köldmedium behövs för GWP, CO₂e och kontrollplikt.",
      group: "installations",
      id: "INSTALLATION_MISSING_REFRIGERANT",
      route: DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_REFRIGERANT,
      severity: "HIGH",
      title: "Aggregat saknar köldmedium",
      ctaLabel: "Visa aggregat",
    }),
    buildIssue({
      count: installations.filter(
        (installation) =>
          installation.refrigerantAmount == null ||
          installation.refrigerantAmount <= 0
      ).length,
      description: "Fyllnadsmängd behövs för CO₂e och kontrollintervall.",
      group: "installations",
      id: "INSTALLATION_MISSING_CHARGE",
      route: DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_CHARGE,
      severity: "HIGH",
      title: "Aggregat saknar fyllnadsmängd",
      ctaLabel: "Visa aggregat",
    }),
    buildIssue({
      count: installations.filter((installation) => {
        if (!installation.refrigerantType?.trim()) return false
        if (installation.refrigerantAmount == null || installation.refrigerantAmount <= 0) {
          return false
        }
        return (
          calculateInstallationCompliance(
            installation.refrigerantType,
            installation.refrigerantAmount
          ).co2eKg === null
        )
      }).length,
      description: "Okänt GWP gör CO₂e och kontrollplikt osäkra.",
      group: "installations",
      id: "INSTALLATION_MISSING_GWP",
      route: DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_GWP,
      severity: "HIGH",
      title: "Aggregat saknar känt GWP/CO₂e",
      ctaLabel: "Visa aggregat",
    }),
    buildIssue({
      count: servicePartnerCertifications.filter(
        (certification) => !certification.certificateNumber?.trim()
      ).length,
      description: "Företagscertifikat behövs för uppföljning av servicepartner.",
      group: "servicepartners",
      id: "SERVICEPARTNER_CERTIFICATE_MISSING",
      route: DATA_QUALITY_ISSUE_ROUTES.SERVICEPARTNER_CERTIFICATE_MISSING,
      severity: "MEDIUM",
      title: "Servicepartner saknar företagscertifikat",
      ctaLabel: "Visa servicepartners",
    }),
    buildIssue({
      count: servicePartnerCertifications.filter((certification) =>
        isExpired(certification.validUntil)
      ).length,
      description: "Utgångna företagscertifikat bör följas upp innan fortsatt arbete.",
      group: "servicepartners",
      id: "SERVICEPARTNER_CERTIFICATE_EXPIRED",
      route: DATA_QUALITY_ISSUE_ROUTES.SERVICEPARTNER_CERTIFICATE_EXPIRED,
      severity: "HIGH",
      title: "Servicepartnercertifikat har gått ut",
      ctaLabel: "Visa servicepartners",
    }),
    buildIssue({
      count: technicianCertifications.filter(
        (certification) => !certification.certificateNumber?.trim()
      ).length,
      description: "Personcertifikat behövs för tydlig servicepartneruppföljning.",
      group: "technicians",
      id: "TECHNICIAN_CERTIFICATE_MISSING",
      route: DATA_QUALITY_ISSUE_ROUTES.TECHNICIAN_CERTIFICATE_MISSING,
      severity: "MEDIUM",
      title: "Tekniker saknar personcertifikat",
      ctaLabel: "Visa tekniker",
    }),
    buildIssue({
      count: technicianCertifications.filter((certification) =>
        isExpired(certification.validUntil)
      ).length,
      description: "Utgångna personcertifikat bör hanteras av servicepartneradmin.",
      group: "technicians",
      id: "TECHNICIAN_CERTIFICATE_EXPIRED",
      route: DATA_QUALITY_ISSUE_ROUTES.TECHNICIAN_CERTIFICATE_EXPIRED,
      severity: "HIGH",
      title: "Teknikercertifikat har gått ut",
      ctaLabel: "Visa tekniker",
    }),
  ].filter((issue): issue is DataQualityIssue => Boolean(issue))

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        issues.reduce(
          (sum, issue) => sum + SCORE_DEDUCTION[issue.severity],
          0
        )
    )
  )
  const sortedIssues = [...issues].sort(compareIssues)

  return {
    score,
    totalIssueCount: issues.reduce((sum, issue) => sum + issue.count, 0),
    issueCategoryCount: issues.length,
    issues: sortedIssues,
    topIssues: sortedIssues.slice(0, 3),
    groups: (Object.keys(GROUP_LABELS) as DataQualityGroupId[]).map((id) => {
      const groupIssues = sortedIssues.filter((issue) => issue.group === id)
      return {
        id,
        title: GROUP_LABELS[id],
        issues: groupIssues,
        totalIssueCount: groupIssues.reduce((sum, issue) => sum + issue.count, 0),
      }
    }),
  }
}

function buildIssue(
  issue: Omit<DataQualityIssue, "count"> & { count: number }
): DataQualityIssue | null {
  if (issue.count <= 0) return null
  return issue
}

function compareIssues(first: DataQualityIssue, second: DataQualityIssue) {
  const severityDifference =
    SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity]
  if (severityDifference !== 0) return severityDifference
  if (first.count !== second.count) return second.count - first.count
  return first.title.localeCompare(second.title, "sv")
}

function isExpired(value?: Date | string | null) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return false

  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  const validUntilStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  return validUntilStart < todayStart
}
