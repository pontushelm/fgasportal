import Link from "next/link"

const previewStats = [
  { label: "Totalt aggregat", value: "248", tone: "border-l-blue-500" },
  { label: "Försenade kontroller", value: "7", tone: "border-l-red-500" },
  { label: "Total CO₂e", value: "1 840 t", tone: "border-l-emerald-500" },
  { label: "Hög risk", value: "18", tone: "border-l-amber-500" },
]

const previewTags = ["Årsrapport", "Fastigheter", "Dokument", "Servicepartners"]

const problems = [
  "Excel-register blir snabbt inaktuella",
  "Kontrollintervall missas",
  "Underlag inför årsrapport sprids ut",
  "Svårt att följa upp servicepartners",
  "Begränsad överblick över CO₂e och läckage",
  "Dokument och historik saknas på rätt aggregat",
]

const features = [
  {
    title: "Installationsregister",
    text: "Samla aggregat, köldmedium, fyllnadsmängd, fastighet och servicepartner i ett strukturerat register.",
  },
  {
    title: "Kontrollintervall och påminnelser",
    text: "Följ nästa kontroll och minska risken för missade läckagekontroller.",
  },
  {
    title: "Fastigheter och kommuner",
    text: "Gruppera aggregat per fastighet och kommun för bättre överblick och rapportering.",
  },
  {
    title: "Contractor-portal",
    text: "Bjud in servicepartners som kan se tilldelade aggregat och registrera utfört arbete.",
  },
  {
    title: "Dokument och aktivitetslogg",
    text: "Koppla kontrollrapporter, serviceprotokoll och historik till rätt aggregat.",
  },
  {
    title: "Risk och klimatpåverkan",
    text: "Se CO₂e, riskklassning, läckagehistorik och prioriterade åtgärder.",
  },
  {
    title: "Årsrapport och export",
    text: "Samla underlag för svensk F-gas årsrapport och exportera till CSV eller PDF.",
  },
  {
    title: "Excel-import och bulkhantering",
    text: "Importera många aggregat och uppdatera fastighet eller servicepartner i bulk.",
  },
]

const workflowSteps = [
  "Importera eller skapa aggregat",
  "Koppla till fastigheter och servicepartners",
  "Följ kontrollintervall, risk och läckage",
  "Samla dokument och historik",
  "Exportera årsrapport och underlag",
]

const audiences = [
  "Fastighetsbolag",
  "Kommuner",
  "Regioner och sjukhus",
  "Industriella verksamheter",
  "Driftorganisationer",
  "Servicepartners",
]

const riskPoints = [
  "CO₂e per aggregat och köldmedium",
  "Riskklassning för prioritering",
  "Läckagehistorik över tid",
  "Prioriterade åtgärder i dashboarden",
  "Fastigheter med hög klimatpåverkan",
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="text-lg font-bold tracking-tight text-slate-950" href="/">
            FgasPortal
          </Link>
          <div className="flex items-center gap-2">
            <Link className={secondaryLinkClassName} href="/login">
              Logga in
            </Link>
            <Link className={secondaryLinkClassName} href="/register">
              Skapa konto
            </Link>
            <a className={primaryLinkClassName} href="mailto:info@fgasportal.se">
              Boka demo
            </a>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            SaaS för F-gasregister och uppföljning
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            F-gasregister, kontroller och rapporter – samlat i ett system
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
            FgasPortal hjälper fastighetsägare, kommuner, regioner och
            driftorganisationer att hålla ordning på köldmedieaggregat,
            kontrollintervall, servicepartners, dokument och årsrapporter.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className={primaryLargeLinkClassName} href="mailto:info@fgasportal.se">
              Boka demo
            </a>
            <Link className={secondaryLargeLinkClassName} href="/login">
              Logga in
            </Link>
            <Link className={ghostLargeLinkClassName} href="/register">
              Skapa konto
            </Link>
          </div>
        </div>

        <DashboardPreview />
      </section>

      <Section
        eyebrow="Utmaningar"
        title="Vanliga utmaningar med F-gasregister"
        description="Många organisationer har kontroll på tekniken, men saknar ett samlat system för register, uppföljning och rapportunderlag."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem) => (
            <article className={cardClassName} key={problem}>
              <h3 className="text-base font-semibold text-slate-950">{problem}</h3>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Lösning"
        title="Ett system för hela F-gasflödet"
        description="Från import av aggregat till kontrollbevakning, dokumentation, serviceuppdrag och rapportering."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
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
              Från register till uppföljning
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              FgasPortal är byggt för löpande drift, inte bara årsvis
              rapportering. Systemet hjälper er att strukturera data och följa
              upp det som behöver åtgärdas.
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

      <Section
        eyebrow="Målgrupper"
        title="Byggt för organisationer med många aggregat"
        description="FgasPortal passar verksamheter som behöver bättre struktur, spårbarhet och överblick över flera fastigheter, anläggningar eller serviceflöden."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <div className="rounded-xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 shadow-sm" key={audience}>
              {audience}
            </div>
          ))}
        </div>
      </Section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Operatörer
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Registret ägs av operatören
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Operatören behåller överblicken över aggregat, fastigheter,
              kontrollintervall, dokument och årsrapporter. FgasPortal hjälper
              till att samla informationen och göra uppföljningen tydligare.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Servicepartners
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Contractors bjuds in utan kostnad
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Servicepartners kan se tilldelade aggregat, registrera kontroller,
              service, läckage och påfyllning samt ladda upp dokument direkt på
              rätt installation.
            </p>
          </article>
        </div>
      </section>

      <Section
        eyebrow="Risk och klimat"
        title="Bättre överblick över risk och klimatpåverkan"
        description="FgasPortal ger en tydligare bild av vilka aggregat och fastigheter som bör prioriteras i uppföljning och underhåll."
      >
        <div className="grid gap-4 md:grid-cols-5">
          {riskPoints.map((point) => (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" key={point}>
              {point}
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-8 text-white shadow-sm sm:p-10">
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight">
            Vill ni få bättre kontroll på era F-gasregister?
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Boka en demo för att se hur FgasPortal kan hjälpa er att samla
            register, dokument, serviceuppföljning och rapportunderlag.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700" href="mailto:info@fgasportal.se">
              Boka demo
            </a>
            <Link className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100" href="/register">
              Skapa konto
            </Link>
            <Link className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900" href="/login">
              Logga in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:px-8">
          <p className="font-semibold text-slate-950">FgasPortal</p>
          <p>
            FgasPortal ersätter inte operatörens ansvar, men hjälper till att
            strukturera information, uppföljning och rapportunderlag.
          </p>
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
            Compliance dashboard
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
  "rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
const primaryLargeLinkClassName =
  "rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
const secondaryLargeLinkClassName =
  "rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
const ghostLargeLinkClassName =
  "rounded-lg px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
