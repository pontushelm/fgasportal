export type DashboardSetupInput = {
  actionsReviewed?: boolean
  annualReportPreviewReviewed?: boolean
  companyInfoCompleted: boolean
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
  actionsReviewed = false,
  annualReportPreviewReviewed = false,
  companyInfoCompleted,
  installationCount,
  installationsMissingPropertyCount,
  propertyCount,
  servicePartnerConnected,
  servicePartnerSkipped = false,
}: DashboardSetupInput): DashboardSetupStep[] {
  const hasInstallations = installationCount > 0

  return [
    {
      id: "company",
      title: "Komplettera företagsuppgifter",
      description: "Operatörsuppgifter används i rapporter, inbjudningar och kontaktinformation.",
      completed: companyInfoCompleted,
      route: "/dashboard/company",
      ctaLabel: "Gå till företagsinställningar",
    },
    {
      id: "properties",
      title: "Lägg till fastigheter",
      description: "Årsrapporter och uppföljning görs per fastighet.",
      completed: propertyCount > 0,
      route: "/dashboard/properties",
      ctaLabel: "Gå till fastigheter",
    },
    {
      id: "installations",
      title: "Lägg till aggregat",
      description: "Aggregatregistret är grunden för kontrollintervall, risk och rapportering.",
      completed: hasInstallations,
      route: "/dashboard/installations",
      ctaLabel: "Gå till aggregat",
    },
    {
      id: "installationProperties",
      title: "Koppla aggregat till fastigheter",
      description: "Kopplingen behövs för fastighetsvisa rapporter och tydlig uppföljning.",
      completed: hasInstallations && installationsMissingPropertyCount === 0,
      route: "/dashboard/installations",
      ctaLabel: "Koppla aggregat",
    },
    {
      id: "servicePartner",
      title: "Koppla servicepartner",
      description: "Servicepartners kan arbeta direkt i operatörens register.",
      completed: servicePartnerConnected || servicePartnerSkipped,
      optional: true,
      route: "/dashboard/contractors",
      ctaLabel: "Gå till servicepartners",
    },
    {
      id: "actions",
      title: "Granska åtgärder",
      description: "Åtgärder visar vad som behöver hanteras först.",
      completed: actionsReviewed,
      route: "/dashboard/actions",
      ctaLabel: "Visa åtgärder",
    },
    {
      id: "reports",
      title: "Förhandsgranska årsrapport",
      description: "Kontrollera att rapportunderlaget fungerar per fastighet.",
      completed: annualReportPreviewReviewed,
      route: "/dashboard/reports",
      ctaLabel: "Gå till rapporter",
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
