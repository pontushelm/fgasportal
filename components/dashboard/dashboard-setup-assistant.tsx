"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Badge, Card } from "@/components/ui"
import type { ImportType } from "@/components/dashboard/import-data-workspace"
import {
  buildDashboardSetupProgress,
  type DashboardSetupStepId,
} from "@/lib/dashboard/setup-assistant"
import {
  getDemoIntroStorageKey,
  shouldShowDemoIntroduction,
} from "@/lib/dashboard/demo-introduction"
import {
  getFirstDashboardOnboardingOverlay,
  getPilotWelcomeStorageKey,
  type DashboardOnboardingOverlay,
} from "@/lib/dashboard/pilot-welcome"
import {
  addCompletedSetupStep,
  getSetupCompletedStepsStorageKey,
  parseCompletedSetupSteps,
  serializeCompletedSetupSteps,
} from "@/lib/dashboard/setup-progress-storage"

const STORAGE_KEYS = {
  collapsed: "fgasportal.dashboardSetup.collapsed",
}

export type DashboardSetupAssistantData = {
  actionItemCount: number
  annualReportReadinessSatisfied: boolean
  companyInfoCompleted: boolean
  companyId: string
  dataQualityIssueCount: number
  eventCount: number
  installationCount: number
  installationsMissingPropertyCount: number
  isDemoTenant: boolean
  propertyCount: number
  servicePartnerConnected: boolean
  userId: string
}

export function DashboardSetupAssistant({
  defaultCollapsed = true,
  onOpenImportData,
  setup,
}: {
  defaultCollapsed?: boolean
  onOpenImportData?: (importType?: ImportType) => void
  setup: DashboardSetupAssistantData
}) {
  const [collapsed, setCollapsed] = useLocalBoolean(
    STORAGE_KEYS.collapsed,
    defaultCollapsed
  )
  const [autoCollapsedCompletion, setAutoCollapsedCompletion] = useState(false)
  const [setupProgressState, setSetupProgressState] = useState<{
    companyId: string | null
    completedStepIds: DashboardSetupStepId[]
  }>({ companyId: null, completedStepIds: [] })
  const [onboardingOverlayState, setOnboardingOverlayState] = useState<
    "checking" | DashboardOnboardingOverlay
  >("checking")
  const onboardingOverlayButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const storageKey = getSetupCompletedStepsStorageKey(setup.companyId)
    const frameId = window.requestAnimationFrame(() => {
      setSetupProgressState({
        companyId: setup.companyId,
        completedStepIds: parseCompletedSetupSteps(
          window.localStorage.getItem(storageKey)
        ),
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [setup.companyId])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setOnboardingOverlayState(
        getFirstDashboardOnboardingOverlay({
          demoIntroStoredValue: window.localStorage.getItem(
            getDemoIntroStorageKey(setup.companyId)
          ),
          isDemoTenant: setup.isDemoTenant,
          pilotWelcomeStoredValue: window.localStorage.getItem(
            getPilotWelcomeStorageKey(setup.companyId, setup.userId)
          ),
        })
      )
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [setup.companyId, setup.isDemoTenant, setup.userId])

  useEffect(() => {
    if (
      onboardingOverlayState === "pilotWelcome" ||
      onboardingOverlayState === "demoIntroduction"
    ) {
      onboardingOverlayButtonRef.current?.focus()
    }
  }, [onboardingOverlayState])

  const progress = useMemo(
    () =>
      buildDashboardSetupProgress({
        ...setup,
        completedStepIds:
          setupProgressState.companyId === setup.companyId
            ? setupProgressState.completedStepIds
            : [],
      }),
    [setup, setupProgressState]
  )
  const isCollapsed = collapsed || autoCollapsedCompletion

  useEffect(() => {
    if (!progress.isComplete || collapsed || autoCollapsedCompletion) return

    const timeout = window.setTimeout(() => {
      setAutoCollapsedCompletion(true)
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [autoCollapsedCompletion, collapsed, progress.isComplete])

  function completeStep(stepId: DashboardSetupStepId) {
    const currentStepIds =
      setupProgressState.companyId === setup.companyId
        ? setupProgressState.completedStepIds
        : []
    const completedStepIds = addCompletedSetupStep(currentStepIds, stepId)

    window.localStorage.setItem(
      getSetupCompletedStepsStorageKey(setup.companyId),
      serializeCompletedSetupSteps(completedStepIds)
    )
    setSetupProgressState({
      companyId: setup.companyId,
      completedStepIds,
    })
  }

  function getStepImportType(stepId: DashboardSetupStepId): ImportType | null {
    if (stepId === "properties" && setup.propertyCount === 0) return "properties"
    if (stepId === "installations" && setup.installationCount === 0) {
      return "installations"
    }
    if (stepId === "events" && setup.eventCount === 0) return "events"
    return null
  }

  function dismissPilotWelcome() {
    window.localStorage.setItem(
      getPilotWelcomeStorageKey(setup.companyId, setup.userId),
      "1"
    )
    setOnboardingOverlayState(
      shouldShowDemoIntroduction({
        isDemoTenant: setup.isDemoTenant,
        storedValue: window.localStorage.getItem(
          getDemoIntroStorageKey(setup.companyId)
        ),
      })
        ? "demoIntroduction"
        : null
    )
  }

  function dismissDemoIntroduction() {
    window.localStorage.setItem(getDemoIntroStorageKey(setup.companyId), "1")
    setOnboardingOverlayState(null)
  }

  if (onboardingOverlayState === "checking") return null

  if (onboardingOverlayState === "pilotWelcome") {
    return (
      <div
        aria-labelledby="pilot-welcome-title"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
        role="dialog"
      >
        <Card className="w-full max-w-xl border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
          <Badge variant="info">Pilotversion</Badge>
          <h2
            className="mt-4 text-2xl font-semibold text-slate-950"
            id="pilot-welcome-title"
          >
            Välkommen till Polar
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
            <p>
              Polar är just nu i pilotfas. Det betyder att systemet är
              redo att testas i verkliga arbetsflöden, men att vissa delar
              fortfarande kan justeras baserat på feedback från de första
              användarna.
            </p>
            <p>
              Du kan använda systemet för att bygga upp eller granska ett
              F-gasregister, följa upp kontrollintervall, hantera servicepartner
              och förbereda årsrapportering.
            </p>
            <p>
              Om något känns otydligt eller om du saknar något är feedback
              extra värdefull i den här fasen.
            </p>
          </div>
          <button
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto"
            onClick={dismissPilotWelcome}
            ref={onboardingOverlayButtonRef}
            type="button"
          >
            Kom igång
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Guiden hjälper dig genom de viktigaste stegen.
          </p>
        </Card>
      </div>
    )
  }

  if (onboardingOverlayState === "demoIntroduction") {
    return (
      <div
        aria-labelledby="demo-introduction-title"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
        role="dialog"
      >
        <Card className="w-full max-w-xl border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
          <Badge variant="info">Förberedd demomiljö</Badge>
          <h2
            className="mt-4 text-2xl font-semibold text-slate-950"
            id="demo-introduction-title"
          >
            Välkommen till Polar
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
            <p>
              Det här är en demomiljö med exempeldata så att du snabbt kan se
              hur systemet fungerar i praktiken. Kom igång-guiden börjar ändå
              från noll så att du själv kan utforska och bekräfta varje steg.
            </p>
            <p>
              Guiden hjälper dig att utforska de viktigaste delarna:
              fastigheter, aggregat, servicepartner, åtgärder, rapporter och
              registerstatus.
            </p>
          </div>
          <button
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto"
            onClick={dismissDemoIntroduction}
            ref={onboardingOverlayButtonRef}
            type="button"
          >
            Starta genomgången
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Du kan när som helst minimera guiden och öppna den igen via Kom igång.
          </p>
        </Card>
      </div>
    )
  }

  if (setupProgressState.companyId !== setup.companyId) return null

  if (isCollapsed) {
    return (
      <aside className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-xs">
        <Card className="border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button
            className="flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => {
              setCollapsed(false)
              setAutoCollapsedCompletion(false)
            }}
            type="button"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                {progress.isComplete ? "Registret är redo" : "Kom igång"}
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                {progress.completedCount} av {progress.totalCount} steg klara
              </span>
            </span>
            <Badge variant={progress.isComplete ? "success" : "info"}>
              {progress.percent}%
            </Badge>
          </button>
        </Card>
      </aside>
    )
  }

  return (
    <aside className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-lg">
      <Card className="max-h-[calc(100vh-2rem)] overflow-y-auto border-blue-100 bg-white p-4 shadow-xl sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Kom igång med Polar
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
                : "Följ stegen från tomt konto till ett användbart F-gasregister."}
            </p>
          </div>

          <button
            className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setCollapsed(true)}
            type="button"
          >
            Minimera
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
              {onOpenImportData && getStepImportType(progress.nextStep.id) ? (
                <button
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  type="button"
                  onClick={() => {
                    const importType = getStepImportType(progress.nextStep!.id)
                    if (importType) {
                      completeStep(progress.nextStep!.id)
                      onOpenImportData(importType)
                    }
                  }}
                >
                  {progress.nextStep.ctaLabel}
                </button>
              ) : (
                <Link
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  href={progress.nextStep.route}
                  onClick={() => completeStep(progress.nextStep!.id)}
                >
                  {progress.nextStep.ctaLabel}
                </Link>
              )}
              {progress.nextStep.optional ? (
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => completeStep(progress.nextStep!.id)}
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

        <div className="mt-4 grid gap-2">
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
    </aside>
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
  if (optional) return <Badge variant="info">Rekommenderas</Badge>
  return <Badge variant="warning">Återstår</Badge>
}

function useLocalBoolean(key: string, defaultValue = false) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return defaultValue

    const storedValue = window.localStorage.getItem(key)
    if (storedValue === null) return defaultValue

    return storedValue === "1"
  })

  function updateValue(nextValue: boolean) {
    setValue(nextValue)
    window.localStorage.setItem(key, nextValue ? "1" : "0")
  }

  return [value, updateValue] as const
}
