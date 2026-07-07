export type DashboardSetupStepId =
  | "dashboard"
  | "company"
  | "colleagues"
  | "properties"
  | "installations"
  | "installationProperties"
  | "events"
  | "dataQuality"
  | "servicePartner"
  | "actions"
  | "reports"
  | "documentsEvents"
  | "personalOverview"
  | "contractorDashboard"
  | "assignedInstallations"
  | "registerServiceEvent"
  | "certificateStatus"
  | "servicePartnerSetup"

export type DashboardSetupRole = "OWNER" | "ADMIN" | "MEMBER" | "CONTRACTOR"

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
  role?: DashboardSetupRole | null
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

export function buildDashboardSetupSteps(input: DashboardSetupInput): DashboardSetupStep[] {
  const {
    actionItemCount = 0,
    annualReportReadinessSatisfied = false,
    companyInfoCompleted,
    completedStepIds = [],
    dataQualityIssueCount = 0,
    installationCount,
    propertyCount,
    role,
    servicePartnerConnected,
  } = input
  const completedSteps = new Set(completedStepIds)
  const isCompleted = (stepId: DashboardSetupStepId) => completedSteps.has(stepId)

  if (role === "MEMBER") {
    return buildMemberSetupSteps({
      actionItemCount,
      annualReportReadinessSatisfied,
      installationCount,
      isCompleted,
    })
  }

  if (role === "CONTRACTOR") {
    return buildContractorSetupSteps({
      actionItemCount,
      installationCount,
      isCompleted,
    })
  }

  return buildAdminSetupSteps({
    actionItemCount,
    annualReportReadinessSatisfied,
    companyInfoCompleted,
    dataQualityIssueCount,
    installationCount,
    isCompleted,
    propertyCount,
    servicePartnerConnected,
  })
}

function buildAdminSetupSteps({
  actionItemCount,
  annualReportReadinessSatisfied,
  companyInfoCompleted,
  dataQualityIssueCount,
  installationCount,
  isCompleted,
  propertyCount,
  servicePartnerConnected,
}: {
  actionItemCount: number
  annualReportReadinessSatisfied: boolean
  companyInfoCompleted: boolean
  dataQualityIssueCount: number
  installationCount: number
  isCompleted: (stepId: DashboardSetupStepId) => boolean
  propertyCount: number
  servicePartnerConnected: boolean
}): DashboardSetupStep[] {
  return [
    {
      id: "dashboard",
      title: "Förstå dashboarden",
      description:
        "Börja med översikten för registerstatus, åtgärder, kontroller och rapportläge.",
      completed: isCompleted("dashboard"),
      route: "/dashboard",
      ctaLabel: "Öppna dashboarden",
    },
    {
      id: "properties",
      title: "Lägg till eller importera fastigheter",
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
      title: "Lägg till eller importera aggregat",
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
      id: "colleagues",
      title: "Bjud in kollegor",
      description:
        "Lägg till personer som ska kunna granska register, rapporter och åtgärder.",
      completed: isCompleted("colleagues"),
      route: "/dashboard/company",
      ctaLabel: "Hantera användare",
    },
    {
      id: "servicePartner",
      title: "Koppla eller bjud in servicepartner",
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
      id: "reports",
      title: "Granska årsrapportens underlag",
      description: annualReportReadinessSatisfied
        ? "Rapportunderlaget är redo. Öppna rapporter och förhandsgranska resultatet."
        : "Kontrollera rapportunderlaget och se vad som återstår per fastighet.",
      completed: isCompleted("reports"),
      route: "/dashboard/reports",
      ctaLabel: "Förhandsgranska årsrapport",
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
      id: "company",
      title: "Slutför organisationsinställningar",
      description: companyInfoCompleted
        ? "Organisationsuppgifter finns registrerade. Öppna och kontrollera att de stämmer."
        : "Operatörsuppgifter används i rapporter, inbjudningar och kontaktinformation.",
      completed: isCompleted("company"),
      route: "/dashboard/company",
      ctaLabel: companyInfoCompleted
        ? "Granska organisationen"
        : "Gå till organisationsinställningar",
    },
  ]
}

function buildMemberSetupSteps({
  actionItemCount,
  annualReportReadinessSatisfied,
  installationCount,
  isCompleted,
}: {
  actionItemCount: number
  annualReportReadinessSatisfied: boolean
  installationCount: number
  isCompleted: (stepId: DashboardSetupStepId) => boolean
}): DashboardSetupStep[] {
  return [
    {
      id: "dashboard",
      title: "Förstå dashboarden",
      description:
        "Se var du hittar läge, risker, åtgärder och årsrapportering i Polar.",
      completed: isCompleted("dashboard"),
      route: "/dashboard",
      ctaLabel: "Öppna dashboarden",
    },
    {
      id: "installations",
      title: "Granska aggregatregistret",
      description:
        installationCount > 0
          ? `${installationCount} aggregat finns att granska i registret.`
          : "Här visas aggregat när organisationen har lagt till eller importerat dem.",
      completed: isCompleted("installations"),
      route: "/dashboard/installations",
      ctaLabel: "Öppna aggregat",
    },
    {
      id: "actions",
      title: "Granska åtgärdslistan",
      description:
        actionItemCount > 0
          ? `Det finns ${actionItemCount} åtgärder att följa upp.`
          : "Öppna sidan för att se hur Polar visar uppgifter som behöver granskas.",
      completed: isCompleted("actions"),
      route: "/dashboard/actions",
      ctaLabel: "Öppna åtgärder",
    },
    {
      id: "reports",
      title: "Granska årsrapportstatus",
      description: annualReportReadinessSatisfied
        ? "Rapportunderlaget är redo för granskning."
        : "Se vad som saknas innan årsrapporten kan förhandsgranskas eller signeras.",
      completed: isCompleted("reports"),
      route: "/dashboard/reports",
      ctaLabel: "Öppna rapporter",
    },
    {
      id: "documentsEvents",
      title: "Hitta dokument och händelser",
      description:
        "Lär dig var kontroller, läckage, servicehändelser och dokument finns per aggregat.",
      completed: isCompleted("documentsEvents"),
      route: "/dashboard/installations",
      ctaLabel: "Öppna aggregat",
    },
    {
      id: "personalOverview",
      title: "Slutför personlig översikt",
      description:
        "Kontrollera dina egna inställningar och hur du vill ta emot uppföljning.",
      completed: isCompleted("personalOverview"),
      route: "/dashboard/settings",
      ctaLabel: "Öppna mina inställningar",
    },
  ]
}

function buildContractorSetupSteps({
  actionItemCount,
  installationCount,
  isCompleted,
}: {
  actionItemCount: number
  installationCount: number
  isCompleted: (stepId: DashboardSetupStepId) => boolean
}): DashboardSetupStep[] {
  return [
    {
      id: "contractorDashboard",
      title: "Förstå servicepartnerdashboarden",
      description:
        "Se tilldelade kunder, uppdrag, kontroller och uppföljning från ett ställe.",
      completed: isCompleted("contractorDashboard"),
      route: "/dashboard/service",
      ctaLabel: "Öppna dashboarden",
    },
    {
      id: "assignedInstallations",
      title: "Granska tilldelade aggregat",
      description:
        installationCount > 0
          ? `${installationCount} aggregat är tillgängliga för ditt servicearbete.`
          : "När kunder tilldelar aggregat visas de här.",
      completed: isCompleted("assignedInstallations"),
      route: "/dashboard/installations",
      ctaLabel: "Öppna tilldelade aggregat",
    },
    {
      id: "registerServiceEvent",
      title: "Registrera kontroll eller service",
      description:
        "Lär dig var du registrerar kontroller, läckage, service och reparationer.",
      completed: isCompleted("registerServiceEvent"),
      route: "/dashboard/installations",
      ctaLabel: "Öppna aggregat",
    },
    {
      id: "certificateStatus",
      title: "Granska certifikatstatus",
      description:
        "Kontrollera personligt F-gascertifikat och komplettera dokument vid behov.",
      completed: isCompleted("certificateStatus"),
      route: "/dashboard/settings",
      ctaLabel: "Öppna certifikat",
    },
    {
      id: "actions",
      title: "Granska öppna uppdrag",
      description:
        actionItemCount > 0
          ? `Det finns ${actionItemCount} åtgärder att följa upp.`
          : "Öppna åtgärder för att se hur Polar prioriterar servicearbete.",
      completed: isCompleted("actions"),
      route: "/dashboard/actions",
      ctaLabel: "Öppna åtgärder",
    },
    {
      id: "servicePartnerSetup",
      title: "Slutför servicepartnerinställningar",
      description:
        "Granska tekniker, certifikat och servicepartnerprofilen för organisationen.",
      completed: isCompleted("servicePartnerSetup"),
      route: "/dashboard/service",
      ctaLabel: "Öppna servicepartner",
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
