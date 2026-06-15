import {
  DATA_QUALITY_ISSUE_ROUTES,
  type DataQualityIssue,
  type DataQualityIssueId,
} from "@/lib/dashboard/data-quality"

export type AnnualReportReadinessStatus =
  | "complete"
  | "needs_action"
  | "recommended"

export type AnnualReportReadinessItem = {
  key:
    | "properties"
    | "propertyDesignation"
    | "linkedInstallations"
    | "refrigerant"
    | "charge"
    | "gwp"
    | "events"
    | "certifications"
  label: string
  description: string
  status: AnnualReportReadinessStatus
  requirement: "required" | "recommended"
  ctaHref: string
  ctaLabel: string
  issueCount?: number
}

export type AnnualReportReadinessSummary = {
  previewStatus: "can_preview" | "needs_data" | "empty"
  signingStatus: "ready_to_sign" | "needs_review" | "empty"
  status: "ready" | "needs_data" | "empty"
  completedRequiredCount: number
  requiredCount: number
  issueCount: number
  items: AnnualReportReadinessItem[]
  primaryCta: {
    href: string
    label: string
  }
}

type AnnualReportReadinessProperty = {
  id: string
  propertyDesignation?: string | null
}

type AnnualReportReadinessOverview = {
  properties: Array<{ id: string }>
}

export function buildAnnualReportReadinessSummary({
  dataQualityIssues = [],
  overview,
  properties = [],
}: {
  dataQualityIssues?: DataQualityIssue[]
  overview?: AnnualReportReadinessOverview | null
  properties?: AnnualReportReadinessProperty[]
}): AnnualReportReadinessSummary {
  const issueCounts = new Map<DataQualityIssueId, number>(
    dataQualityIssues.map((issue) => [issue.id, issue.count])
  )
  const propertyCount = properties.length
  const overviewPropertyCount = overview?.properties.length ?? 0
  const missingDesignationCount =
    issueCounts.get("PROPERTY_MISSING_DESIGNATION") ??
    properties.filter((property) => !property.propertyDesignation?.trim()).length
  const missingPropertyCount =
    issueCounts.get("INSTALLATION_MISSING_PROPERTY") ?? 0
  const certificationIssueCount =
    (issueCounts.get("SERVICEPARTNER_CERTIFICATE_MISSING") ?? 0) +
    (issueCounts.get("SERVICEPARTNER_CERTIFICATE_EXPIRED") ?? 0) +
    (issueCounts.get("TECHNICIAN_CERTIFICATE_MISSING") ?? 0) +
    (issueCounts.get("TECHNICIAN_CERTIFICATE_EXPIRED") ?? 0)

  const items: AnnualReportReadinessItem[] = [
    {
      key: "properties",
      label: "Minst en fastighet",
      description:
        propertyCount > 0
          ? "Det finns fastigheter att skapa årsrapport för."
          : "Börja med att lägga till eller importera fastigheter.",
      status: propertyCount > 0 ? "complete" : "needs_action",
      requirement: "required",
      ctaHref: propertyCount > 0 ? "/dashboard/properties" : "/dashboard/properties/import",
      ctaLabel: propertyCount > 0 ? "Visa fastigheter" : "Importera fastigheter",
      issueCount: propertyCount > 0 ? undefined : 1,
    },
    {
      key: "propertyDesignation",
      label: "Fastighetsbeteckning",
      description:
        missingDesignationCount > 0
          ? "Fastighetsbeteckning behövs i årsrapportens fastighetsunderlag."
          : "Fastighetsbeteckningar finns för fastigheterna.",
      status:
        propertyCount > 0 && missingDesignationCount === 0
          ? "complete"
          : "needs_action",
      requirement: "required",
      ctaHref: DATA_QUALITY_ISSUE_ROUTES.PROPERTY_MISSING_DESIGNATION,
      ctaLabel: "Öppna registerstatus",
      issueCount: missingDesignationCount || (propertyCount > 0 ? undefined : 1),
    },
    {
      key: "linkedInstallations",
      label: "Aggregat kopplade till fastighet",
      description:
        overviewPropertyCount > 0 && missingPropertyCount === 0
          ? "Aggregat finns kopplade till fastigheter i årsöversikten."
          : missingPropertyCount > 0
            ? "Vissa aggregat saknar fastighetskoppling och behöver kompletteras."
            : "Importera eller skapa aggregat och koppla dem till rätt fastighet.",
      status:
        overviewPropertyCount > 0 && missingPropertyCount === 0
          ? "complete"
          : "needs_action",
      requirement: "required",
      ctaHref:
        missingPropertyCount > 0
          ? DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_PROPERTY
          : "/dashboard/installations/import",
      ctaLabel:
        missingPropertyCount > 0 ? "Öppna registerstatus" : "Importera aggregat",
      issueCount:
        missingPropertyCount || (overviewPropertyCount > 0 ? undefined : 1),
    },
    buildQualityItem({
      completeDescription: "Köldmedium finns angivet för aggregaten.",
      ctaLabel: "Öppna registerstatus",
      id: "INSTALLATION_MISSING_REFRIGERANT",
      issueCounts,
      key: "refrigerant",
      label: "Köldmedium",
      missingDescription:
        "Köldmedium behövs för kontrollplikt, GWP och CO₂e-beräkning.",
    }),
    buildQualityItem({
      completeDescription: "Fyllnadsmängd finns angiven där den behövs.",
      ctaLabel: "Öppna registerstatus",
      id: "INSTALLATION_MISSING_CHARGE",
      issueCounts,
      key: "charge",
      label: "Fyllnadsmängd",
      missingDescription:
        "Fyllnadsmängd behövs för CO₂e och kontrollintervall.",
    }),
    buildQualityItem({
      completeDescription: "GWP/CO₂e kan beräknas för kända köldmedier.",
      ctaLabel: "Öppna registerstatus",
      id: "INSTALLATION_MISSING_GWP",
      issueCounts,
      key: "gwp",
      label: "Beräknad CO₂e/GWP",
      missingDescription:
        "Okänt GWP gör årsrapportens CO₂e-underlag osäkert.",
    }),
    {
      key: "events",
      label: "Kontrollhistorik och händelser",
      description:
        "Importera kontroller, läckage, påfyllningar och servicehändelser där historik finns.",
      status: "recommended",
      requirement: "recommended",
      ctaHref: "/dashboard/installations/import-events",
      ctaLabel: "Importera händelser",
    },
    {
      key: "certifications",
      label: "Servicepartner och certifikat",
      description:
        certificationIssueCount > 0
          ? "Certifikat påverkar kvalitet och spårbarhet, men är inte alltid ett hårt exportkrav."
          : "Servicepartner- och certifikatuppgifter stödjer spårbarhet i rapportarbetet.",
      status: certificationIssueCount > 0 ? "recommended" : "complete",
      requirement: "recommended",
      ctaHref:
        certificationIssueCount > 0
          ? "/dashboard/contractors?quality=missing-company-certificate"
          : "/dashboard/contractors",
      ctaLabel: "Visa servicepartners",
      issueCount: certificationIssueCount || undefined,
    },
  ]

  const requiredItems = items.filter((item) => item.requirement === "required")
  const completedRequiredCount = requiredItems.filter(
    (item) => item.status === "complete"
  ).length
  const issueCount = requiredItems.reduce(
    (sum, item) => sum + (item.status === "needs_action" ? item.issueCount ?? 1 : 0),
    0
  )

  const previewStatus =
    propertyCount === 0
      ? "empty"
      : completedRequiredCount === requiredItems.length
        ? "can_preview"
        : "needs_data"
  const signingStatus =
    previewStatus === "empty"
      ? "empty"
      : previewStatus === "can_preview" && certificationIssueCount === 0
        ? "ready_to_sign"
        : "needs_review"
  const firstMissingRequiredItem = requiredItems.find(
    (item) => item.status === "needs_action"
  )

  return {
    completedRequiredCount,
    issueCount,
    items,
    previewStatus,
    primaryCta: firstMissingRequiredItem
      ? {
          href: firstMissingRequiredItem.ctaHref,
          label: firstMissingRequiredItem.ctaLabel,
        }
      : {
          href: "#annual-report-overview",
          label: "Välj fastighet",
        },
    requiredCount: requiredItems.length,
    signingStatus,
    status:
      propertyCount === 0
        ? "empty"
        : completedRequiredCount === requiredItems.length
          ? "ready"
          : "needs_data",
  }
}

function buildQualityItem({
  completeDescription,
  ctaLabel,
  id,
  issueCounts,
  key,
  label,
  missingDescription,
}: {
  completeDescription: string
  ctaLabel: string
  id: DataQualityIssueId
  issueCounts: Map<DataQualityIssueId, number>
  key: AnnualReportReadinessItem["key"]
  label: string
  missingDescription: string
}): AnnualReportReadinessItem {
  const issueCount = issueCounts.get(id) ?? 0

  return {
    key,
    label,
    description: issueCount > 0 ? missingDescription : completeDescription,
    status: issueCount > 0 ? "needs_action" : "complete",
    requirement: "required",
    ctaHref: DATA_QUALITY_ISSUE_ROUTES[id],
    ctaLabel,
    issueCount: issueCount || undefined,
  }
}
