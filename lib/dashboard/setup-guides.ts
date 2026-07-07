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

type SetupGuideMap = Partial<Record<DashboardSetupStepId, DashboardSetupGuide>>

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

const MEMBER_GUIDED_STEP_IDS = [
  "dashboard",
  "installations",
  "actions",
  "reports",
  "documentsEvents",
  "personalOverview",
] as const satisfies readonly DashboardSetupStepId[]

const CONTRACTOR_GUIDED_STEP_IDS = [
  "contractorDashboard",
  "assignedInstallations",
  "registerServiceEvent",
  "certificateStatus",
  "actions",
  "servicePartnerSetup",
] as const satisfies readonly DashboardSetupStepId[]

const ALL_GUIDED_STEP_IDS = new Set<string>([
  ...ADMIN_GUIDED_STEP_IDS,
  ...MEMBER_GUIDED_STEP_IDS,
  ...CONTRACTOR_GUIDED_STEP_IDS,
])

const GUIDED_STEP_IDS_BY_ROLE: Record<
  DashboardSetupRole,
  readonly DashboardSetupStepId[]
> = {
  OWNER: ADMIN_GUIDED_STEP_IDS,
  ADMIN: ADMIN_GUIDED_STEP_IDS,
  MEMBER: MEMBER_GUIDED_STEP_IDS,
  CONTRACTOR: CONTRACTOR_GUIDED_STEP_IDS,
}

export function getSetupGuideHref(
  step: Pick<DashboardSetupStep, "id" | "route">
) {
  const [pathname, queryString = ""] = step.route.split("?")
  const params = new URLSearchParams(queryString)
  params.set(SETUP_GUIDE_QUERY_PARAM, step.id)
  return `${pathname}?${params.toString()}`
}

export function shouldUseSetupGuide(
  role: DashboardSetupRole,
  stepId: DashboardSetupStepId
) {
  return GUIDED_STEP_IDS_BY_ROLE[role].includes(stepId)
}

export function getDashboardSetupGuide(
  guideId: string | null,
  role: DashboardSetupRole | null | undefined = "OWNER"
): DashboardSetupGuide | null {
  if (!isDashboardSetupStepId(guideId)) return null

  const guides = getSetupGuidesForRole(role ?? "OWNER")
  return guides[guideId] ?? null
}

function getSetupGuidesForRole(role: DashboardSetupRole): SetupGuideMap {
  if (role === "CONTRACTOR") return CONTRACTOR_SETUP_GUIDES
  if (role === "MEMBER") return MEMBER_SETUP_GUIDES
  return ADMIN_SETUP_GUIDES
}

function isDashboardSetupStepId(value: string | null): value is DashboardSetupStepId {
  return Boolean(value && ALL_GUIDED_STEP_IDS.has(value))
}

const ADMIN_SETUP_GUIDES: SetupGuideMap = {
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
        selector: '[data-tour="invite-users-section"]',
      },
      {
        title: "Använd roller med omsorg",
        description:
          "Ägare och ansvariga bör bara vara personer som ska kunna hantera organisationsinställningar och användare.",
      },
      {
        title: "Medlemmar kan granska",
        description:
          "Medlem passar för användare som ska följa upp register och rapportstatus utan att administrera organisationen.",
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

const MEMBER_SETUP_GUIDES: SetupGuideMap = {
  dashboard: {
    id: "dashboard",
    title: "Dashboarden",
    description:
      "Här får du en snabb överblick över register, åtgärder och rapportstatus.",
    steps: [
      {
        title: "Din översikt",
        description:
          "Dashboarden hjälper dig se läget utan att behöva gå igenom varje aggregat manuellt.",
        selector: "main",
      },
      {
        title: "Vad behöver granskas?",
        description:
          "Åtgärder och registerstatus visar var det finns saker som kan behöva följas upp.",
      },
      {
        title: "Rapportstatus",
        description:
          "Rapportdelen visar om underlaget verkar redo eller om något behöver kompletteras.",
      },
    ],
  },
  installations: {
    id: "installations",
    title: "Aggregatregistret",
    description:
      "Här hittar du aggregat, placering, status och historik för organisationens register.",
    steps: [
      {
        title: "Hitta rätt aggregat",
        description:
          "Använd listan och filtren för att hitta aggregat efter fastighet, status, köldmedium eller servicepartner.",
        selector: "main",
      },
      {
        title: "Granska viktiga uppgifter",
        description:
          "Köldmedium, fyllnadsmängd, CO₂e och nästa kontroll är centrala för uppföljning.",
      },
      {
        title: "Öppna detaljvyn",
        description:
          "I detaljvyn finns händelser, dokument och mer historik för varje aggregat.",
      },
    ],
  },
  actions: {
    id: "actions",
    title: "Åtgärder",
    description:
      "Åtgärder visar vad som behöver uppmärksammas i registret.",
    steps: [
      {
        title: "Följ upp det viktigaste",
        description:
          "Här samlas uppgifter som Polar bedömer behöver granskas, till exempel kontroller eller saknade data.",
        selector: "main",
      },
      {
        title: "Prioritera med filter",
        description:
          "Filtrera efter kategori och allvarlighetsgrad för att fokusera på rätt uppgifter.",
      },
      {
        title: "När listan är tom",
        description:
          "En tom åtgärdslista betyder att det inte finns något tydligt att följa upp just nu.",
      },
    ],
  },
  reports: {
    id: "reports",
    title: "Årsrapportstatus",
    description:
      "Här ser du hur rapportunderlaget ser ut och vilka fastigheter som behöver granskas.",
    steps: [
      {
        title: "Förstå rapportläget",
        description:
          "Rapportsidan visar om underlaget kan förhandsgranskas och om något behöver kompletteras.",
        selector: "main",
      },
      {
        title: "Status per fastighet",
        description:
          "Granska fastigheterna var för sig för att förstå var eventuella brister finns.",
      },
      {
        title: "Förhandsgranskning",
        description:
          "När underlaget är tillräckligt komplett kan du öppna en förhandsgranskning av årsrapporten.",
      },
    ],
  },
  documentsEvents: {
    id: "documentsEvents",
    title: "Dokument och händelser",
    description:
      "Historik och dokument finns samlade på aggregatens detaljsidor.",
    steps: [
      {
        title: "Öppna ett aggregat",
        description:
          "Välj ett aggregat i listan för att se händelser, kontroller, dokument och aktivitet.",
        selector: "main",
      },
      {
        title: "Händelser visar historik",
        description:
          "Kontroller, läckage, service och reparationer skapar spårbarhet över tid.",
      },
      {
        title: "Dokument kompletterar registret",
        description:
          "Certifikat, intyg och andra filer kan ge stöd vid uppföljning och rapportering.",
      },
    ],
  },
  personalOverview: {
    id: "personalOverview",
    title: "Personlig översikt",
    description:
      "Här kontrollerar du dina egna uppgifter och hur du vill få uppföljning.",
    steps: [
      {
        title: "Dina uppgifter",
        description:
          "Kontrollera namn, kontaktuppgifter och personliga inställningar.",
        selector: "main",
      },
      {
        title: "Notiser",
        description:
          "Välj vilka typer av uppföljningar du vill få via e-post när organisationen använder påminnelser.",
      },
      {
        title: "Klart för ditt arbete",
        description:
          "När dina uppgifter stämmer blir det enklare att följa upp register och rapporter.",
      },
    ],
  },
}

const CONTRACTOR_SETUP_GUIDES: SetupGuideMap = {
  contractorDashboard: {
    id: "contractorDashboard",
    title: "Servicepartnerdashboarden",
    description:
      "Här ser du tilldelade kunder, uppdrag, kontroller och uppföljning.",
    steps: [
      {
        title: "Vad behöver göras?",
        description:
          "Dashboarden visar försenade kontroller, kommande arbete och uppgifter som behöver följas upp.",
        selector: "main",
      },
      {
        title: "Tilldelade aggregat",
        description:
          "Aggregat du har fått tillgång till från kunder blir utgångspunkten för servicearbetet.",
      },
      {
        title: "Arbeta från uppdrag",
        description:
          "Använd uppdragslistan för att prioritera kontroller, läckage och servicehändelser.",
      },
    ],
  },
  assignedInstallations: {
    id: "assignedInstallations",
    title: "Tilldelade aggregat",
    description:
      "Här hittar du aggregat som kunder har delegerat till din serviceorganisation.",
    steps: [
      {
        title: "Hitta rätt aggregat",
        description:
          "Listan visar de aggregat du har behörighet till. Använd filter för kund, fastighet eller status.",
        selector: "main",
      },
      {
        title: "Öppna detaljvyn",
        description:
          "Detaljvyn visar tekniska uppgifter, historik, dokument och åtgärder.",
      },
      {
        title: "Arbeta spårbart",
        description:
          "När du registrerar händelser sparas de direkt i kundens register.",
      },
    ],
  },
  registerServiceEvent: {
    id: "registerServiceEvent",
    title: "Registrera kontroll eller service",
    description:
      "Händelser registreras från aggregatets detaljsida och bygger historiken.",
    steps: [
      {
        title: "Välj aggregat först",
        description:
          "Öppna aggregatet du har arbetat med och välj rätt händelsetyp därifrån.",
        selector: "main",
      },
      {
        title: "Kontroll, läckage och service",
        description:
          "Du kan registrera kontroller, läckage, påfyllning, service och reparationer beroende på arbetet.",
      },
      {
        title: "Kunden ser historiken",
        description:
          "Händelsen hamnar direkt i kundens register och kan användas i uppföljning och rapportering.",
      },
    ],
  },
  certificateStatus: {
    id: "certificateStatus",
    title: "Certifikatstatus",
    description:
      "Certifikatstatus visar om personliga och organisatoriska F-gascertifikat behöver kompletteras.",
    steps: [
      {
        title: "Ditt personcertifikat",
        description:
          "Kontrollera certifikatnummer, giltighet och eventuellt dokument i dina inställningar.",
        selector: "main",
      },
      {
        title: "Giltighet är viktig",
        description:
          "Utgångna eller saknade certifikat kan skapa uppföljningsbehov för både servicepartner och kund.",
      },
      {
        title: "Komplettera vid behov",
        description:
          "Lägg till eller uppdatera certifikatuppgifter så att Polar kan visa rätt status.",
      },
    ],
  },
  actions: {
    id: "actions",
    title: "Öppna uppdrag",
    description:
      "Åtgärder visar servicearbete och uppföljning som behöver prioriteras.",
    steps: [
      {
        title: "Se vad som kräver uppmärksamhet",
        description:
          "Här visas till exempel försenade kontroller, läckage att följa upp och certifikatrelaterade uppgifter.",
        selector: "main",
      },
      {
        title: "Fokusera med filter",
        description:
          "Filtrera listan för att hitta rätt kund, aggregat eller typ av uppdrag.",
      },
      {
        title: "Öppna aggregatet",
        description:
          "Från åtgärden kan du gå vidare till aggregatet och registrera arbete där det hör hemma.",
      },
    ],
  },
  servicePartnerSetup: {
    id: "servicePartnerSetup",
    title: "Servicepartnerinställningar",
    description:
      "Här hanteras serviceorganisationens uppgifter, tekniker och certifikat.",
    steps: [
      {
        title: "Organisationens uppgifter",
        description:
          "Servicepartnerprofilen visar kontaktuppgifter och företagscertifikat för kunderna.",
        selector: "main",
      },
      {
        title: "Tekniker",
        description:
          "Serviceansvariga kan granska tekniker, tilldelningar och certifikatstatus.",
      },
      {
        title: "Redo för kundarbete",
        description:
          "När uppgifter och certifikat är kompletta blir samarbetet tydligare för kunden.",
      },
    ],
  },
}
