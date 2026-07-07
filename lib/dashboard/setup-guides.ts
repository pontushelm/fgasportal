import type {
  DashboardSetupRole,
  DashboardSetupStep,
  DashboardSetupStepId,
} from "@/lib/dashboard/setup-assistant"

export const SETUP_GUIDE_QUERY_PARAM = "setupGuide"

export type DashboardSetupGuideStep = {
  title: string
  description: string
  selector?: string
}

export type DashboardSetupGuide = {
  id: DashboardSetupStepId
  title: string
  description: string
  steps: DashboardSetupGuideStep[]
}

const ADMIN_GUIDED_STEP_IDS = [
  "dashboard",
  "properties",
  "installations",
  "reports",
  "dataQuality",
  "actions",
  "servicePartner",
  "colleagues",
  "company",
] as const satisfies readonly DashboardSetupStepId[]

const ADMIN_GUIDED_STEP_ID_SET = new Set<DashboardSetupStepId>(
  ADMIN_GUIDED_STEP_IDS
)

type AdminGuidedStepId = (typeof ADMIN_GUIDED_STEP_IDS)[number]

export function isAdminSetupRole(role: DashboardSetupRole) {
  return role === "OWNER" || role === "ADMIN"
}

export function shouldUseSetupGuide(
  role: DashboardSetupRole,
  stepId: DashboardSetupStepId
) {
  return isAdminSetupRole(role) && ADMIN_GUIDED_STEP_ID_SET.has(stepId)
}

export function getSetupGuideHref(
  step: Pick<DashboardSetupStep, "id" | "route">
) {
  const [pathname, queryString = ""] = step.route.split("?")
  const params = new URLSearchParams(queryString)
  params.set(SETUP_GUIDE_QUERY_PARAM, step.id)
  return `${pathname}?${params.toString()}`
}

export function getDashboardSetupGuide(
  guideId: string | null
): DashboardSetupGuide | null {
  if (!isAdminGuidedStepId(guideId)) {
    return null
  }

  return DASHBOARD_SETUP_GUIDES[guideId] ?? null
}

function isAdminGuidedStepId(value: string | null): value is AdminGuidedStepId {
  return Boolean(
    value && ADMIN_GUIDED_STEP_ID_SET.has(value as DashboardSetupStepId)
  )
}

export const DASHBOARD_SETUP_GUIDES: Record<
  AdminGuidedStepId,
  DashboardSetupGuide
> = {
  dashboard: {
    id: "dashboard",
    title: "Dashboarden",
    description:
      "Här får du en snabb överblick över registerstatus, åtgärder, kontroller och rapportläge.",
    steps: [
      {
        title: "Överblick först",
        description:
          "Dashboarden visar det viktigaste läget för registret så att du snabbt ser vad som behöver uppmärksamhet.",
        selector: "main",
      },
      {
        title: "Prioriterade åtgärder",
        description:
          "Här ser du uppgifter som behöver granskas, till exempel försenade kontroller eller saknade uppgifter.",
        selector: 'a[href="/dashboard/actions"]',
      },
      {
        title: "Registerstatus",
        description:
          "Registerstatus hjälper dig hitta brister i underlaget innan rapportering eller uppföljning.",
        selector: 'a[href="/dashboard/data-quality"]',
      },
      {
        title: "Årsrapportering",
        description:
          "Rapportläget visar vilka fastigheter som kan förhandsgranskas och vad som återstår inför signering.",
        selector: 'a[href="/dashboard/reports"]',
      },
    ],
  },
  properties: {
    id: "properties",
    title: "Fastigheter",
    description:
      "Fastigheter är strukturen för rapportering, uppföljning och koppling till aggregat.",
    steps: [
      {
        title: "Rapportering per fastighet",
        description:
          "Årsrapporten skapas per fastighet. Därför är fastighetsnamn, beteckning och kommun viktiga uppgifter.",
        selector: "main",
      },
      {
        title: "Koppla aggregat",
        description:
          "När aggregat kopplas till rätt fastighet blir kontroller, CO₂e och rapportunderlag tydligare.",
      },
      {
        title: "Import eller manuell registrering",
        description:
          "Du kan börja med import om ni har data i Excel, och komplettera manuellt senare.",
      },
    ],
  },
  installations: {
    id: "installations",
    title: "Aggregatregistret",
    description:
      "Aggregatregistret är kärnan i Polar och styr kontrollintervall, risk och rapportering.",
    steps: [
      {
        title: "Kärnan i registret",
        description:
          "Här samlas aggregat, placering, köldmedium, fyllnadsmängd, CO₂e och nästa kontroll.",
        selector: "main",
      },
      {
        title: "Köldmedium och mängd",
        description:
          "Köldmedium och fyllnadsmängd avgör CO₂e, kontrollkrav och vilka risker som bör följas upp.",
      },
      {
        title: "Historik bygger spårbarhet",
        description:
          "Kontroller, läckage, service, dokument och reparationer skapar den historik som behövs vid uppföljning.",
      },
      {
        title: "Import vid start",
        description:
          "Om ni har många aggregat är import ofta snabbast. Därefter kan ni komplettera direkt i registret.",
      },
    ],
  },
  reports: {
    id: "reports",
    title: "Årsrapportens underlag",
    description:
      "Här ser du om årsrapporten kan förhandsgranskas och vad som behöver granskas innan signering.",
    steps: [
      {
        title: "Förhandsgranskning och signering",
        description:
          "Polar skiljer på att kunna förhandsgranska rapporten och att underlaget är redo för signering.",
        selector: "main",
      },
      {
        title: "Status per fastighet",
        description:
          "Årsrapporteringen visas per fastighet så att du kan se vilka delar som är redo och vilka som kräver komplettering.",
      },
      {
        title: "Exportflödet",
        description:
          "När underlaget är granskat kan rapporten förhandsgranskas, exporteras och signeras enligt ert arbetssätt.",
      },
    ],
  },
  dataQuality: {
    id: "dataQuality",
    title: "Registerstatus",
    description:
      "Registerstatus visar om underlaget är komplett och var det finns brister att åtgärda.",
    steps: [
      {
        title: "Kontroll av underlag",
        description:
          "Här grupperas saknade fastighetsuppgifter, aggregatdata och certifikatstatus i tydliga kategorier.",
        selector: "main",
      },
      {
        title: "Följ länkarna till rätt vy",
        description:
          "Varje brist länkar till en filtrerad vy där du kan granska posterna som behöver kompletteras.",
      },
      {
        title: "Använd före rapportering",
        description:
          "Gå igenom registerstatus innan årsrapportering så minskar risken för saknade uppgifter i rapporten.",
      },
    ],
  },
  actions: {
    id: "actions",
    title: "Åtgärder",
    description:
      "Åtgärdslistan hjälper dig prioritera vad som behöver följas upp i registret.",
    steps: [
      {
        title: "Prioriterad arbetslista",
        description:
          "Här visas försenade kontroller, kommande kontroller, saknad data och andra uppgifter som behöver granskas.",
        selector: "main",
      },
      {
        title: "Filtrera efter ansvar",
        description:
          "Använd filter för att fokusera på kategori, allvarlighetsgrad, fastighet eller servicepartner.",
      },
      {
        title: "Tom lista är bra",
        description:
          "Om det inte finns några åtgärder betyder det att Polar inte ser något akut att följa upp just nu.",
      },
    ],
  },
  servicePartner: {
    id: "servicePartner",
    title: "Servicepartner",
    description:
      "Servicepartner kan arbeta direkt i ert register medan ni behåller överblick och ansvar.",
    steps: [
      {
        title: "Samarbete i operatörens register",
        description:
          "Ni kan koppla eller bjuda in servicepartner till aggregat så att kontroller och händelser registreras på rätt plats.",
        selector: "main",
      },
      {
        title: "Certifikat och status",
        description:
          "Polar visar certifikatstatus och vad som saknas för att servicepartnern ska vara redo att arbeta.",
      },
      {
        title: "Ni äger registret",
        description:
          "Servicepartner kan bidra med data, men kunden behåller överblick, historik och rapportunderlag.",
      },
    ],
  },
  colleagues: {
    id: "colleagues",
    title: "Kollegor och roller",
    description:
      "Bjud in personer som ska granska, underhålla eller administrera registret.",
    steps: [
      {
        title: "Bjud in rätt personer",
        description:
          "Lägg till kollegor som behöver arbeta med fastigheter, aggregat, åtgärder eller rapporter.",
        selector: "main",
      },
      {
        title: "Använd roller med omsorg",
        description:
          "OWNER och ADMIN bör bara ges till personer som ska kunna hantera organisationsinställningar och användare.",
      },
      {
        title: "Medlemmar kan granska",
        description:
          "MEMBER passar för användare som ska följa upp register och rapportstatus utan att administrera organisationen.",
      },
    ],
  },
  company: {
    id: "company",
    title: "Organisationsinställningar",
    description:
      "Organisationens uppgifter används i rapporter, inbjudningar och kontaktinformation.",
    steps: [
      {
        title: "Operatörsuppgifter",
        description:
          "Kontrollera namn, organisationsnummer, adress och kontaktuppgifter innan rapportering.",
        selector: "main",
      },
      {
        title: "Rapportkvalitet",
        description:
          "Korrekt organisationsinformation gör årsrapporter och kontaktvägar tydligare.",
      },
      {
        title: "Slutför inför pilot",
        description:
          "När organisationen är komplett blir det enklare att bjuda in användare och arbeta löpande i Polar.",
      },
    ],
  },
}
