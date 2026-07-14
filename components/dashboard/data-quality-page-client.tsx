"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, Card, PageHeader } from "@/components/ui"
import {
  API_CACHE_KEYS,
  isUnauthorizedApiError,
  useApiQuery,
} from "@/lib/client/api-cache"
import type { DataQualityReport } from "@/lib/dashboard/data-quality"
import {
  REGISTER_STATUS_FILTER_LABELS,
  buildRegisterStatusPresentation,
  filterRegisterStatusSections,
  formatDataQualitySeverityLabel,
  type RegisterStatusFilter,
  type RegisterStatusIssuePresentation,
  type RegisterStatusSection,
} from "@/lib/dashboard/data-quality-presentation"

export default function DataQualityPageClient() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<RegisterStatusFilter>("all")
  const {
    data: report,
    error,
    isLoading,
  } = useApiQuery<DataQualityReport>(API_CACHE_KEYS.dataQuality)
  const hasBlockingError = Boolean(error && !report)

  useEffect(() => {
    if (isUnauthorizedApiError(error)) {
      router.push("/login")
    }
  }, [error, router])

  const presentation = useMemo(
    () => (report ? buildRegisterStatusPresentation(report) : null),
    [report]
  )
  const visibleSections = useMemo(
    () =>
      presentation
        ? filterRegisterStatusSections(presentation.sections, activeFilter)
        : [],
    [activeFilter, presentation]
  )

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="Registerstatus"
          subtitle="Se vad som behöver fixas först inför rapportering, efterlevnad och löpande uppföljning."
        />

        {isLoading && !report && <DataQualitySkeleton />}
        {hasBlockingError && error && !isUnauthorizedApiError(error) && (
          <p className="mt-8 text-sm text-red-700">
            {error.message || "Kunde inte hämta registerstatus"}
          </p>
        )}

        {report && presentation && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <Card className="border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-600">
                  Registerstatus
                </p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-semibold text-slate-950">
                    {report.score}%
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${report.score}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {report.totalIssueCount === 0
                    ? "Inga brister i registerunderlaget hittades."
                    : `${report.totalIssueCount} uppgifter behöver ses över i ${report.issueCategoryCount} kategorier.`}
                </p>
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-blue-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-100">
                    Så beräknas registerstatus
                  </summary>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    <p>{presentation.scoreExplanation.summary}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {presentation.scoreExplanation.factors.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              </Card>

              <Card className="border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Vad behöver fixas först?
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Börja med kraven inför rapport. Gå sedan vidare till sådant
                      som behöver granskas och rekommenderade förbättringar.
                    </p>
                  </div>
                  <Badge variant={report.totalIssueCount > 0 ? "warning" : "success"}>
                    {report.totalIssueCount} totalt
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {presentation.summary.map((item) => (
                    <a
                      className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 ${sectionSummaryClassName(item.tone)}`}
                      href={`#${item.id}`}
                      key={item.id}
                      onClick={() => setActiveFilter(item.id)}
                    >
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span className="mt-2 block text-3xl font-bold">
                        {item.count}
                      </span>
                    </a>
                  ))}
                </div>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Filtrera registerstatus">
              {(Object.keys(REGISTER_STATUS_FILTER_LABELS) as RegisterStatusFilter[]).map(
                (filter) => {
                  const isActive = activeFilter === filter
                  return (
                    <button
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        isActive
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      type="button"
                    >
                      {REGISTER_STATUS_FILTER_LABELS[filter]}
                    </button>
                  )
                }
              )}
            </div>

            <div className="space-y-4">
              {visibleSections.map((section) => (
                <RegisterStatusSectionCard key={section.id} section={section} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function RegisterStatusSectionCard({
  section,
}: {
  section: RegisterStatusSection
}) {
  return (
    <Card
      className={`border p-5 shadow-sm ${sectionCardClassName(section.tone)}`}
      id={section.id}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            {section.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            {section.purpose}
          </p>
        </div>
        <div className="rounded-lg bg-white/80 px-3 py-2 text-right shadow-sm">
          <div className="text-2xl font-bold text-slate-950">{section.count}</div>
          <div className="text-xs font-semibold text-slate-500">
            {section.issueCategoryCount} kategorier
          </div>
        </div>
      </div>

      {section.issues.length === 0 ? (
        <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Inga kända brister i den här prioriteten.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {section.issues.map((issue) => (
            <IssueCard issue={issue} key={issue.issue.id} />
          ))}
        </div>
      )}
    </Card>
  )
}

function IssueCard({ issue }: { issue: RegisterStatusIssuePresentation }) {
  const dataQualityIssue = issue.issue

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severityVariant(dataQualityIssue.severity)}>
            {formatDataQualitySeverityLabel(dataQualityIssue.severity)}
          </Badge>
          <span className="text-sm font-semibold text-slate-500">
            {dataQualityIssue.count} poster
          </span>
        </div>
        <Link
          className="inline-flex shrink-0 justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
          href={dataQualityIssue.route}
        >
          {dataQualityIssue.ctaLabel}
        </Link>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-950">
        {dataQualityIssue.title}
      </h3>
      <div className="mt-3 grid gap-3 text-sm text-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Varför det spelar roll
          </p>
          <p className="mt-1">{issue.whyItMatters}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rekommenderad åtgärd
          </p>
          <p className="mt-1">{issue.recommendedAction}</p>
        </div>
      </div>
    </article>
  )
}

function DataQualitySkeleton() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white"
          key={index}
        />
      ))}
    </div>
  )
}

function sectionSummaryClassName(tone: RegisterStatusSection["tone"]) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-950"
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950"
  return "border-slate-200 bg-slate-50 text-slate-900"
}

function sectionCardClassName(tone: RegisterStatusSection["tone"]) {
  if (tone === "danger") return "border-red-200 bg-red-50/50"
  if (tone === "warning") return "border-amber-200 bg-amber-50/50"
  return "border-slate-200 bg-white"
}

function severityVariant(severity: "HIGH" | "MEDIUM" | "LOW") {
  if (severity === "HIGH") return "danger"
  if (severity === "MEDIUM") return "warning"
  return "neutral"
}
