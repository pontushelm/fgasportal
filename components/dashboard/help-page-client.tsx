"use client"

import Link from "next/link"
import { type ComponentType, useState } from "react"
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  LifeBuoy,
  ListChecks,
  Users,
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
    id: "start",
    title: "Kom igång",
    summary: "Grundflödet för att få organisationens register på plats.",
    icon: LifeBuoy,
    items: [
      "Skapa aggregat manuellt när registret är litet eller uppgifterna behöver kontrolleras direkt.",
      "Importera befintliga Excel- eller CSV-register och granska mappning, varningar och förhandsvisning före import.",
      "Lägg upp fastigheter först om aggregat ska kopplas automatiskt via fastighetsnamn i importfilen.",
      "Bjud in servicekontakter och koppla dem till aggregat när de ska hjälpa till med kontroll- och serviceuppföljning.",
    ],
    links: [
      { href: "/dashboard/installations", label: "Aggregat" },
      { href: "/dashboard/properties", label: "Fastigheter" },
      { href: "/dashboard/contractors", label: "Servicekontakter" },
    ],
  },
  {
    id: "status",
    title: "Aggregat och kontrollstatus",
    summary: "Hur kontrollplikt, intervall, status och risk visas i systemet.",
    icon: ClipboardCheck,
    items: [
      "Kontrollplikt baseras på köldmedium, fyllnadsmängd och beräknad CO₂e där GWP är känt.",
      "Kontrollintervall och nästa kontroll används för att visa OK, kommande, försenade och ej kontrollerade aggregat.",
      "Risknivåer hjälper till att prioritera aggregat med hög klimatpåverkan, läckagehistorik eller bristande uppföljning.",
      "Arkivering och skrotning ska hanteras via livscykelåtgärder så historiken förblir spårbar.",
    ],
    links: [{ href: "/dashboard/installations", label: "Se aggregat" }],
  },
  {
    id: "import",
    title: "Import av aggregat",
    summary: "Vad importen förväntar sig och varför vissa rader får varningar.",
    icon: FileSpreadsheet,
    items: [
      "Aggregat-ID / märkning är den primära identiteten och används för att känna igen aggregat i register.",
      "Aggregatnamn eller benämning är valfritt. Om namn saknas kan Aggregat-ID användas som visningsnamn.",
      "Fastigheter kopplas bara om fastigheten redan finns i FgasPortal och namnet matchar importfilen.",
      "GWP och CO₂e beräknas normalt av systemet och behöver inte importeras.",
      "Varningar betyder oftast att raden kan importeras men behöver granskas, till exempel vid okänd fastighet eller ofullständig data.",
    ],
    links: [{ href: "/dashboard/installations", label: "Öppna import" }],
  },
  {
    id: "reports",
    title: "Årsrapport",
    summary: "Stöd för årlig F-gasrapportering och spårbar dokumentation.",
    icon: FileText,
    items: [
      "Årsrapporten sammanställer kontrollpliktiga aggregat, köldmedier, mängder och relevanta händelser för valt år.",
      "Rapporten används som underlag för intern uppföljning, myndighetsdialog och kommunala complianceflöden.",
      "Export och signering görs utifrån den data som finns registrerad för organisationen och valt rapportår.",
      "Aktivitetslogg, händelser och dokument bidrar till spårbarhet när uppgifter behöver kontrolleras i efterhand.",
    ],
    links: [{ href: "/dashboard/reports", label: "Rapporter" }],
  },
  {
    id: "contacts",
    title: "Servicekontakter",
    summary: "Roller, företag, certifikat och tilldelning av aggregat.",
    icon: Users,
    items: [
      "En servicekontakt är en inbjuden person som kan kopplas till aggregat och operativa uppföljningar.",
      "Servicepartnerföretag används för att gruppera kontakter som tillhör samma externa partner eller leverantör.",
      "Certifikatuppgifter hjälper organisationen att följa behörighet och kommande certifikatslutdatum.",
      "Tilldelning av aggregat gör det tydligare vem som ansvarar för uppföljning och servicearbete.",
    ],
    links: [{ href: "/dashboard/contractors", label: "Servicekontakter" }],
  },
  {
    id: "actions",
    title: "Åtgärder",
    summary: "Skillnaden mellan dashboardöversikt och den operativa åtgärdssidan.",
    icon: ListChecks,
    items: [
      "Dashboarden visar översikt, nyckeltal och ett kort urval av de mest akuta åtgärderna.",
      "Åtgärdssidan är den operativa arbetskön för försenade kontroller, kommande kontroller, läckage, hög risk och saknad servicekontakt.",
      "Prioriteringen sätts av systemet utifrån typ, allvarlighet och datum så att kritiska uppgifter hamnar högst.",
      "Åtgärder är inte en separat ärendemodell ännu, utan genereras från aktuell aggregat-, kontroll- och händelsedata.",
    ],
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/actions", label: "Åtgärder" },
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
]

export default function HelpPageClient() {
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(["start", "actions"])

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
                    De vanligaste pilotflödena börjar med register, fastigheter,
                    åtgärder eller årsrapport.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Link className={buttonClassName({ className: "justify-start" })} href="/dashboard/installations">
                  Aggregat
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
