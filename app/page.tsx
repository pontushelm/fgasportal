import Link from "next/link"
import Image from "next/image"
import { DemoRequestButton } from "@/components/demo-request-button"
import { LegalLinks } from "@/components/legal-links"

const previewStats = [
  { label: "Totalt aggregat", value: "248", tone: "border-l-blue-500" },
  { label: "Försenade kontroller", value: "7", tone: "border-l-red-500" },
  { label: "Total CO₂e", value: "1 840 t", tone: "border-l-emerald-500" },
  { label: "Hög risk", value: "18", tone: "border-l-amber-500" },
]

const previewTags = ["Årsrapport", "Fastigheter", "Dokument", "Servicepartners"]

const valueCards = [
  {
    title: "Samlat F-gasregister",
    text: "Samla aggregat, köldmedium, mängder, fastigheter och servicepartners i ett strukturerat register.",
  },
  {
    title: "Kontroll på intervall och status",
    text: "Följ kommande och försenade kontroller, riskstatus och prioriterade åtgärder.",
  },
  {
    title: "Rapporter och dokumentation",
    text: "Samla historik, dokument och underlag för årsrapportering till kommun.",
  },
  {
    title: "Klimatpåverkan och CO₂e",
    text: "Få överblick över klimatpåverkan per aggregat, fastighet och köldmedium.",
  },
]

const workflowSteps = [
  "Registrera eller importera aggregat",
  "Koppla till fastigheter och servicepartners",
  "Följ kontrollintervall, läckage och risk",
  "Samla dokument och historik",
  "Exportera årsrapport och klimatunderlag",
]

const audiences = [
  {
    title: "Fastighetsägare och förvaltning",
    text: "Få kontroll över aggregat, kontrollintervall och rapportunderlag över flera fastigheter och verksamheter.",
  },
  {
    title: "Kommuner, regioner och offentliga verksamheter",
    text: "Skapa struktur för uppföljning av skolor, sjukhus, verksamhetslokaler och externa servicepartners.",
  },
  {
    title: "Butiker, hotell och verksamheter med kylsystem",
    text: "Samla servicehistorik, läckagekontroller och dokumentation på ett ställe.",
  },
  {
    title: "Industri och driftorganisationer",
    text: "Hantera större aggregatbestånd med tydlig status, risköversikt och spårbar historik.",
  },
  {
    title: "Servicepartnerföretag",
    text: "Registrera läckagekontroller, service och andra händelser direkt i operatörens register.",
  },
]

const riskPoints = [
  "CO₂e per aggregat",
  "Riskklassning",
  "Läckagehistorik över tid",
  "Försenade kontroller",
  "Fastigheter med hög klimatpåverkan",
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            aria-label="Helm Polar startsida"
            className="inline-flex items-center"
            href="/"
          >
            <Image
              alt="Helm Polar"
              className="h-auto w-40 sm:w-44"
              height={403}
              priority
              src="/helm-polar-logo.png"
              width={1200}
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link className={secondaryLinkClassName} href="/login">
              Logga in
            </Link>
            <Link className={secondaryLinkClassName} href="/register">
              Skapa konto
            </Link>
            <DemoRequestButton className={primaryLinkClassName}>
              Boka demo
            </DemoRequestButton>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Digitalt F-gasregister för uppföljning och årsrapportering
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Få kontroll på köldmedieaggregat och F-gasrapportering
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
            Helm Polar samlar register, kontroller, dokumentation,
            servicepartners och rapportunderlag i ett webbaserat system för
            verksamheter som omfattas av F-gasförordningen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DemoRequestButton className={primaryLargeLinkClassName}>
              Boka demo
            </DemoRequestButton>
            <Link className={secondaryLargeLinkClassName} href="/register">
              Skapa konto
            </Link>
            <Link className={secondaryLargeLinkClassName} href="/login">
              Logga in
            </Link>
          </div>
        </div>

        <DashboardPreview />
      </section>

      <Section
        eyebrow="Översikt"
        title="Det viktigaste samlat på ett ställe"
        description="Helm Polar ger organisationen en tydlig grund för registerhållning, uppföljning och rapportering."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {valueCards.map((feature) => (
            <article className={cardClassName} key={feature.title}>
              <h3 className="font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Arbetsflöde
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Så hjälper Helm Polar i vardagen
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Ett kompakt arbetsflöde från registrering till uppföljning,
              dokumentation och export.
            </p>
          </div>
          <div className="grid gap-3">
            {workflowSteps.map((step, index) => (
              <div
                className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                key={step}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="self-center font-semibold text-slate-900">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Servicepartners
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Samarbeta med servicepartnerföretag direkt i systemet
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Bjud in servicepartnerföretag så att de kan se tilldelade aggregat,
              registrera kontroller, läckage, service och ladda upp dokument
              direkt på rätt aggregat.
            </p>
          </div>
          <div className="grid gap-3">
            <ServicePoint>Operatören behåller kontrollen över sitt F-gasregister</ServicePoint>
            <ServicePoint>Servicepartners kan registrera läckagekontroller, service och andra händelser direkt i operatörens register.</ServicePoint>
            <ServicePoint>Byggt för organisationer med flera fastigheter och externa servicepartners</ServicePoint>
          </div>
        </div>
      </section>

      <Section
        eyebrow="Risk och klimat"
        title="Prioritera rätt med risk- och klimatöversikt"
        description="Se vilka aggregat och fastigheter som bör prioriteras baserat på CO₂e, riskklassning, läckagehistorik och kontrollstatus - och använd översikten som stöd för att minska klimatpåverkan över tid."
      >
        <div className="flex flex-wrap gap-3">
          {riskPoints.map((point) => (
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900" key={point}>
              {point}
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="För vem"
        title="Byggt för organisationer med ansvar för köldmedieaggregat"
        description="För verksamheter som behöver struktur, spårbarhet och överblick över flera fastigheter, anläggningar eller serviceflöden."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={audience.title}>
              <h3 className="font-semibold text-slate-950">{audience.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{audience.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm sm:p-10">
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950">
            Vill ni få bättre kontroll över ert F-gasregister?
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            Boka en demo för att se hur Helm Polar kan samla register,
            kontroller, dokumentation, serviceuppföljning och rapportunderlag.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <DemoRequestButton className={primaryLargeLinkClassName}>
              Boka demo
            </DemoRequestButton>
            <Link className={secondaryLargeLinkClassName} href="/register">
              Skapa konto
            </Link>
            <Link className={secondaryLargeLinkClassName} href="/login">
              Logga in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:px-8">
          <div>
            <p className="font-semibold text-slate-950">Helm Polar</p>
            <p className="mt-2 max-w-3xl">
              Helm Polar hjälper till att strukturera register, uppföljning och
              rapportunderlag. Operatören ansvarar fortsatt för att uppgifter och
              rapportering är korrekta.
            </p>
          </div>
          <LegalLinks />
        </div>
      </footer>
    </main>
  )
}

function DashboardPreview() {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Produktöversikt</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Kontrollstatus och uppföljning
          </h2>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Liveöversikt
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {previewStats.map((item) => (
          <div
            className={`rounded-xl border border-slate-200 border-l-4 bg-slate-50 p-4 ${item.tone}`}
            key={item.label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Prioriterade åtgärder</p>
        <div className="mt-3 grid gap-2">
          <MockAction title="Försenad kontroll" meta="Kylaggregat hus A" tone="red" />
          <MockAction title="Hög risk" meta="R404A, hög CO₂e" tone="amber" />
          <MockAction title="Dokument saknas" meta="Serviceprotokoll" tone="blue" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {previewTags.map((tag) => (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </aside>
  )
}

function MockAction({
  meta,
  title,
  tone,
}: {
  meta: string
  title: string
  tone: "red" | "amber" | "blue"
}) {
  const toneClass = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
  }[tone]

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="text-xs text-slate-500">{meta}</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        Åtgärd
      </span>
    </div>
  )
}

function ServicePoint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">
      {children}
    </div>
  )
}

function Section({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  )
}

const cardClassName =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"

const primaryLinkClassName =
  "rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
const secondaryLinkClassName =
  "rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
const primaryLargeLinkClassName =
  "rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
const secondaryLargeLinkClassName =
  "rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
