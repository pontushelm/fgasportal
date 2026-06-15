"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Badge, Card, PageHeader } from "@/components/ui"
import {
  API_CACHE_KEYS,
  isUnauthorizedApiError,
  useApiQuery,
} from "@/lib/client/api-cache"
import type {
  DataQualityIssue,
  DataQualityReport,
  DataQualitySeverity,
} from "@/lib/dashboard/data-quality"

const SEVERITY_LABELS: Record<DataQualitySeverity, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const SEVERITY_VARIANTS: Record<DataQualitySeverity, "danger" | "warning" | "neutral"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
}

export default function DataQualityPageClient() {
  const router = useRouter()
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="Registerstatus"
          subtitle="Se om registerunderlaget är komplett inför årsrapporter, efterlevnad och löpande uppföljning."
        />

        {isLoading && !report && <DataQualitySkeleton />}
        {hasBlockingError && error && !isUnauthorizedApiError(error) && (
          <p className="mt-8 text-sm text-red-700">
            {error.message || "Kunde inte hämta registerstatus"}
          </p>
        )}

        {report && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <Card className="border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-600">
                  Registerpoäng
                </p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-semibold text-slate-950">
                    {report.score}
                  </span>
                  <span className="pb-1 text-sm text-slate-500">/ 100</span>
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
              </Card>

              <Card className="border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                  Viktigast att åtgärda
                </h2>
                {report.topIssues.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Registret har inga kända brister just nu.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {report.topIssues.map((issue) => (
                      <IssueCard issue={issue} key={issue.id} />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {report.groups.map((group) => (
                <Card className="border-slate-200 bg-white p-5 shadow-sm" key={group.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {group.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {group.totalIssueCount === 0
                          ? "Inga kända brister."
                          : `${group.totalIssueCount} uppgifter behöver ses över.`}
                      </p>
                    </div>
                    <Badge variant={group.totalIssueCount > 0 ? "warning" : "success"}>
                      {group.totalIssueCount}
                    </Badge>
                  </div>

                  {group.issues.length === 0 ? (
                    <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      Klart i den här gruppen.
                    </p>
                  ) : (
                    <div className="mt-5 divide-y divide-slate-100">
                      {group.issues.map((issue) => (
                        <IssueRow issue={issue} key={issue.id} />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function IssueCard({ issue }: { issue: DataQualityIssue }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <Badge variant={SEVERITY_VARIANTS[issue.severity]}>
        {SEVERITY_LABELS[issue.severity]}
      </Badge>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{issue.count}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{issue.title}</p>
      <Link
        className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
        href={issue.route}
      >
        {issue.ctaLabel}
      </Link>
    </div>
  )
}

function IssueRow({ issue }: { issue: DataQualityIssue }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950">
            {issue.count} {issue.title.toLowerCase()}
          </p>
          <Badge variant={SEVERITY_VARIANTS[issue.severity]}>
            {SEVERITY_LABELS[issue.severity]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
      </div>
      <Link
        className="inline-flex shrink-0 justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
        href={issue.route}
      >
        {issue.ctaLabel}
      </Link>
    </div>
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
