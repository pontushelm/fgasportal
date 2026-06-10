"use client"

import Link from "next/link"
import { buttonClassName, Card } from "@/components/ui"
import {
  buildImportCompletionRecommendations,
  buildImportCompletionWarnings,
  type ImportCompletionAction,
  type ImportCompletionContext,
  type ImportCompletionKind,
} from "@/lib/import-completion"

type ImportCompletionSummaryProps = {
  actions: ImportCompletionAction[]
  context?: ImportCompletionContext
  errors?: Array<{ row: number; message: string }>
  importedCount: number
  kind: ImportCompletionKind
  skippedCount?: number
  subtitle?: string
  title?: string
  unmappedColumnCount?: number
  updatedCount?: number
  validationIssueCount?: number
}

export function ImportCompletionSummary({
  actions,
  context,
  errors = [],
  importedCount,
  kind,
  skippedCount = 0,
  subtitle = "Importen är klar. Kontrollera resultatet och välj nästa steg.",
  title = "Importen är klar",
  unmappedColumnCount = 0,
  updatedCount,
  validationIssueCount = 0,
}: ImportCompletionSummaryProps) {
  const warnings = buildImportCompletionWarnings({
    skipped: skippedCount,
    unmappedColumnCount,
    validationIssueCount,
  })
  const recommendations = buildImportCompletionRecommendations(kind, context)

  return (
    <Card className="mt-6 border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Import slutförd
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) =>
            action.href ? (
              <Link
                className={buttonClassName({
                  variant: action.variant ?? "secondary",
                })}
                href={action.href}
                key={action.label}
              >
                {action.label}
              </Link>
            ) : (
              <button
                className={buttonClassName({
                  variant: action.variant ?? "secondary",
                })}
                key={action.label}
                type="button"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResultMetric label="Importerade" tone="success" value={importedCount} />
        {updatedCount != null && (
          <ResultMetric label="Uppdaterade" tone="success" value={updatedCount} />
        )}
        <ResultMetric label="Hoppade över" tone="warning" value={skippedCount} />
        <ResultMetric
          label="Att kontrollera"
          tone={warnings.length > 0 ? "warning" : "success"}
          value={warnings.reduce((sum, warning) => sum + warning.value, 0)}
        />
      </div>

      {warnings.length > 0 ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Varningar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {warnings.map((warning) => (
              <span
                className="rounded-full bg-white px-3 py-1 font-medium text-amber-900"
                key={warning.label}
              >
                {warning.value} {warning.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          Inga varningar rapporterades för den här importen.
        </p>
      )}

      {errors.length > 0 && (
        <div className="mt-4 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          <p className="font-semibold text-slate-950">Rader att kontrollera</p>
          <ul className="mt-2 grid gap-1">
            {errors.map((item) => (
              <li key={`${item.row}-${item.message}`}>
                Rad {item.row}: {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {recommendations.map((recommendation) => (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            key={recommendation.title}
          >
            <p className="font-semibold text-slate-950">
              {recommendation.title}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {recommendation.description}
            </p>
            <Link
              className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900"
              href={recommendation.href}
            >
              {recommendation.label}
            </Link>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ResultMetric({
  label,
  tone,
  value,
}: {
  label: string
  tone: "success" | "warning"
  value: number
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-900"
      : "border-amber-100 bg-amber-50 text-amber-900"

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
