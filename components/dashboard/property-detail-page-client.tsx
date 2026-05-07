"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge, buttonClassName, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import type { InstallationRiskLevel } from "@/lib/risk-classification"

type PropertyDetail = {
  property: {
    id: string
    name: string
    address: string | null
    postalCode: string | null
    city: string | null
    municipality: string | null
    propertyDesignation: string | null
  }
  summary: {
    installationsCount: number
    totalCo2eTon: number
    overdueInspections: number
    highRiskInstallations: number
    riskDistribution: Record<InstallationRiskLevel, number>
  }
  installations: Array<{
    id: string
    name: string
    location: string
    refrigerantType: string
    refrigerantAmount: number
    nextInspection: string | null
    co2eTon: number | null
    complianceStatus: ComplianceStatus
    riskLevel: InstallationRiskLevel
  }>
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Inom 30 dagar",
  OVERDUE: "Försenad",
  NOT_REQUIRED: "Ej kontrollpliktig",
  NOT_INSPECTED: "Ej kontrollerad",
}

const RISK_LABELS: Record<InstallationRiskLevel, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

export default function PropertyDetailPageClient() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<PropertyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchProperty() {
      setIsLoading(true)
      setError("")

      const response = await fetch(`/api/properties/${params.id}/overview`, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError(response.status === 404 ? "Fastigheten hittades inte" : "Kunde inte hämta fastigheten")
        setIsLoading(false)
        return
      }

      const propertyData: PropertyDetail = await response.json()
      if (!isMounted) return

      setData(propertyData)
      setIsLoading(false)
    }

    void fetchProperty()

    return () => {
      isMounted = false
    }
  }, [params.id, router])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          data ? (
            <Link
              className={buttonClassName({ variant: "secondary" })}
              href={`/dashboard/installations?propertyId=${data.property.id}`}
            >
              Visa filtrerad aggregatlista
            </Link>
          ) : null
        }
        backHref="/dashboard/properties"
        backLabel="Tillbaka till fastigheter"
        eyebrow="Fastighet"
        title={data?.property.name ?? "Fastighet"}
        subtitle="Compliance, risk och klimatpåverkan för fastigheten."
      />

      {isLoading && <p className="mt-8 text-sm text-slate-700">Laddar fastighet...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {data && !isLoading && (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              description="Antal aktiva aggregat kopplade till fastigheten."
              label="Antal aggregat"
              value={data.summary.installationsCount}
            />
            <MetricCard
              description="Samlad klimatpåverkan från köldmedier i fastighetens aggregat."
              label="Total CO₂e"
              value={`${formatNumber(data.summary.totalCo2eTon)} ton`}
            />
            <MetricCard
              description="Aggregat där nästa läckagekontroll har passerat."
              label="Försenade kontroller"
              value={data.summary.overdueInspections}
              tone="red"
            />
            <MetricCard
              description="Aggregat med hög risk baserat på CO₂e, försenad kontroll eller läckagehistorik."
              label="Högriskaggregat"
              value={data.summary.highRiskInstallations}
              tone="amber"
            />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <Card className="p-5">
              <SectionHeader title="Fastighetsinformation" />
              <dl className="mt-5 grid gap-3 text-sm">
                <DetailItem label="Kommun" value={data.property.municipality} />
                <DetailItem label="Ort" value={data.property.city} />
                <DetailItem label="Adress" value={formatAddress(data.property)} />
                <DetailItem label="Fastighetsbeteckning" value={data.property.propertyDesignation} />
              </dl>
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Riskfördelning"
                subtitle="Fördelning mellan hög, medel och låg risk."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <RiskBox label="Hög" value={data.summary.riskDistribution.HIGH} tone="red" />
                <RiskBox label="Medel" value={data.summary.riskDistribution.MEDIUM} tone="amber" />
                <RiskBox label="Låg" value={data.summary.riskDistribution.LOW} tone="green" />
              </div>
            </Card>
          </section>

          <Card className="mt-6 overflow-hidden">
            <div className="p-5">
              <SectionHeader
                title="Aggregat på fastigheten"
                subtitle="Listan visar aktiva aggregat som är kopplade till fastigheten."
              />
            </div>

            {data.installations.length === 0 ? (
              <EmptyState
                className="m-5"
                title="Inga aggregat kopplade"
                description="Koppla aggregat till fastigheten från aggregatlistans bulkåtgärder."
              />
            ) : (
              <div className="overflow-x-auto border-t border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Plats</TableHeader>
                      <TableHeader>Köldmedium</TableHeader>
                      <TableHeader>Mängd</TableHeader>
                      <TableHeader>CO₂e</TableHeader>
                      <TableHeader>Nästa kontroll</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Risk</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {data.installations.map((installation) => (
                      <tr className="hover:bg-slate-50" key={installation.id}>
                        <TableCell>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                            href={`/dashboard/installations/${installation.id}`}
                          >
                            {installation.name}
                          </Link>
                        </TableCell>
                        <TableCell>{installation.location}</TableCell>
                        <TableCell>{installation.refrigerantType}</TableCell>
                        <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                        <TableCell>{formatCo2eTon(installation.co2eTon)}</TableCell>
                        <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                        <TableCell>
                          <StatusBadge status={installation.complianceStatus} />
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={installation.riskLevel} />
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  )
}

function MetricCard({
  description,
  label,
  tone = "slate",
  value,
}: {
  description: string
  label: string
  tone?: "slate" | "red" | "amber"
  value: number | string
}) {
  const toneClass = {
    slate: "border-l-slate-300",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  }[tone]

  return (
    <Card
      aria-label={`${label}: ${description}`}
      className={`flex min-h-28 cursor-help flex-col justify-center border-l-4 p-4 ${toneClass}`}
      title={description}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </Card>
  )
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value || "-"}</dd>
    </div>
  )
}

function RiskBox({
  label,
  tone,
  value,
}: {
  label: string
  tone: "red" | "amber" | "green"
  value: number
}) {
  const toneClass = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tone]

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const variant =
    status === "OVERDUE"
      ? "danger"
      : status === "DUE_SOON"
        ? "warning"
        : status === "OK"
          ? "success"
          : status === "NOT_INSPECTED"
            ? "info"
            : "neutral"

  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>
}

function RiskBadge({ level }: { level: InstallationRiskLevel }) {
  const variant = level === "HIGH" ? "danger" : level === "MEDIUM" ? "warning" : "success"
  return <Badge variant={variant}>{RISK_LABELS[level]}</Badge>
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-slate-800">{children}</td>
}

function formatAddress(property: PropertyDetail["property"]) {
  return [property.address, property.postalCode, property.city]
    .filter(Boolean)
    .join(", ")
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCo2eTon(value: number | null) {
  return value === null ? "Okänt GWP-värde" : `${formatNumber(value)} ton`
}
