import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"

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
            <Image
              alt="FgasPortal"
              className="h-auto w-44 sm:w-52"
              height={130}
              priority
              src="/logo-full.png"
              width={520}
            />
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            F-gasregister och uppföljning
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Få bättre kontroll över köldmedieaggregat.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600">
            Samla register, kontroller, dokument och rapportunderlag i ett
            webbaserat system byggt för operatörer, driftorganisationer och
            servicepartners.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-700">
            <AuthBenefit>Underlätta uppföljning av kontrollintervall.</AuthBenefit>
            <AuthBenefit>Samla dokument och historik per aggregat.</AuthBenefit>
            <AuthBenefit>Få överblick över CO₂e, risk och årsrapporter.</AuthBenefit>
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
        </section>
      </div>
    </main>
  )
}

function AuthBenefit({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <span>{children}</span>
    </div>
  )
}
