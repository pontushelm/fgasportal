export type DashboardSetupInput = {
  actionItemCount?: number
  actionsReviewed?: boolean
  annualReportPageVisited?: boolean
  annualReportPreviewReviewed?: boolean
  annualReportReadinessSatisfied?: boolean
  companyInfoCompleted: boolean
  dataQualityIssueCount?: number
  eventCount?: number
  installationCount: number
  installationsMissingPropertyCount: number
  propertyCount: number
  servicePartnerConnected: boolean
  servicePartnerSkipped?: boolean
}

export type DashboardSetupStepId =
  | "company"
  | "properties"
  | "installations"
  | "installationProperties"
  | "events"
  | "dataQuality"
  | "servicePartner"
  | "actions"
  | "reports"

export type DashboardSetupStep = {
  id: DashboardSetupStepId
  title: string
  description: string
  completed: boolean
  optional?: boolean
  route: string
  ctaLabel: string
}

export type DashboardSetupProgress = {
  completedCount: number
  totalCount: number
  percent: number
  nextStep: DashboardSetupStep | null
  steps: DashboardSetupStep[]
  isComplete: boolean
}

export function buildDashboardSetupSteps({
  actionItemCount = 0,
  actionsReviewed = false,
  annualReportPageVisited = false,
  annualReportPreviewReviewed = false,
  annualReportReadinessSatisfied = false,
  companyInfoCompleted,
  dataQualityIssueCount = 0,
  eventCount = 0,
  installationCount,
  installationsMissingPropertyCount,
  propertyCount,
  servicePartnerConnected,
  servicePartnerSkipped = false,
}: DashboardSetupInput): DashboardSetupStep[] {
  const hasInstallations = installationCount > 0
  const actionsCompleted = actionItemCount === 0 || actionsReviewed
  const annualReportCompleted =
    annualReportPreviewReviewed ||
    (annualReportReadinessSatisfied && annualReportPageVisited)

  return [
    {
      id: "company",
      title: "Komplettera företagsuppgifter",
      description:
        "Operatörsuppgifter används i rapporter, inbjudningar och kontaktinformation.",
      completed: companyInfoCompleted,
      route: "/dashboard/company",
      ctaLabel: "Gå till företagsinställningar",
    },
    {
      id: "properties",
      title: "Importera fastigheter",
      description: "Årsrapporter och uppföljning görs per fastighet.",
      completed: propertyCount > 0,
      route: "/dashboard/properties/import",
      ctaLabel: "Importera fastigheter",
    },
    {
      id: "installations",
      title: "Importera aggregat",
      description:
        "Aggregatregistret är grunden för kontrollintervall, risk och rapportering.",
      completed: hasInstallations,
      route: "/dashboard/installations/import",
      ctaLabel: "Importera aggregat",
    },
    {
      id: "installationProperties",
      title: "Koppla aggregat till fastigheter",
      description:
        "Kopplingen behövs för fastighetsvisa rapporter och tydlig uppföljning.",
      completed: hasInstallations && installationsMissingPropertyCount === 0,
      route:
        installationsMissingPropertyCount > 0
          ? "/dashboard/installations?quality=missing-property"
          : "/dashboard/installations",
      ctaLabel: "Koppla aggregat",
    },
    {
      id: "events",
      title: "Importera kontrollhistorik",
      description:
        "Kontroller, läckage och påfyllningar gör rapportunderlaget mer komplett.",
      completed: hasInstallations && eventCount > 0,
      route: "/dashboard/installations/import-events",
      ctaLabel: "Importera händelser",
    },
    {
      id: "dataQuality",
      title: "Granska datakvalitet",
      description:
        "Datakvalitet visar saknade uppgifter som kan hindra eller försvaga årsrapporten.",
      completed: hasInstallations && dataQualityIssueCount === 0,
      route: "/dashboard/data-quality",
      ctaLabel: "Granska datakvalitet",
    },
    {
      id: "servicePartner",
      title: "Bjud in servicepartner",
      description: "Servicepartners kan arbeta direkt i operatörens register.",
      completed: servicePartnerConnected || servicePartnerSkipped,
      optional: true,
      route: "/dashboard/contractors",
      ctaLabel: "Gå till servicepartners",
    },
    {
      id: "actions",
      title: "Granska åtgärder",
      description:
        actionItemCount > 0
          ? "Åtgärder visar vad som behöver hanteras först."
          : "Det finns inga åtgärder att granska just nu.",
      completed: actionsCompleted,
      route: "/dashboard/actions",
      ctaLabel: "Visa åtgärder",
    },
    {
      id: "reports",
      title: "Förhandsgranska årsrapport",
      description: "Kontrollera att rapportunderlaget fungerar per fastighet.",
      completed: annualReportCompleted,
      route: "/dashboard/reports",
      ctaLabel: "Förhandsgranska årsrapport",
    },
  ]
}

export function buildDashboardSetupProgress(
  input: DashboardSetupInput
): DashboardSetupProgress {
  const steps = buildDashboardSetupSteps(input)
  const completedCount = steps.filter((step) => step.completed).length
  const totalCount = steps.length
  const isComplete = completedCount === totalCount

  return {
    completedCount,
    totalCount,
    percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100,
    nextStep: steps.find((step) => !step.completed) ?? null,
    steps,
    isComplete,
  }
}
