"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react"
import { Badge, Card, PageHeader } from "@/components/ui"
import type {
  HealthCheckItem,
  HealthCheckStatus,
  HealthReport,
  OverallHealthStatus,
} from "@/lib/health/health-checks"

const OVERALL_LABELS: Record<OverallHealthStatus, string> = {
  HEALTHY: "Healthy",
  NEEDS_ATTENTION: "Needs attention",
  CRITICAL: "Critical issue",
}

const OVERALL_DESCRIPTIONS: Record<OverallHealthStatus, string> = {
  HEALTHY: "Alla kritiska kontroller ser bra ut.",
  NEEDS_ATTENTION: "Systemet fungerar, men en eller flera integrationer behöver ses över.",
  CRITICAL: "En kritisk integration saknas eller svarar inte.",
}

const STATUS_LABELS: Record<HealthCheckStatus, string> = {
  SUCCESS: "OK",
  WARNING: "Warning",
  ERROR: "Error",
}

const STATUS_BADGE_VARIANTS: Record<
  HealthCheckStatus,
  "success" | "warning" | "danger"
> = {
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "danger",
}

export default function HealthPageClient() {
  const router = useRouter()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchHealth() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/dashboard/health", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (response.status === 403) {
        if (!isMounted) return
        setError("Endast ägare kan visa systemhälsa.")
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta systemhälsa.")
        setIsLoading(false)
        return
      }

      const data: HealthReport = await response.json()
      if (!isMounted) return

      setReport(data)
      setIsLoading(false)
    }

    void fetchHealth()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Intern drift"
          title="Systemhälsa"
          subtitle="Snabb kontroll av FgasPortals viktigaste integrationer och driftkonfiguration."
        />

        {isLoading && <HealthSkeleton />}

        {error && (
          <Card className="mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {error}
          </Card>
        )}

        {report && (
          <div className="mt-6 space-y-5">
            <OverallStatusCard report={report} />
            <div className="grid gap-3">
              {report.checks.map((check) => (
                <HealthCheckRow check={check} key={check.id} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function OverallStatusCard({ report }: { report: HealthReport }) {
  const Icon =
    report.overallStatus === "HEALTHY"
      ? CheckCircle2
      : report.overallStatus === "NEEDS_ATTENTION"
        ? AlertTriangle
        : CircleAlert

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={overallIconClassName(report.overallStatus)}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-500">Övergripande status</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              {OVERALL_LABELS[report.overallStatus]}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {OVERALL_DESCRIPTIONS[report.overallStatus]}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Uppdaterad {formatDateTime(report.generatedAt)}
        </p>
      </div>
    </Card>
  )
}

function HealthCheckRow({ check }: { check: HealthCheckItem }) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-[12rem_7rem_minmax(0,1fr)] md:items-start">
        <p className="font-semibold text-slate-950">{check.component}</p>
        <Badge variant={STATUS_BADGE_VARIANTS[check.status]}>
          {STATUS_LABELS[check.status]}
        </Badge>
        <div>
          <p className="text-sm text-slate-700">{check.explanation}</p>
          {check.suggestedFix && (
            <p className="mt-2 text-sm text-slate-500">
              Förslag: {check.suggestedFix}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function HealthSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
          key={index}
        />
      ))}
    </div>
  )
}

function overallIconClassName(status: OverallHealthStatus) {
  if (status === "HEALTHY") {
    return "inline-flex rounded-full bg-emerald-50 p-2 text-emerald-700"
  }
  if (status === "NEEDS_ATTENTION") {
    return "inline-flex rounded-full bg-amber-50 p-2 text-amber-700"
  }
  return "inline-flex rounded-full bg-red-50 p-2 text-red-700"
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
