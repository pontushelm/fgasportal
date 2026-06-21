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

export type DashboardSetupInput = {
  actionItemCount?: number
  annualReportReadinessSatisfied?: boolean
  companyInfoCompleted: boolean
  completedStepIds?: readonly DashboardSetupStepId[]
  dataQualityIssueCount?: number
  eventCount?: number
  installationCount: number
  installationsMissingPropertyCount: number
  propertyCount: number
  servicePartnerConnected: boolean
}

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
  annualReportReadinessSatisfied = false,
  companyInfoCompleted,
  completedStepIds = [],
  dataQualityIssueCount = 0,
  eventCount = 0,
  installationCount,
  installationsMissingPropertyCount,
  propertyCount,
  servicePartnerConnected,
}: DashboardSetupInput): DashboardSetupStep[] {
  const completedSteps = new Set(completedStepIds)
  const isCompleted = (stepId: DashboardSetupStepId) =>
    completedSteps.has(stepId)

  return [
    {
      id: "company",
      title: "Komplettera företagsuppgifter",
      description: companyInfoCompleted
        ? "Företagsuppgifter finns registrerade. Öppna och kontrollera att de stämmer."
        : "Operatörsuppgifter används i rapporter, inbjudningar och kontaktinformation.",
      completed: isCompleted("company"),
      route: "/dashboard/company",
      ctaLabel: companyInfoCompleted
        ? "Granska företagsuppgifter"
        : "Gå till företagsinställningar",
    },
    {
      id: "properties",
      title: "Importera fastigheter",
      description:
        propertyCount > 0
          ? `${propertyCount} fastigheter finns i registret. Öppna och bekanta dig med dem.`
          : "Årsrapporter och uppföljning görs per fastighet.",
      completed: isCompleted("properties"),
      route:
        propertyCount > 0
          ? "/dashboard/properties"
          : "/dashboard/properties/import",
      ctaLabel: propertyCount > 0 ? "Granska fastigheter" : "Importera fastigheter",
    },
    {
      id: "installations",
      title: "Importera aggregat",
      description:
        installationCount > 0
          ? `${installationCount} aggregat finns i registret. Öppna och bekanta dig med dem.`
          : "Aggregatregistret är grunden för kontrollintervall, risk och rapportering.",
      completed: isCompleted("installations"),
      route:
        installationCount > 0
          ? "/dashboard/installations"
          : "/dashboard/installations/import",
      ctaLabel: installationCount > 0 ? "Granska aggregat" : "Importera aggregat",
    },
    {
      id: "installationProperties",
      title: "Koppla aggregat till fastigheter",
      description:
        installationCount > 0 && installationsMissingPropertyCount === 0
          ? "Alla aggregat är kopplade till en fastighet. Öppna registret och kontrollera kopplingarna."
          : "Kopplingen behövs för fastighetsvisa rapporter och tydlig uppföljning.",
      completed: isCompleted("installationProperties"),
      route:
        installationsMissingPropertyCount > 0
          ? "/dashboard/installations?quality=missing-property"
          : "/dashboard/installations",
      ctaLabel: installationsMissingPropertyCount > 0
        ? "Koppla aggregat"
        : "Granska kopplingar",
    },
    {
      id: "events",
      title: "Importera kontrollhistorik",
      description:
        eventCount > 0
          ? `${eventCount} händelser finns registrerade. Granska historiken eller komplettera den vid behov.`
          : "Rekommenderas om du har kontroller, läckage eller påfyllningar från tidigare register.",
      completed: isCompleted("events"),
      optional: true,
      route:
        eventCount > 0
          ? "/dashboard/installations"
          : "/dashboard/installations/import-events",
      ctaLabel: eventCount > 0 ? "Granska kontrollhistorik" : "Importera händelser",
    },
    {
      id: "dataQuality",
      title: "Granska registerstatus",
      description:
        dataQualityIssueCount > 0
          ? `Registerstatus visar ${dataQualityIssueCount} typer av brister att granska.`
          : "Registerstatus visar om underlaget är komplett inför uppföljning och rapportering.",
      completed: isCompleted("dataQuality"),
      route: "/dashboard/data-quality",
      ctaLabel: "Granska registerstatus",
    },
    {
      id: "servicePartner",
      title: "Bjud in servicepartner",
      description: servicePartnerConnected
        ? "En servicepartner är ansluten. Öppna sidan och kontrollera samarbetet."
        : "Servicepartners kan arbeta direkt i operatörens register.",
      completed: isCompleted("servicePartner"),
      optional: true,
      route: "/dashboard/contractors",
      ctaLabel: servicePartnerConnected
        ? "Granska servicepartner"
        : "Gå till servicepartners",
    },
    {
      id: "actions",
      title: "Granska åtgärder",
      description:
        actionItemCount > 0
          ? `Det finns ${actionItemCount} åtgärder att prioritera och följa upp.`
          : "Det finns inga åtgärder just nu. Öppna sidan för att se hur uppföljningen fungerar.",
      completed: isCompleted("actions"),
      route: "/dashboard/actions",
      ctaLabel: "Granska åtgärder",
    },
    {
      id: "reports",
      title: "Förhandsgranska årsrapport",
      description: annualReportReadinessSatisfied
        ? "Rapportunderlaget är redo. Öppna rapporter och förhandsgranska resultatet."
        : "Kontrollera rapportunderlaget och se vad som återstår per fastighet.",
      completed: isCompleted("reports"),
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
  const isComplete = steps.every((step) => step.completed)

  return {
    completedCount,
    totalCount,
    percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100,
    nextStep: steps.find((step) => !step.completed) ?? null,
    steps,
    isComplete,
  }
}
