import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/legal-links"

export const metadata: Metadata = {
  title: "Användarvillkor | FgasPortal",
  description: "Användarvillkor för FgasPortal.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href="/">
          Tillbaka till FgasPortal
        </Link>
        <header className="mt-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Användarvillkor</h1>
          <p className="mt-2 text-sm text-slate-600">
            Senast uppdaterad: 2026-05-07
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <Section title="Om tjänsten">
            <p>
              FgasPortal är en webbaserad plattform för F-gasregister,
              aggregatdata, fastighetskopplingar, kontrollhistorik,
              dokumentation, servicepartnerflöden och rapportunderlag.
            </p>
          </Section>

          <Section title="Ansvarsfördelning">
            <p>
              FgasPortal tillhandahåller systemstöd för struktur, spårbarhet och
              uppföljning. Kunden ansvarar för att uppgifter som registreras i
              tjänsten är korrekta, aktuella och fullständiga samt för att
              uppfylla tillämpliga lagkrav och myndighetskrav.
            </p>
          </Section>

          <Section title="Användning av tjänsten">
            <p>
              Användare ska använda FgasPortal på ett ansvarsfullt sätt och
              endast inom ramen för sin behörighet. Inloggningsuppgifter är
              personliga och ska skyddas mot obehörig åtkomst.
            </p>
          </Section>

          <Section title="Kundens ansvar för data">
            <p>
              Kunden ansvarar för aggregatregister, fastighetsdata,
              kontaktuppgifter, dokument, historik och annan information som
              läggs in eller laddas upp i tjänsten. Kunden ansvarar även för att
              behörigheter till egna användare och servicepartners hålls
              uppdaterade.
            </p>
          </Section>

          <Section title="Tillgänglighet">
            <p>
              FgasPortal strävar efter god tillgänglighet och stabil drift.
              Planerat underhåll, tekniska störningar eller driftproblem hos
              underliggande leverantörer kan påverka åtkomsten till tjänsten.
            </p>
          </Section>

          <Section title="Begränsning av ansvar">
            <p>
              FgasPortal ersätter inte kundens juridiska, tekniska eller
              regulatoriska ansvar. Tjänsten ska ses som ett stöd för
              registerhållning och uppföljning. Kunden ansvarar för egna
              beslut, rapportering och kontakter med tillsynsmyndigheter.
            </p>
          </Section>

          <Section title="Kontaktinformation">
            <p>
              Frågor om villkoren eller användning av tjänsten kan skickas till{" "}
              <a href="mailto:info@fgasportal.se">info@fgasportal.se</a>.
            </p>
          </Section>
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm">
          <LegalLinks />
        </footer>
      </div>
    </main>
  )
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  )
}
