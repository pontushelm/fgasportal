import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { LegalLinks } from "@/components/legal-links"

export function AuthShell({
  children,
  subtitle,
  title,
}: {
  children: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <section className="max-w-xl">
          <Link className="inline-flex items-center" href="/">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
              <Image
                alt=""
                className="h-10 w-10 mix-blend-multiply"
                height={256}
                priority
                src="/logo-mark.png"
                width={256}
              />
            </span>
            <span className="ml-3 text-2xl font-bold tracking-tight">
              <span className="text-slate-950">Fgas</span>
              <span className="text-emerald-700">Portal</span>
            </span>
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            F-gasregister och uppföljning
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Hantera köldmedieaggregat, uppfyll krav och minska klimatpåverkan.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600">
            Samla register, kontroller, dokumentation och översikt i ett
            system som stödjer rapportering och uppföljning av klimatpåverkan.
          </p>
          <div className="mt-8 grid gap-2 text-sm text-slate-700">
            <AuthBenefit>Översikt av aggregat, kontroller och riskstatus</AuthBenefit>
            <AuthBenefit>Digital registerhållning enligt F-gasförordningen</AuthBenefit>
            <AuthBenefit>Automatiserade rapporter och årsrapportering</AuthBenefit>
            <AuthBenefit>Uppföljning av CO₂e och klimatpåverkan</AuthBenefit>
            <AuthBenefit>Samarbete med servicepartners i systemet</AuthBenefit>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <LegalLinks className="mx-auto mt-5 max-w-md justify-center text-xs" />
        </section>
      </div>
    </main>
  )
}

function AuthBenefit({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
      <span className="leading-6">{children}</span>
    </div>
  )
}
