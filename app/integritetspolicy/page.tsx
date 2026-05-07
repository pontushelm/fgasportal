import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/legal-links"

export const metadata: Metadata = {
  title: "Integritetspolicy | FgasPortal",
  description: "Integritetspolicy för FgasPortal.",
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Integritetspolicy" updatedAt="Senast uppdaterad: 2026-05-07">
      <Section title="Översikt">
        <p>
          FgasPortal är en B2B-tjänst för F-gasregister, uppföljning,
          dokumentation och rapportering. Denna integritetspolicy beskriver på
          ett praktiskt sätt vilka personuppgifter och verksamhetsuppgifter som
          kan behandlas i tjänsten.
        </p>
        <p>
          Kunden ansvarar normalt för de uppgifter som läggs in i tjänsten.
          FgasPortal behandlar uppgifter för att kunna tillhandahålla,
          administrera, säkra och vidareutveckla plattformen.
        </p>
      </Section>

      <Section title="Vilka personuppgifter som lagras">
        <p>
          Uppgifter kan omfatta namn, e-postadress, roll, företagskoppling,
          inbjudningar, kontostatus, tema- och användarinställningar samt
          tekniska uppgifter som behövs för säker inloggning och behörighet.
        </p>
      </Section>

      <Section title="Användarkonton och kontaktuppgifter">
        <p>
          FgasPortal behandlar uppgifter om användarkonton för att kunna hantera
          inloggning, behörigheter, rollfördelning, företagsmedlemskap och
          servicepartneråtkomst. Kontaktuppgifter kan användas för viktiga
          systemmeddelanden, inbjudningar, lösenordsåterställning och
          påminnelser som rör F-gasuppföljningen.
        </p>
      </Section>

      <Section title="Aggregat- och fastighetsdata">
        <p>
          Tjänsten lagrar registerdata om aggregat, köldmedium, mängder,
          kontrollintervall, fastigheter, kommun, placering, servicepartners,
          kontrollstatus, läckage, påfyllningar, skrotning och annan historik.
          Sådan data är främst verksamhets- och complianceinformation, men kan
          innehålla personuppgifter om den kopplas till namngivna användare,
          kontaktpersoner eller tekniker.
        </p>
      </Section>

      <Section title="Aktivitetsloggar">
        <p>
          FgasPortal sparar aktivitetsloggar för spårbarhet, säkerhet och
          regelefterlevnad. Loggar kan visa vem som registrerat, ändrat,
          arkiverat, skrotat, tilldelat eller laddat upp information i
          systemet.
        </p>
      </Section>

      <Section title="Dokument">
        <p>
          Kunder och behöriga användare kan ladda upp dokument, exempelvis
          kontrollrapporter, serviceprotokoll, läckagerapporter,
          myndighetsunderlag och skrotningsintyg. Kunden ansvarar för att
          dokumenten är relevanta och att de inte innehåller fler personuppgifter
          än nödvändigt.
        </p>
      </Section>

      <Section title="Varför data behandlas">
        <p>Data behandlas för att:</p>
        <ul>
          <li>tillhandahålla och säkra FgasPortal,</li>
          <li>hantera inloggning, behörighet och multi-tenant åtkomst,</li>
          <li>möjliggöra registerhållning och F-gasuppföljning,</li>
          <li>skapa rapporter, påminnelser och dokumentationsunderlag,</li>
          <li>upprätthålla spårbarhet genom aktivitetsloggar,</li>
          <li>ge support och administrera kundrelationen.</li>
        </ul>
      </Section>

      <Section title="Hur länge data sparas">
        <p>
          Uppgifter sparas så länge kundrelationen består och så länge de behövs
          för tjänstens ändamål, rättsliga krav, avtal, säkerhet eller
          spårbarhet. Aggregat- och dokumenthistorik kan behöva sparas under
          längre tid eftersom F-gasrapportering och tillsyn ofta kräver
          historiskt underlag. Radering eller export hanteras enligt avtal och
          tillämplig lag.
        </p>
      </Section>

      <Section title="Underbiträden och tjänsteleverantörer">
        <p>
          FgasPortal kan använda följande leverantörer för drift och
          tillhandahållande av tjänsten:
        </p>
        <ul>
          <li>Vercel för hosting och applikationsdrift.</li>
          <li>Neon/PostgreSQL för databastjänster.</li>
          <li>Resend för transaktionella e-postmeddelanden.</li>
          <li>Vercel Blob för lagring av uppladdade dokument.</li>
        </ul>
        <p>
          Leverantörer används endast för att tillhandahålla tjänsten och inte
          för marknadsföringsspårning i den nuvarande implementationen.
        </p>
      </Section>

      <Section title="Kontakt för integritetsfrågor">
        <p>
          Vid frågor om integritet, personuppgifter, registerutdrag, rättelse
          eller radering, kontakta FgasPortal via{" "}
          <a href="mailto:info@fgasportal.se">info@fgasportal.se</a>.
        </p>
      </Section>
    </LegalPageShell>
  )
}

function LegalPageShell({
  children,
  title,
  updatedAt,
}: {
  children: React.ReactNode
  title: string
  updatedAt: string
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href="/">
          Tillbaka till FgasPortal
        </Link>
        <header className="mt-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{updatedAt}</p>
        </header>
        <div className="prose prose-slate mt-8 max-w-none space-y-8 text-sm leading-7 text-slate-700">
          {children}
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
