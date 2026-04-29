import Link from "next/link"

const dashboardStats = [
  { label: "Försenade kontroller", value: "3", tone: "text-red-700 dark:text-red-300" },
  { label: "Kontroller inom 30 dagar", value: "8", tone: "text-amber-700 dark:text-amber-300" },
  { label: "Aggregat utan kontroll", value: "5", tone: "text-blue-700 dark:text-blue-300" },
  { label: "Total CO₂e", value: "42,6 ton", tone: "text-emerald-700 dark:text-emerald-300" },
]

const servicePillars = [
  {
    title: "Compliance dashboard",
    angle: "Se direkt vilka aggregat som kräver åtgärd.",
    points: [
      "Försenade kontroller och kommande kontrollbehov",
      "Aggregat utan registrerad kontroll",
      "Samlad CO₂e-översikt",
      "Prioriterad vy för intern uppföljning",
    ],
  },
  {
    title: "Kontrollhistorik per aggregat",
    angle: "All kontrollhistorik samlad per aggregat.",
    points: [
      "Senaste kontroll och nästa kontroll",
      "Historik vid tillsyn",
      "Spårbarhet över tid",
      "Anteckningar kopplade till installationen",
    ],
  },
  {
    title: "Läckage- och servicelog",
    angle: "Följ läckage, påfyllning och åtgärder över tid.",
    points: [
      "Läckagehändelser",
      "Påfylld mängd",
      "Åtgärdad läcka",
      "Serviceanteckningar för bättre uppföljning",
    ],
  },
  {
    title: "Automatiskt kontrollintervall från CO₂e",
    angle: "Systemet hjälper till att räkna ut rätt kontrollintervall.",
    points: [
      "CO₂e-beräkning från köldmedium och fyllnadsmängd",
      "Kontrollintervall och nästa kontroll",
      "Påminnelser inför förfall",
      "Minskad risk för missade kontroller",
    ],
  },
  {
    title: "Organisationsinställningar och stöd",
    angle: "Vi kan hjälpa till att registerhålla åt er.",
    points: [
      "Företagsuppgifter och kontaktpersoner",
      "Import från Excel",
      "Löpande bevakning",
      "Rapportunderlag inför tillsyn",
    ],
  },
]

const offers = [
  {
    title: "System",
    points: [
      "Eget digitalt F-gasregister",
      "Import från Excel",
      "Automatiska påminnelser",
      "Export till CSV/PDF",
    ],
  },
  {
    title: "Registerhållning som tjänst",
    points: [
      "Vi strukturerar ert register",
      "Vi bevakar kontrollintervall",
      "Vi flaggar risker och försenade kontroller",
      "Vi tar fram underlag vid tillsyn",
    ],
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-normal">
            FgasPortal
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              Logga in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Skapa konto
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_0.9fr] md:items-center md:py-24">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-300">
            Managed compliance service + SaaS för F-gas
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Bättre kontroll på F-gasregister, kontroller och klimatpåverkan
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700 dark:text-zinc-300">
            FgasPortal hjälper operatörer att hålla ett mer tillförlitligt
            köldmedieregister, bevaka kontrollintervall, förstå CO₂e och
            ta fram underlag inför intern uppföljning och tillsyn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Logga in
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              Skapa konto
            </Link>
            <a
              href="mailto:info@fgasportal.se"
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              Kontakta oss
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Compliance dashboard</p>
              <h2 className="text-xl font-semibold">Se vad som kräver åtgärd</h2>
            </div>
            <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
              Bevakning
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboardStats.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</p>
                <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Fokusera på aggregat som är försenade, saknar kontroll eller närmar
            sig nästa kontroll, utan att leta i flera Excel-filer.
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">För operatörer som behöver bättre registerhållning</h2>
          </div>
          <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
            <p>
              Fastighetsägare, kommuner, regioner, bostadsbolag och industriella
              operatörer behöver ofta hantera många aggregat, kontrollintervall
              och serviceunderlag samtidigt.
            </p>
            <p>
              FgasPortal underlättar arbetet genom att samla data, status,
              historik och rapportunderlag på ett ställe. Det hjälper er att
              minska risken för missade läckagekontroller och ger bättre intern
              kontroll över klimatpåverkan.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-300">
            Fem servicepelare
          </p>
          <h2 className="mt-3 text-3xl font-bold">Systemstöd och praktisk hjälp för F-gasarbetet</h2>
          <p className="mt-4 text-zinc-700 dark:text-zinc-300">
            Använd FgasPortal som ett digitalt verktyg i er organisation, eller
            som en del av en löpande tjänst för registerhållning och bevakning.
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {servicePillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="text-xl font-semibold">{pillar.title}</h3>
              <p className="mt-2 font-medium text-emerald-700 dark:text-emerald-300">
                {pillar.angle}
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {pillar.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold">Vill ni slippa hålla registret själva?</h2>
            <p className="mt-4 leading-8 text-zinc-300">
              FgasPortal kan användas som ett verktyg av er organisation, eller
              som en tjänst där vi hjälper till med registerhållning,
              kontrollbevakning och rapportunderlag.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {offers.map((offer) => (
              <article
                key={offer.title}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-6"
              >
                <h3 className="text-xl font-semibold">{offer.title}</h3>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
                  {offer.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Logga in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              Skapa konto
            </Link>
            <a
              href="mailto:info@fgasportal.se"
              className="rounded-md border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
            >
              Kontakta oss
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-3xl font-bold">Mindre manuellt arbete, bättre kontroll</h2>
          <p className="mt-4 max-w-3xl leading-8 text-zinc-700 dark:text-zinc-300">
            FgasPortal ersätter inte operatörens ansvar och gör inga utfästelser
            om garanterad regelefterlevnad. Tjänsten hjälper däremot till att
            strukturera information, flagga risker, bevaka kontrollintervall och
            ta fram underlag som gör F-gasarbetet lättare att följa upp.
          </p>
        </div>
      </section>
    </main>
  )
}
