import Link from "next/link"

const features = [
  {
    title: "Aggregatregister",
    text: "Samla aggregat, placering, köldmedium, mängd och ansvarig operatör i ett tydligt register.",
  },
  {
    title: "Automatiska kontrollpåminnelser",
    text: "Fånga upp försenade kontroller och sådant som förfaller inom 30 dagar.",
  },
  {
    title: "CO₂e-beräkning",
    text: "Beräkna klimatpåverkan utifrån köldmedium, GWP och fyllnadsmängd.",
  },
  {
    title: "Kontrollintervall",
    text: "Håll reda på kontrollkrav, senaste kontroll och nästa planerade kontroll.",
  },
  {
    title: "Läckagevarningar",
    text: "Dokumentera läckagevarningssystem och få rätt underlag för kontrollplanering.",
  },
  {
    title: "Export till CSV och PDF",
    text: "Ta fram registerunderlag för intern uppföljning, rapportering och tillsyn.",
  },
  {
    title: "Roller och användare",
    text: "Bjud in kollegor och skilj mellan administratörer och läsbehöriga medlemmar.",
  },
]

const dashboardStats = [
  { label: "Försenade kontroller", value: "3", tone: "text-red-700 dark:text-red-300" },
  { label: "Kontroller inom 30 dagar", value: "8", tone: "text-amber-700 dark:text-amber-300" },
  { label: "Totalt CO₂e", value: "42,6 ton", tone: "text-emerald-700 dark:text-emerald-300" },
  { label: "Ej kontrollerade aggregat", value: "5", tone: "text-blue-700 dark:text-blue-300" },
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
            F-gasregister för professionella operatörer
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Full kontroll över F-gasaggregat och kontroller
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700 dark:text-zinc-300">
            FgasPortal hjälper operatörer att hålla ordning på aggregat,
            kontrollintervall, CO₂e och påminnelser, utan krångliga
            Excel-register.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Logga in
            </Link>
            <Link
              href="#funktioner"
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              Se funktioner
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Dashboard</p>
              <h2 className="text-xl font-semibold">Kontrollöversikt</h2>
            </div>
            <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
              Live register
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
            Nästa åtgärd: planera kontroller för aggregat som förfaller inom 30
            dagar och följ upp försenade objekt.
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Slipp osäkra Excel-register</h2>
          </div>
          <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
            <p>
              Manuella register gör det svårt att se missade kontroller,
              kommande kontrollbehov och total klimatpåverkan.
            </p>
            <p>
              FgasPortal minskar risken vid tillsyn genom bättre överblick,
              tydligare ansvar och exportbart underlag.
            </p>
          </div>
        </div>
      </section>

      <section id="funktioner" className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold">All F-gasdata samlad på ett ställe</h2>
          <p className="mt-4 text-zinc-700 dark:text-zinc-300">
            Byggt för fastighetsägare, facility managers, kommuner, regioner,
            industriella operatörer och miljöansvariga.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-[0.8fr_1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Registerhållning och intern kontroll
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Förbered organisationen inför uppföljning och tillsyn
            </h2>
          </div>
          <p className="leading-8 text-zinc-300">
            FgasPortal är byggt för operatörer som behöver pålitlig
            registerhållning, tydliga kontrollintervall och bättre intern
            kontroll av F-gasaggregat över flera fastigheter eller verksamheter.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-3xl font-bold">Kom igång med FgasPortal</h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-700 dark:text-zinc-300">
            Skapa ett konto eller logga in för att börja strukturera aggregat,
            kontroller, CO₂e och påminnelser.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Skapa konto
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-zinc-300 px-5 py-3 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Logga in
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
