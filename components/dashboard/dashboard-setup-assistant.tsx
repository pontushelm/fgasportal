"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Badge, Card } from "@/components/ui"
import {
  buildDashboardSetupProgress,
  type DashboardSetupStepId,
} from "@/lib/dashboard/setup-assistant"

const STORAGE_KEYS = {
  actionsReviewed: "fgasportal.dashboardSetup.actionsReviewed",
  annualReportPageVisited: "fgasportal.dashboardSetup.annualReportPageVisited",
  annualReportPreviewReviewed: "fgasportal.dashboardSetup.annualReportPreviewReviewed",
  collapsed: "fgasportal.dashboardSetup.collapsed",
  servicePartnerSkipped: "fgasportal.dashboardSetup.servicePartnerSkipped",
}

export type DashboardSetupAssistantData = {
  actionItemCount: number
  annualReportReadinessSatisfied: boolean
  companyInfoCompleted: boolean
  dataQualityIssueCount: number
  eventCount: number
  installationCount: number
  installationsMissingPropertyCount: number
  propertyCount: number
  servicePartnerConnected: boolean
}

export function DashboardSetupAssistant({
  setup,
}: {
  setup: DashboardSetupAssistantData
}) {
  const [actionsReviewed, setActionsReviewed] = useLocalBoolean(
    STORAGE_KEYS.actionsReviewed
  )
  const [annualReportPageVisited, setAnnualReportPageVisited] = useLocalBoolean(
    STORAGE_KEYS.annualReportPageVisited
  )
  const [annualReportPreviewReviewed] = useLocalBoolean(
    STORAGE_KEYS.annualReportPreviewReviewed
  )
  const [collapsed, setCollapsed] = useLocalBoolean(STORAGE_KEYS.collapsed)
  const [servicePartnerSkipped, setServicePartnerSkipped] = useLocalBoolean(
    STORAGE_KEYS.servicePartnerSkipped
  )
  const [autoCollapsedCompletion, setAutoCollapsedCompletion] = useState(false)

  const progress = useMemo(
    () =>
      buildDashboardSetupProgress({
        ...setup,
        actionsReviewed,
        annualReportPageVisited,
        annualReportPreviewReviewed,
        servicePartnerSkipped,
      }),
    [
      actionsReviewed,
      annualReportPageVisited,
      annualReportPreviewReviewed,
      servicePartnerSkipped,
      setup,
    ]
  )
  const isCollapsed = collapsed || autoCollapsedCompletion

  useEffect(() => {
    if (!progress.isComplete || collapsed || autoCollapsedCompletion) return

    const timeout = window.setTimeout(() => {
      setAutoCollapsedCompletion(true)
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [autoCollapsedCompletion, collapsed, progress.isComplete])

  function markStepOpened(stepId: DashboardSetupStepId) {
    if (stepId === "actions" && setup.actionItemCount > 0) {
      setActionsReviewed(true)
    }
    if (stepId === "reports") {
      setAnnualReportPageVisited(true)
    }
  }

  if (isCollapsed) {
    return (
      <Card className="mt-6 border-slate-200 bg-white/85 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {progress.isComplete
                ? "Registret är redo för löpande uppföljning"
                : "Setupguide"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {progress.completedCount} av {progress.totalCount} steg klara.
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => {
              setCollapsed(false)
              setAutoCollapsedCompletion(false)
            }}
            type="button"
          >
            Visa setupguide
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-6 border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              Kom igång med FgasPortal
            </h2>
            {progress.isComplete ? (
              <Badge variant="success">Klart</Badge>
            ) : (
              <Badge variant="info">Setup</Badge>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {progress.isComplete
              ? "Registret är redo för löpande uppföljning."
              : "Följ stegen för att komma från tomt konto till ett användbart F-gasregister."}
          </p>
        </div>

        <button
          className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => setCollapsed(true)}
          type="button"
        >
          Dölj
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-800">
            {progress.completedCount} av {progress.totalCount} steg klara
          </span>
          <span className="text-slate-500">{progress.percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {progress.nextStep ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Nästa rekommenderade steg
          </p>
          <h3 className="mt-1 font-semibold text-slate-950">
            {progress.nextStep.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {progress.nextStep.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              href={progress.nextStep.route}
              onClick={() => markStepOpened(progress.nextStep!.id)}
            >
              {progress.nextStep.ctaLabel}
            </Link>
            {progress.nextStep.id === "servicePartner" ? (
              <button
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setServicePartnerSkipped(true)}
                type="button"
              >
                Hoppa över för nu
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          Registret är redo för löpande uppföljning.
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {progress.steps.map((step) => (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
            key={step.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  {step.description}
                </p>
              </div>
              <StatusPill completed={step.completed} optional={step.optional} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function StatusPill({
  completed,
  optional,
}: {
  completed: boolean
  optional?: boolean
}) {
  if (completed) return <Badge variant="success">Klart</Badge>
  if (optional) return <Badge variant="neutral">Valfritt</Badge>
  return <Badge variant="warning">Återstår</Badge>
}

function useLocalBoolean(key: string) {
  const [value, setValue] = useState(() =>
    typeof window === "undefined" ? false : window.localStorage.getItem(key) === "1"
  )

  function updateValue(nextValue: boolean) {
    setValue(nextValue)
    window.localStorage.setItem(key, nextValue ? "1" : "0")
  }

  return [value, updateValue] as const
}
