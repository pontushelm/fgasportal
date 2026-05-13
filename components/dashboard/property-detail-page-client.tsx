"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useId, useState } from "react"
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
    dueSoonInspections: number
    overdueInspections: number
    notInspected: number
    highRiskInstallations: number
    riskDistribution: Record<InstallationRiskLevel, number>
    leakageClimateImpact: {
      leakageEventsCount: number
      leakageAmountKg: number
      leakageCo2eTon: number
      unknownLeakageCo2eCount: number
      isLeakageCo2eIncomplete: boolean
    }
    reportOverview: {
      controlRequiredInstallations: number
      completeReportDataInstallations: number
      installationsWithReportWarnings: number
      leakageEventsThisYear: number
      recoveredAmountKgThisYear: number
      totalCo2eTon: number | null
      knownCo2eTon: number
      unknownCo2eInstallations: number
    }
    annualReportStatus: {
      requirementStatus: "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
      signedStatus: "SIGNED" | "NOT_SIGNED" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA" | null
      signedAt: string | null
      blockingIssueCount: number
      reviewWarningCount: number
      installedCo2eTon: number
      co2eIsComplete: boolean
      href: string
    }
  }
  installations: Array<{
    id: string
    name: string
    equipmentId: string | null
    location: string
    refrigerantType: string
    refrigerantAmount: number
    assignedContractorId: string | null
    nextInspection: string | null
    co2eTon: number | null
    complianceStatus: ComplianceStatus
    riskLevel: InstallationRiskLevel
  }>
  actions: Array<{
    id: string
    severity: "HIGH" | "MEDIUM" | "LOW"
    title: string
    description: string
    installationName: string
    equipmentId: string | null
    href: string
    dueDate: string | null
    createdAt: string | null
  }>
  serviceContacts: Array<{
    id: string
    name: string
    email: string
  }>
  recentEvents: Array<{
    id: string
    date: string
    type: string
    refrigerantAddedKg: number | null
    notes: string | null
    installationId: string
    installationName: string
  }>
  historicalMetrics: Array<{
    year: number
    leakageEventsCount: number
    leakedAmountKg: number
    recoveredAmountKg: number
    controlsPerformed: number
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

const installationPreviewLimit = 5

export default function PropertyDetailPageClient() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<PropertyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isInstallationListExpanded, setIsInstallationListExpanded] = useState(false)

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

  const visibleInstallations = data
    ? isInstallationListExpanded
      ? data.installations
      : data.installations.slice(0, installationPreviewLimit)
    : []

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          data ? (
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonClassName({ variant: "primary" })}
                href={`/dashboard/reports?propertyId=${data.property.id}`}
              >
                Skapa årsrapport för fastigheten
              </Link>
              <Link
                className={buttonClassName({ variant: "secondary" })}
                href={`/dashboard/actions?property=${data.property.id}`}
              >
                Visa åtgärder för fastigheten
              </Link>
              <Link
                className={buttonClassName({ variant: "secondary" })}
                href={`/dashboard/installations?propertyId=${data.property.id}`}
              >
                Visa aggregat
              </Link>
            </div>
          ) : null
        }
        backHref="/dashboard/properties"
        backLabel="Tillbaka till fastigheter"
        title={data?.property.name ?? "Fastighet"}
        subtitle="Efterlevnad, risk och klimatpåverkan för fastigheten."
      />

      {isLoading && <p className="mt-8 text-sm text-slate-700">Laddar fastighet...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {data && !isLoading && (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              description="Uppskattad klimatpåverkan från registrerade läckagehändelser under innevarande år. Separat från installerad CO₂e."
              label="Läckage i år"
              value={`${formatNumber(data.summary.leakageClimateImpact.leakageCo2eTon)} ton`}
              tone={data.summary.leakageClimateImpact.leakageEventsCount > 0 ? "red" : "slate"}
            />
            <MetricCard
              description="Aggregat där nästa läckagekontroll har passerat."
              label="Försenade kontroller"
              value={data.summary.overdueInspections}
              tone="red"
            />
            <MetricCard
              description="Aggregat med kontroll inom 30 dagar."
              label="Kommande kontroller"
              value={data.summary.dueSoonInspections}
              tone="amber"
            />
            <MetricCard
              description="Aggregat med hög risk baserat på CO₂e, försenad kontroll eller läckagehistorik."
              label="Högriskaggregat"
              value={data.summary.highRiskInstallations}
              tone="amber"
            />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="p-5">
              <SectionHeader
                title="Rapportöversikt"
                subtitle="Status för årsrapport och rapportunderlag för fastigheten."
              />
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Årsrapport enligt 14 ton CO₂e
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatAnnualReportRequirementStatus(
                        data.summary.annualReportStatus.requirementStatus
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Installerad CO₂e för kontrollpliktiga aggregat:{" "}
                      {formatWholeTonnes(
                        data.summary.annualReportStatus.installedCo2eTon
                      )}
                    </p>
                  </div>
                  <AnnualReportRequirementBadge
                    status={data.summary.annualReportStatus.requirementStatus}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span>
                    Signering:{" "}
                    {formatSignedReportStatus(
                      data.summary.annualReportStatus.signedStatus
                    )}
                  </span>
                  {data.summary.annualReportStatus.signedAt && (
                    <span>
                      Senast signerad:{" "}
                      {formatOptionalDate(data.summary.annualReportStatus.signedAt)}
                    </span>
                  )}
                  {(data.summary.annualReportStatus.blockingIssueCount > 0 ||
                    data.summary.annualReportStatus.reviewWarningCount > 0) && (
                    <span>
                      {data.summary.annualReportStatus.blockingIssueCount} kräver
                      komplettering,{" "}
                      {data.summary.annualReportStatus.reviewWarningCount} bör
                      granskas
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ReportMetric
                  label="Kontrollpliktiga aggregat"
                  value={data.summary.reportOverview.controlRequiredInstallations}
                />
                <ReportMetric
                  label="Rapportunderlag klart"
                  value={`${data.summary.reportOverview.completeReportDataInstallations}/${data.summary.reportOverview.controlRequiredInstallations}`}
                />
                <ReportMetric
                  label="Bör kontrolleras"
                  value={data.summary.reportOverview.installationsWithReportWarnings}
                  tone={
                    data.summary.reportOverview.installationsWithReportWarnings > 0
                      ? "amber"
                      : "green"
                  }
                />
                <ReportMetric
                  label="Läckage i år"
                  value={data.summary.reportOverview.leakageEventsThisYear}
                  tone={
                    data.summary.reportOverview.leakageEventsThisYear > 0
                      ? "red"
                      : "slate"
                  }
                />
                <ReportMetric
                  label="Omhändertaget köldmedium"
                  value={`${formatNumber(data.summary.reportOverview.recoveredAmountKgThisYear)} kg`}
                />
                <ReportMetric
                  label="Total CO₂e"
                  value={formatReportCo2e(data.summary.reportOverview)}
                  tone={
                    data.summary.reportOverview.unknownCo2eInstallations > 0
                      ? "amber"
                      : "slate"
                  }
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Rapportunderlag klart visar aggregat med tillräckliga uppgifter.
                Bör kontrolleras betyder att uppgifter behöver granskas.
              </p>
              {data.summary.reportOverview.unknownCo2eInstallations > 0 && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {data.summary.reportOverview.unknownCo2eInstallations} aggregat
                  saknar känt GWP/CO₂e-värde. Totalen visas därför som ofullständig.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Historik per år"
                subtitle="Läckage, omhändertagen mängd och utförda kontroller."
              />
              {data.historicalMetrics.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  Ingen historik finns registrerad för fastighetens aggregat.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <TableHeader>År</TableHeader>
                        <TableHeader>Läckage</TableHeader>
                        <TableHeader>Läckt mängd</TableHeader>
                        <TableHeader>Omhändertaget</TableHeader>
                        <TableHeader>Kontroller</TableHeader>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.historicalMetrics.slice(0, 5).map((metric) => (
                        <tr key={metric.year}>
                          <TableCell>{metric.year}</TableCell>
                          <TableCell>{metric.leakageEventsCount}</TableCell>
                          <TableCell>{formatNumber(metric.leakedAmountKg)} kg</TableCell>
                          <TableCell>{formatNumber(metric.recoveredAmountKg)} kg</TableCell>
                          <TableCell>{metric.controlsPerformed}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          <section className="mt-6 grid items-stretch gap-6 lg:grid-cols-2">
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
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <RiskBox label="Hög" value={data.summary.riskDistribution.HIGH} tone="red" />
                <RiskBox label="Medel" value={data.summary.riskDistribution.MEDIUM} tone="amber" />
                <RiskBox label="Låg" value={data.summary.riskDistribution.LOW} tone="green" />
              </div>
            </Card>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <SectionHeader
                title="Åtgärder"
                subtitle="Åtgärder som rör aggregat på den här fastigheten."
              />
              {data.actions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Inga aktuella åtgärder.</p>
              ) : (
                <ul className="mt-4 grid gap-3 text-sm">
                  {data.actions.slice(0, 5).map((action) => (
                    <li className="rounded-lg border border-slate-200 p-3" key={action.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                            href={action.href}
                          >
                            {action.title}
                          </Link>
                          <p className="mt-1 text-slate-600">{action.installationName}</p>
                        </div>
                        <ActionSeverityBadge severity={action.severity} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader title="Servicepartners" />
              {data.serviceContacts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Inga servicepartners tilldelade.</p>
              ) : (
                <ul className="mt-4 grid gap-2 text-sm">
                  {data.serviceContacts.map((contact) => (
                    <li className="rounded-lg bg-slate-50 p-3" key={contact.id}>
                      <p className="font-semibold text-slate-950">{contact.name}</p>
                      <p className="text-slate-600">{contact.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader title="Senaste händelser" />
              {data.recentEvents.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Inga händelser registrerade.</p>
              ) : (
                <ul className="mt-4 grid gap-2 text-sm">
                  {data.recentEvents.slice(0, 6).map((event) => (
                    <li className="rounded-lg bg-slate-50 p-3" key={event.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">
                          {formatEventType(event.type)}
                        </p>
                        <span className="text-xs text-slate-500">
                          {formatOptionalDate(event.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">{event.installationName}</p>
                    </li>
                  ))}
                </ul>
              )}
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
                    {visibleInstallations.map((installation) => (
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
                <ShowMoreButton
                  isExpanded={isInstallationListExpanded}
                  itemCount={data.installations.length}
                  limit={installationPreviewLimit}
                  onClick={() =>
                    setIsInstallationListExpanded((current) => !current)
                  }
                />
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
  const tooltipId = useId()
  const toneClass = {
    slate: "border-l-slate-300",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  }[tone]

  return (
    <Card
      aria-describedby={tooltipId}
      className={`group relative flex min-h-28 flex-col justify-center border-l-4 p-4 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${toneClass}`}
      tabIndex={0}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <div
        className="pointer-events-none absolute left-3 right-3 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {description}
      </div>
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
    <div className={`flex min-h-24 flex-col justify-center rounded-lg border px-4 py-3 text-center ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

function ReportMetric({
  label,
  tone = "slate",
  value,
}: {
  label: string
  tone?: "slate" | "amber" | "red" | "green"
  value: number | string
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-950",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
  }[tone]

  return (
    <div className={`rounded-lg px-3 py-2.5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}

function AnnualReportRequirementBadge({
  status,
}: {
  status: PropertyDetail["summary"]["annualReportStatus"]["requirementStatus"]
}) {
  const variant =
    status === "REQUIRED" ? "warning" : status === "UNCERTAIN" ? "info" : "success"

  return <Badge variant={variant}>{formatAnnualReportRequirementStatus(status)}</Badge>
}

function ShowMoreButton({
  isExpanded,
  itemCount,
  limit,
  onClick,
}: {
  isExpanded: boolean
  itemCount: number
  limit: number
  onClick: () => void
}) {
  if (itemCount <= limit) return null

  return (
    <div className="border-t border-slate-200 bg-white px-5 py-4 text-center">
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        type="button"
        onClick={onClick}
      >
        {isExpanded ? "Visa mindre" : `Visa mer (${itemCount - limit})`}
      </button>
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

function ActionSeverityBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  const variant = severity === "HIGH" ? "danger" : severity === "MEDIUM" ? "warning" : "neutral"
  const label = severity === "HIGH" ? "Hög" : severity === "MEDIUM" ? "Medel" : "Låg"

  return <Badge variant={variant}>{label}</Badge>
}

function formatEventType(type: string) {
  const labels: Record<string, string> = {
    INSPECTION: "Kontroll",
    LEAK: "Läckage",
    REFILL: "Påfyllning",
    SERVICE: "Service",
    REPAIR: "Reparation",
    RECOVERY: "Tömning / återvinning",
    REFRIGERANT_CHANGE: "Byte av köldmedium",
  }

  return labels[type] ?? type
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

function formatWholeTonnes(value: number) {
  return `${new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} ton`
}

function formatAnnualReportRequirementStatus(
  status: PropertyDetail["summary"]["annualReportStatus"]["requirementStatus"]
) {
  if (status === "REQUIRED") return "Årsrapport krävs"
  if (status === "UNCERTAIN") return "Kräver kontroll av underlag"
  return "Årsrapport krävs inte"
}

function formatSignedReportStatus(
  status: PropertyDetail["summary"]["annualReportStatus"]["signedStatus"]
) {
  if (status === "SIGNED") return "Signerad"
  if (status === "HAS_WARNINGS") return "Signerad med varningar"
  if (status === "MISSING_REQUIRED_DATA") return "Signerad, kräver komplettering"
  if (status === "NOT_SIGNED") return "Ej signerad"
  return "Ej relevant"
}

function formatReportCo2e(
  reportOverview: PropertyDetail["summary"]["reportOverview"]
) {
  if (reportOverview.totalCo2eTon !== null) {
    return `${formatNumber(reportOverview.totalCo2eTon)} ton`
  }

  return `Ofullständig (${formatNumber(reportOverview.knownCo2eTon)} ton känt)`
}
