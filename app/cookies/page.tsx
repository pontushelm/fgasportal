import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/legal-links"

export const metadata: Metadata = {
  title: "Cookies | FgasPortal",
  description: "Information om cookies och lokal lagring i FgasPortal.",
}

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href="/">
          Tillbaka till FgasPortal
        </Link>
        <header className="mt-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cookies</h1>
          <p className="mt-2 text-sm text-slate-600">
            Senast uppdaterad: 2026-05-07
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-950">Översikt</h2>
            <p>
              FgasPortal använder för närvarande endast en nödvändig
              förstapartscookie för inloggning och säker åtkomst. Tjänsten
              använder även lokal lagring i webbläsaren för att komma ihåg
              användarens tema.
            </p>
            <p>
              FgasPortal använder i nuläget inga annonseringscookies,
              marknadsföringscookies eller tredjepartscookies för spårning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-950">
              Nödvändig cookie
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Namn</th>
                    <th className="px-4 py-3 font-semibold">Syfte</th>
                    <th className="px-4 py-3 font-semibold">Typ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      auth-token
                    </td>
                    <td className="px-4 py-3">
                      Används för inloggning, sessionshantering,
                      behörighetskontroll och aktiv företagskoppling.
                    </td>
                    <td className="px-4 py-3">Nödvändig förstapartscookie</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-950">
              Lokal lagring för tema
            </h2>
            <p>
              FgasPortal använder nyckeln <strong>fgasportal-theme</strong> i
              localStorage för att komma ihåg om användaren valt ljust eller
              mörkt tema. Detta är en preferensinställning och används inte för
              annonsering eller spårning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-950">
              Ingen marknadsföringsspårning
            </h2>
            <p>
              FgasPortal använder för närvarande inte Google Analytics, Google
              Tag Manager, PostHog, Plausible, Hotjar, Sentry-baserad
              webbläsarspårning, annonseringspixlar eller motsvarande
              tredjepartsspårning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-950">
              Ingen cookie-banner
            </h2>
            <p>
              Eftersom nuvarande cookieanvändning är begränsad till nödvändig
              autentisering och enkel användarpreferens visas ingen cookie-banner
              i nuläget.
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm">
          <LegalLinks />
        </footer>
      </div>
    </main>
  )
}
