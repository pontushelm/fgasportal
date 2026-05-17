"use client"

import Link from "next/link"
import { type ComponentType, useState } from "react"
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react"
import { Card, PageHeader, buttonClassName } from "@/components/ui"

type HelpSection = {
  id: string
  title: string
  summary: string
  icon: ComponentType<{ className?: string }>
  items: string[]
  links?: Array<{ href: string; label: string }>
}

const helpSections: HelpSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "F-gasöversikt för det som kräver uppmärksamhet först.",
    icon: BarChart3,
    items: [
      "F-gasöversikten visar Kräver uppmärksamhet, Att göra, årsrapportering, statusöversikt samt köldmedier och klimatpåverkan.",
      "Kräver uppmärksamhet samlar försenade kontroller, kommande kontroller, läckage-CO₂e och årsrapporter som återstår.",
      "Att göra visar ett kort urval av prioriterade uppföljningar. Öppna Åtgärder för filtrering, sparade vyer och hela arbetskön.",
      "Statusöversikt och köldmedier/klimatpåverkan är sekundär översikt för kontrollstatus, risk, installerad CO₂e och köldmediestatus.",
    ],
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/actions", label: "Åtgärder" },
    ],
  },
  {
    id: "installations",
    title: "Aggregat",
    summary: "Register, filtrering, massåtgärder, import och historik.",
    icon: ClipboardCheck,
    items: [
      "Aggregat-ID / märkning är den primära identiteten och används vid registerarbete, import och händelseimport.",
      "Aggregatlistan stödjer sök, filter och sorterbara kolumner för bland annat placering, servicepartner, köldmedium, mängd, CO₂e och kontrollstatus.",
      "Markerade aggregat kan massuppdateras med servicepartner, fastighet eller arkivering. Listan uppdateras lokalt där det är säkert för ett smidigare arbetsflöde.",
      "Arkivering och skrotning är livscykelåtgärder. Permanent borttagning är bara avsett för felregistreringar.",
      "Importera aggregat från Excel/CSV och importera historiska händelser i separata, strukturerade flöden.",
    ],
    links: [
      { href: "/dashboard/installations", label: "Aggregat" },
      { href: "/dashboard/installations/import", label: "Importera aggregat" },
      { href: "/dashboard/installations/import-events", label: "Importera händelser" },
    ],
  },
  {
    id: "properties",
    title: "Fastigheter",
    summary: "Fastighetsöversikt med rapportkrav, klimatpåverkan och operativ status.",
    icon: Building2,
    items: [
      "Fastighetssidorna visar kopplade aggregat, kontrollstatus, risk, servicepartners och senaste händelser.",
      "Rapportöversikt visar om årsrapport krävs per fastighet utifrån installerad CO₂e för kontrollpliktiga stationära aggregat.",
      "Fastigheter kan följas upp med klimatpåverkan från installerade köldmedier och registrerade läckage.",
      "Länkar från fastighetssidan leder vidare till filtrerade åtgärder, aggregat och årsrapportering där det är relevant.",
    ],
    links: [{ href: "/dashboard/properties", label: "Fastigheter" }],
  },
  {
    id: "servicepartners",
    title: "Servicepartners",
    summary: "Servicepartnerföretag är primär tilldelning, kontaktperson är valfri.",
    icon: Users,
    items: [
      "Aggregat tilldelas i första hand till servicepartnerföretag. Servicekontakt / tekniker är valfri sekundär metadata.",
      "Servicepartners bjuds in från servicepartnersidan, inte från den interna användarlistan i företagsinställningar.",
      "Servicepartneröversikten grupperar kontakter under företag och visar kopplade aggregat via företagstilldelning och kontaktkoppling.",
      "Servicepartneranvändare kan arbeta i servicevyn och registrera relevanta händelser enligt sin åtkomst.",
    ],
    links: [{ href: "/dashboard/contractors", label: "Servicepartners" }],
  },
  {
    id: "events",
    title: "Händelser",
    summary: "Strukturerad historik för kontroller, läckage och köldmediehantering.",
    icon: Wrench,
    items: [
      "Händelser omfattar kontroller, läckage, påfyllning, service/reparation, tömning/återvinning, köldmediebyte och skrotning.",
      "Byte av köldmedium och återvinning/tömning sparar strukturerade fält där det finns stöd, så årsrapport och historik blir mer tillförlitliga.",
      "Felregistrerade händelser korrigeras genom en ersättningshändelse. Den gamla händelsen finns kvar som ersatt men räknas inte i rapporter och beräkningar.",
      "Historiska händelser kan importeras från strukturerade Excel/CSV-filer och kopplas till befintliga aggregat via Aggregat-ID.",
    ],
    links: [{ href: "/dashboard/installations", label: "Aggregat" }],
  },
  {
    id: "actions",
    title: "Åtgärder",
    summary: "Skillnaden mellan dashboardöversikt och den operativa åtgärdssidan.",
    icon: ListChecks,
    items: [
      "Dashboarden visar översikt, nyckeltal och ett kort urval av de mest akuta åtgärderna.",
      "Åtgärdssidan är den operativa arbetskön för försenade kontroller, kommande kontroller, läckage, riskbevakning och saknad servicepartner.",
      "Prioriteringen sätts av systemet utifrån typ, allvarlighet och datum så att kritiska uppgifter hamnar högst.",
      "Åtgärder är inte en separat ärendemodell ännu, utan genereras från aktuell aggregat-, kontroll- och händelsedata.",
    ],
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/actions", label: "Åtgärder" },
    ],
  },
  {
    id: "reports",
    title: "Rapporter",
    summary: "Årsrapport, readiness, varningar, signering och PDF-export.",
    icon: FileText,
    items: [
      "Årlig F-gasrapport kan skapas för valt år och filtreras på fastighet där det är relevant.",
      "Rapporten visar readiness och varningar för uppgifter som bör kontrolleras, till exempel okänt GWP, saknade mängder eller ofullständiga service-/certifikatuppgifter.",
      "PDF-export finns för rapporten. Signering light sparar metadata om vem som intygat rapporten och när.",
      "Signerade rapporter visas i historik och kan återskapas utifrån sparad signeringsinformation och aktuell systemdata.",
    ],
    links: [{ href: "/dashboard/reports", label: "Rapporter" }],
  },
  {
    id: "notifications",
    title: "Notifieringar",
    summary: "E-post för påminnelser och viktiga operativa händelser.",
    icon: Bell,
    items: [
      "Kontrollpåminnelser skickas enligt befintlig påminnelselogik och personliga notifieringsinställningar.",
      "Tilldelningsmejl används när aggregat kopplas till servicepartner/servicekontakt där flödet stöder det.",
      "Läckagenotiser kan skickas till ansvariga interna roller när läckage registreras.",
      "Mina inställningar styr personliga notifieringsval för bland annat kontrollpåminnelser, tilldelningar och läckage.",
    ],
    links: [{ href: "/dashboard/settings", label: "Mina inställningar" }],
  },
  {
    id: "roles",
    title: "Roller och behörighet",
    summary: "Kort översikt över interna roller och servicepartneråtkomst.",
    icon: ShieldCheck,
    items: [
      "OWNER kan hantera företag, fakturauppgifter, användare och bjuda in OWNER, ADMIN och MEMBER.",
      "ADMIN kan hantera operativ data och bjuda in MEMBER internt. Servicepartners bjuds fortfarande in via Servicepartners-flödet.",
      "MEMBER kan arbeta med registrerad data men har begränsad åtkomst till företagsinställningar.",
      "CONTRACTOR används för servicepartneranvändare och ska inte hanteras som vanliga interna användare i företagsinställningar.",
    ],
    links: [{ href: "/dashboard/company", label: "Företagsinställningar" }],
  },
  {
    id: "feedback",
    title: "Feedback under pilot",
    summary: "Skicka buggar, frågor och förbättringsförslag direkt från systemet.",
    icon: MessageSquare,
    items: [
      "Använd Skicka feedback i sidomenyn för buggar, frågor, förbättringsförslag eller annan återkoppling.",
      "Formuläret skickar automatiskt med aktuell sida, användare, företag och tidpunkt.",
      "Feedback är avsedd för snabb pilotdialog och är inte ett separat ärende- eller supportflöde.",
    ],
  },
]

const faqItems = [
  {
    question: "Varför visas inte en fastighet som kopplad efter import?",
    answer:
      "Fastigheten måste redan finnas i FgasPortal och namnet behöver matcha importfilen. Om ingen match hittas importeras aggregatet utan fastighetskoppling med en varning.",
  },
  {
    question: "Ska GWP eller CO₂e importeras från Excel?",
    answer:
      "Normalt nej. FgasPortal beräknar CO₂e utifrån köldmedium och fyllnadsmängd. Om GWP saknas visas det som ofullständig data i stället för ett missvisande nollvärde.",
  },
  {
    question: "När ska jag arkivera eller skrota ett aggregat?",
    answer:
      "Använd arkivering eller skrotning när aggregatet faktiskt lämnar det aktiva registret. Permanent borttagning är bara för felaktiga registreringar.",
  },
  {
    question: "Var bjuder jag in servicepartners?",
    answer:
      "Servicepartners bjuds in från sidan Servicepartners. Interna användare hanteras i företagsinställningar och ska inte blandas ihop med servicepartnerkontakter.",
  },
  {
    question: "Hur lämnar pilotanvändare feedback?",
    answer:
      "Klicka på Skicka feedback i sidomenyn. Systemet skickar med aktuell sida, användare och företag så att återkopplingen går snabbare att förstå.",
  },
]

export default function HelpPageClient() {
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(["dashboard", "installations"])

  function toggleSection(sectionId: string) {
    setOpenSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="Hjälp"
          subtitle="Kom igång med FgasPortal och vanliga arbetsflöden."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="grid gap-3">
            {helpSections.map((section) => (
              <HelpSectionCard
                isOpen={openSectionIds.includes(section.id)}
                key={section.id}
                section={section}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </section>

          <aside className="grid content-start gap-4">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-950">Snabb väg in</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    De vanligaste pilotflödena börjar med dashboard, aggregat,
                    åtgärder eller årsrapportering.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Link className={buttonClassName({ className: "justify-start" })} href="/dashboard/installations">
                  Aggregat
                </Link>
                <Link className={buttonClassName({ className: "justify-start" })} href="/dashboard/properties">
                  Fastigheter
                </Link>
                <Link className={buttonClassName({ className: "justify-start" })} href="/dashboard/actions">
                  Åtgärder
                </Link>
                <Link className={buttonClassName({ className: "justify-start" })} href="/dashboard/reports">
                  Rapporter
                </Link>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-950">Vanliga frågor</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Korta svar på sådant som ofta dyker upp i demo och pilot.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {faqItems.map((item) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={item.question}>
                    <h3 className="text-sm font-semibold text-slate-950">{item.question}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  )
}

function HelpSectionCard({
  isOpen,
  section,
  onToggle,
}: {
  isOpen: boolean
  section: HelpSection
  onToggle: () => void
}) {
  const Icon = section.icon

  return (
    <Card className="overflow-hidden">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
        type="button"
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-slate-950">{section.title}</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">{section.summary}</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 px-4 py-4">
          <ul className="grid gap-2 text-sm leading-6 text-slate-700">
            {section.items.map((item) => (
              <li className="flex gap-2" key={item}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {section.links && section.links.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link className={buttonClassName()} href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}
