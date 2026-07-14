import {
  DATA_QUALITY_SEVERITY_RANK,
  type DataQualityIssue,
  type DataQualityIssueId,
  type DataQualityReport,
  type DataQualitySeverity,
} from "@/lib/dashboard/data-quality"

export type RegisterStatusSectionId =
  | "report_requirements"
  | "needs_review"
  | "recommended"

export type RegisterStatusFilter = "all" | RegisterStatusSectionId

export type RegisterStatusIssuePresentation = {
  issue: DataQualityIssue
  sectionId: RegisterStatusSectionId
  whyItMatters: string
  recommendedAction: string
  impact: number
}

export type RegisterStatusSection = {
  id: RegisterStatusSectionId
  title: string
  purpose: string
  tone: "danger" | "warning" | "neutral"
  count: number
  issueCategoryCount: number
  issues: RegisterStatusIssuePresentation[]
}

export type RegisterStatusPresentation = {
  scoreExplanation: {
    summary: string
    factors: string[]
  }
  sections: RegisterStatusSection[]
  summary: Array<{
    id: RegisterStatusSectionId
    label: string
    count: number
    tone: RegisterStatusSection["tone"]
  }>
}

export const REGISTER_STATUS_FILTER_LABELS: Record<RegisterStatusFilter, string> = {
  all: "Alla",
  needs_review: "Behöver granskas",
  recommended: "Rekommenderas",
  report_requirements: "Krav inför rapport",
}

const SECTION_DEFINITIONS: Record<
  RegisterStatusSectionId,
  Pick<RegisterStatusSection, "id" | "purpose" | "title" | "tone">
> = {
  needs_review: {
    id: "needs_review",
    purpose: "Frågor där Polar inte kan avgöra något med full säkerhet.",
    title: "Behöver granskas",
    tone: "warning",
  },
  recommended: {
    id: "recommended",
    purpose: "Förbättringar som gör registret tydligare men inte blockerar rapportering just nu.",
    title: "Rekommenderas",
    tone: "neutral",
  },
  report_requirements: {
    id: "report_requirements",
    purpose: "Brister som kan stoppa eller påverka korrekt rapportering.",
    title: "Krav inför rapport",
    tone: "danger",
  },
}

const ISSUE_PRESENTATION: Record<
  DataQualityIssueId,
  {
    impact: number
    recommendedAction: string
    sectionId: RegisterStatusSectionId
    whyItMatters: string
  }
> = {
  INSTALLATION_MISSING_CHARGE: {
    impact: 95,
    recommendedAction: "Komplettera aggregatet med fyllnadsmängd.",
    sectionId: "report_requirements",
    whyItMatters:
      "Fyllnadsmängd behövs för att beräkna CO₂e, kontrollintervall och rapportunderlag.",
  },
  INSTALLATION_MISSING_GWP: {
    impact: 90,
    recommendedAction: "Kontrollera köldmedium eller GWP-värde.",
    sectionId: "report_requirements",
    whyItMatters:
      "Utan känt GWP kan Polar inte beräkna CO₂e och rapporteringsunderlaget blir osäkert.",
  },
  INSTALLATION_MISSING_PROPERTY: {
    impact: 100,
    recommendedAction: "Koppla aggregatet till rätt fastighet.",
    sectionId: "report_requirements",
    whyItMatters:
      "Stationära aggregat behöver fastighetskoppling för årsrapportering och uppföljning.",
  },
  INSTALLATION_MISSING_REFRIGERANT: {
    impact: 95,
    recommendedAction: "Komplettera aggregatet med köldmedium.",
    sectionId: "report_requirements",
    whyItMatters:
      "Polar kan inte avgöra kontroll- eller rapportkrav utan köldmedium och fyllnadsmängd.",
  },
  INSTALLATION_MOBILE_MISSING_CONTEXT: {
    impact: 30,
    recommendedAction: "Ange placering, depå eller bas.",
    sectionId: "recommended",
    whyItMatters:
      "Placering gör mobila aggregat enklare att hitta, följa upp och lämna över mellan personer.",
  },
  INSTALLATION_MOBILE_MISSING_IDENTIFIER: {
    impact: 35,
    recommendedAction: "Ange enhets-ID, inventarienummer eller registreringsnummer.",
    sectionId: "recommended",
    whyItMatters:
      "Identifieringen behövs för att skilja mobila aggregat åt vid uppföljning.",
  },
  INSTALLATION_UNKNOWN_LEGAL_CLASSIFICATION: {
    impact: 85,
    recommendedAction: "Kontrollera köldmediets regelklassificering.",
    sectionId: "needs_review",
    whyItMatters: "Kontrollkravet kan inte fastställas automatiskt.",
  },
  INSTALLATION_VESSEL_MISSING_IDENTIFIER: {
    impact: 100,
    recommendedAction: "Ange fartygsidentifiering eller tydlig beteckning.",
    sectionId: "report_requirements",
    whyItMatters:
      "Fartygsutrustning behöver identifiering för att kunna kopplas till rätt rapporteringsobjekt.",
  },
  PROPERTY_MISSING_DESIGNATION: {
    impact: 80,
    recommendedAction: "Lägg till fastighetsbeteckning.",
    sectionId: "report_requirements",
    whyItMatters:
      "Fastighetsbeteckningen används för att identifiera fastigheten i rapportunderlag och register.",
  },
  PROPERTY_MISSING_MUNICIPALITY: {
    impact: 75,
    recommendedAction: "Lägg till kommun på fastigheten.",
    sectionId: "report_requirements",
    whyItMatters:
      "Kommun används för rapportering, mottagare och uppföljning per fastighet.",
  },
  SERVICEPARTNER_CERTIFICATE_EXPIRED: {
    impact: 65,
    recommendedAction: "Be servicepartnern uppdatera företagscertifikatet.",
    sectionId: "needs_review",
    whyItMatters:
      "Ett utgånget företagscertifikat bör granskas innan fortsatt arbete dokumenteras.",
  },
  SERVICEPARTNER_CERTIFICATE_MISSING: {
    impact: 55,
    recommendedAction: "Lägg till eller begär företagscertifikat.",
    sectionId: "needs_review",
    whyItMatters:
      "Företagscertifikat stärker spårbarheten för servicepartnerarbete.",
  },
  TECHNICIAN_CERTIFICATE_EXPIRED: {
    impact: 65,
    recommendedAction: "Be servicepartnern uppdatera teknikerns certifikat.",
    sectionId: "needs_review",
    whyItMatters:
      "Ett utgånget personcertifikat bör granskas innan teknikerns arbete följs upp.",
  },
  TECHNICIAN_CERTIFICATE_MISSING: {
    impact: 55,
    recommendedAction: "Lägg till eller begär personcertifikat.",
    sectionId: "needs_review",
    whyItMatters:
      "Personcertifikat gör det tydligare vem som utfört kontroller och service.",
  },
}

export function buildRegisterStatusPresentation(
  report: Pick<DataQualityReport, "issues">
): RegisterStatusPresentation {
  const presentedIssues = report.issues.map(presentRegisterStatusIssue)
  const sections = (
    [
      "report_requirements",
      "needs_review",
      "recommended",
    ] as RegisterStatusSectionId[]
  ).map((sectionId) => {
    const issues = presentedIssues
      .filter((issue) => issue.sectionId === sectionId)
      .sort(compareRegisterStatusIssues)
    const definition = SECTION_DEFINITIONS[sectionId]

    return {
      ...definition,
      count: issues.reduce((sum, issue) => sum + issue.issue.count, 0),
      issueCategoryCount: issues.length,
      issues,
    }
  })

  return {
    scoreExplanation: {
      factors: [
        "obligatoriska uppgifter i fastigheter och aggregat",
        "om underlaget går att använda för rapportering",
        "övergripande registerkvalitet och spårbarhet",
      ],
      summary:
        "Registerstatus visar hur komplett underlaget är för uppföljning och rapportering.",
    },
    sections,
    summary: sections.map((section) => ({
      count: section.count,
      id: section.id,
      label: section.title,
      tone: section.tone,
    })),
  }
}

export function presentRegisterStatusIssue(
  issue: DataQualityIssue
): RegisterStatusIssuePresentation {
  const presentation = ISSUE_PRESENTATION[issue.id]

  return {
    impact: presentation.impact,
    issue,
    recommendedAction: presentation.recommendedAction,
    sectionId: presentation.sectionId,
    whyItMatters: presentation.whyItMatters,
  }
}

export function filterRegisterStatusSections(
  sections: RegisterStatusSection[],
  filter: RegisterStatusFilter
) {
  if (filter === "all") return sections
  return sections.filter((section) => section.id === filter)
}

function compareRegisterStatusIssues(
  first: RegisterStatusIssuePresentation,
  second: RegisterStatusIssuePresentation
) {
  const severityDifference =
    DATA_QUALITY_SEVERITY_RANK[first.issue.severity] -
    DATA_QUALITY_SEVERITY_RANK[second.issue.severity]
  if (severityDifference !== 0) return severityDifference

  if (first.impact !== second.impact) return second.impact - first.impact

  return first.issue.title.localeCompare(second.issue.title, "sv", {
    sensitivity: "base",
  })
}

export function formatDataQualitySeverityLabel(severity: DataQualitySeverity) {
  switch (severity) {
    case "HIGH":
      return "Hög"
    case "MEDIUM":
      return "Medel"
    case "LOW":
      return "Låg"
  }
}
