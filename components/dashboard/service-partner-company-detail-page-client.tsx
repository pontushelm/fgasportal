"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge, buttonClassName, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui"
import type { CertificationStatusResult } from "@/lib/certification-status"
import type { DashboardActionSeverity, DashboardActionType } from "@/lib/actions/generate-actions"
import type { ComplianceStatus } from "@/lib/fgas-calculations"

type ServicePartnerCompanyDetail = {
  company: {
    id: string
    name: string
    organizationNumber: string | null
    contactEmail: string | null
    phone: string | null
    notes: string | null
  }
  metrics: {
    linkedContactsCount: number
    assignedInstallationsCount: number
    overdueInspections: number
    dueSoonInspections: number
    highRiskInstallations: number
    leakageEventsCount: number
    certificationWarnings: number
    latestActivityDate: string | null
  }
  contractors: Array<{
    id: string
    name: string
    email: string
    certificationNumber: string | null
    certificationOrganization: string | null
    certificationValidUntil: string | null
    certificationStatus: CertificationStatusResult
    assignedInstallationsCount: number
    overdueInspections: number
    dueSoonInspections: number
    highRiskInstallations: number
    leakageEventsCount: number
    latestActivityDate: string | null
  }>
  installations: Array<{
    id: string
    name: string
    equipmentId: string | null
    propertyName: string | null
    refrigerantType: string
    refrigerantAmount: number
    nextInspection: string | null
    complianceStatus: ComplianceStatus
    riskLevel: "LOW" | "MEDIUM" | "HIGH"
    assignedContractor: {
      id: string
      name: string
      email: string
    }
    leakageEventsCount: number
    latestActivityDate: string | null
  }>
  actions: Array<{
    id: string
    type: DashboardActionType
    severity: DashboardActionSeverity
    title: string
    description: string
    installationName: string
    equipmentId: string | null
    propertyName: string | null
    assignedServiceContactName: string | null
    href: string
    dueDate: string | null
    createdAt: string | null
  }>
}

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Inom 30 dagar",
  OVERDUE: "Försenad",
  NOT_REQUIRED: "Ej kontrollpliktig",
  NOT_INSPECTED: "Ej kontrollerad",
}

const RISK_LABELS = {
  LOW: "Låg",
  MEDIUM: "Medel",
  HIGH: "Hög",
} as const

const ACTION_TYPE_LABELS: Record<DashboardActionType, string> = {
  OVERDUE_INSPECTION: "Försenad kontroll",
  DUE_SOON_INSPECTION: "Kommande kontroll",
  NOT_INSPECTED: "Saknar kontroll",
  HIGH_RISK: "Hög risk",
  NO_SERVICE_PARTNER: "Servicekontakt saknas",
  RECENT_LEAKAGE: "Läckageuppföljning",
}

export default function ServicePartnerCompanyDetailPageClient({
  companyId,
}: {
  companyId: string
}) {
  const router = useRouter()
  const [data, setData] = useState<ServicePartnerCompanyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchCompany() {
      setIsLoading(true)
      setError("")

      const response = await fetch(`/api/service-partner-companies/${companyId}`, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError(
          response.status === 403
            ? "Du har inte behörighet att se serviceföretaget."
            : "Kunde inte hämta serviceföretaget."
        )
        setIsLoading(false)
        return
      }

      const result: ServicePartnerCompanyDetail = await response.json()
      if (!isMounted) return
      setData(result)
      setIsLoading(false)
    }

    void fetchCompany()

    return () => {
      isMounted = false
    }
  }, [companyId, router])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        title={data?.company.name ?? "Serviceföretag"}
        subtitle="Operativ översikt över aggregat via kopplade servicekontakter."
        actions={
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/dashboard/contractors"
          >
            Till servicekontakter
          </Link>
        }
      />

      <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
        Denna vy sammanställer aggregat som är tilldelade servicekontakter
        kopplade till företaget. Full företagstilldelning kan byggas ut senare.
      </div>

      {isLoading && (
        <p className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Laddar serviceföretag...
        </p>
      )}
      {error && <p className="mt-8 text-sm font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && data && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              className={buttonClassName({ variant: "secondary" })}
              href={`/dashboard/actions?servicePartnerCompany=${data.company.id}`}
            >
              Visa relaterade åtgärder
            </Link>
            <Link
              className={buttonClassName({ variant: "secondary" })}
              href={`/dashboard/installations?servicePartnerCompanyId=${data.company.id}`}
            >
              Visa kopplade aggregat
            </Link>
          </div>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <MetricCard label="Kontakter" value={data.metrics.linkedContactsCount} />
            <MetricCard
              label="Aggregat via kontakter"
              value={data.metrics.assignedInstallationsCount}
            />
            <MetricCard
              label="Försenade kontroller"
              tone={data.metrics.overdueInspections > 0 ? "danger" : "success"}
              value={data.metrics.overdueInspections}
            />
            <MetricCard
              label="Inom 30 dagar"
              tone={data.metrics.dueSoonInspections > 0 ? "warning" : "success"}
              value={data.metrics.dueSoonInspections}
            />
            <MetricCard
              label="Högriskaggregat"
              tone={data.metrics.highRiskInstallations > 0 ? "warning" : "success"}
              value={data.metrics.highRiskInstallations}
            />
            <MetricCard
              label="Läckage i år"
              tone={data.metrics.leakageEventsCount > 0 ? "warning" : "success"}
              value={data.metrics.leakageEventsCount}
            />
            <MetricCard
              label="Certifieringsvarningar"
              tone={data.metrics.certificationWarnings > 0 ? "warning" : "success"}
              value={data.metrics.certificationWarnings}
            />
          </section>

          <Card className="mt-6 p-5">
            <SectionHeader
              title="Företagsuppgifter"
              subtitle="Kontaktuppgifter för serviceföretaget."
            />
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Organisationsnummer" value={data.company.organizationNumber} />
              <DetailItem label="E-post" value={data.company.contactEmail} />
              <DetailItem label="Telefon" value={data.company.phone} />
              <DetailItem
                label="Senaste aktivitet"
                value={formatOptionalDateTime(data.metrics.latestActivityDate)}
              />
              {data.company.notes && (
                <DetailItem className="lg:col-span-4" label="Anteckningar" value={data.company.notes} />
              )}
            </dl>
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Relaterade åtgärder"
                subtitle="Prioriterade åtgärder via företagets kopplade servicekontakter."
              />
            </div>
            {data.actions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga aktuella åtgärder."
                  description="När aggregat via företagets servicekontakter kräver uppföljning visas de här."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {data.actions.map((action) => (
                  <article
                    className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    key={action.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={actionSeverityVariant(action.severity)}>
                          {actionSeverityLabel(action.severity)}
                        </Badge>
                        <Badge variant="neutral">{ACTION_TYPE_LABELS[action.type]}</Badge>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {action.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {action.installationName}
                        {action.equipmentId ? (
                          <span className="font-normal text-slate-600 dark:text-slate-400">
                            {" "}
                            · {action.equipmentId}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {action.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>Fastighet: {action.propertyName || "-"}</span>
                        <span>Servicekontakt: {action.assignedServiceContactName || "-"}</span>
                        <span>Datum: {formatActionDate(action)}</span>
                      </div>
                    </div>
                    <Link
                      className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      href={action.href}
                    >
                      Öppna aggregat
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Kopplade servicekontakter"
                subtitle="Certifiering och arbetsläge per kontakt."
              />
            </div>
            {data.contractors.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga servicekontakter är kopplade till företaget."
                  description="Koppla servicekontakter från servicekontaktsidan för att bygga upp företagets översikt."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <TableHeader>Kontakt</TableHeader>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Försenade</TableHeader>
                      <TableHeader>Inom 30 dagar</TableHeader>
                      <TableHeader>Hög risk</TableHeader>
                      <TableHeader>Läckage i år</TableHeader>
                      <TableHeader>Certifiering</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.contractors.map((contractor) => (
                      <tr key={contractor.id}>
                        <TableCell>
                          <Link
                            className="font-semibold underline-offset-4 hover:underline"
                            href={`/dashboard/installations?contractorId=${contractor.id}`}
                          >
                            {contractor.name || contractor.email}
                          </Link>
                          {contractor.name && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {contractor.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{contractor.assignedInstallationsCount}</TableCell>
                        <TableCell>{contractor.overdueInspections}</TableCell>
                        <TableCell>{contractor.dueSoonInspections}</TableCell>
                        <TableCell>{contractor.highRiskInstallations}</TableCell>
                        <TableCell>{contractor.leakageEventsCount}</TableCell>
                        <TableCell>
                          <Badge variant={contractor.certificationStatus.variant}>
                            {contractor.certificationStatus.label}
                          </Badge>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Aggregat via kopplade servicekontakter"
                subtitle="Listan bygger på befintlig tilldelning till enskilda servicekontakter."
              />
            </div>
            {data.installations.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga aggregat visas för företaget."
                  description="Aggregat visas här när de är tilldelade servicekontakter som är kopplade till serviceföretaget."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Fastighet</TableHeader>
                      <TableHeader>Servicekontakt</TableHeader>
                      <TableHeader>Köldmedium</TableHeader>
                      <TableHeader>Nästa kontroll</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Risk</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.installations.map((installation) => (
                      <tr key={installation.id}>
                        <TableCell>
                          <Link
                            className="font-semibold underline-offset-4 hover:underline"
                            href={`/dashboard/installations/${installation.id}`}
                          >
                            {installation.name}
                          </Link>
                          {installation.equipmentId && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {installation.equipmentId}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{installation.propertyName || "-"}</TableCell>
                        <TableCell>{installation.assignedContractor.name}</TableCell>
                        <TableCell>{installation.refrigerantType}</TableCell>
                        <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                        <TableCell>
                          <Badge variant={complianceVariant(installation.complianceStatus)}>
                            {COMPLIANCE_LABELS[installation.complianceStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={riskVariant(installation.riskLevel)}>
                            {RISK_LABELS[installation.riskLevel]}
                          </Badge>
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
  label,
  tone = "neutral",
  value,
}: {
  label: string
  tone?: "danger" | "neutral" | "success" | "warning"
  value: number
}) {
  const accentClassName = {
    danger: "border-l-red-400",
    neutral: "border-l-blue-400",
    success: "border-l-emerald-400",
    warning: "border-l-amber-400",
  }[tone]

  return (
    <Card className={`border-l-4 p-4 ${accentClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">
        {formatNumber(value)}
      </p>
    </Card>
  )
}

function DetailItem({
  className = "",
  label,
  value,
}: {
  className?: string
  label: string
  value?: string | null
}) {
  return (
    <div className={`rounded-md bg-slate-50 p-4 dark:bg-slate-900 ${className}`}>
      <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-100">
        {value || "-"}
      </dd>
    </div>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 align-top text-slate-800 dark:text-slate-200">
      {children}
    </td>
  )
}

function complianceVariant(status: ComplianceStatus) {
  if (status === "OVERDUE") return "danger"
  if (status === "DUE_SOON") return "warning"
  if (status === "OK") return "success"
  return "neutral"
}

function riskVariant(status: "LOW" | "MEDIUM" | "HIGH") {
  if (status === "HIGH") return "danger"
  if (status === "MEDIUM") return "warning"
  return "success"
}

function actionSeverityVariant(severity: DashboardActionSeverity) {
  if (severity === "HIGH") return "danger"
  if (severity === "MEDIUM") return "warning"
  return "neutral"
}

function actionSeverityLabel(severity: DashboardActionSeverity) {
  if (severity === "HIGH") return "Hög"
  if (severity === "MEDIUM") return "Medel"
  return "Låg"
}

function formatActionDate(action: {
  dueDate?: string | null
  createdAt?: string | null
}) {
  return formatOptionalDate(action.dueDate ?? action.createdAt)
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatOptionalDateTime(value?: string | null) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value)
}
