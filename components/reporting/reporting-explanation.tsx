import type { ReportingPresentation } from "@/lib/reporting/reportingPresentation"

export function ReportingExplanationDetails({
  explanation,
}: {
  explanation: ReportingPresentation
}) {
  return (
    <details className="group relative mt-2 w-fit max-w-xs text-xs">
      <summary className="inline-flex min-h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100">
        <span aria-hidden="true">i</span>
        Varför?
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-left font-normal text-slate-700 shadow-lg sm:left-auto sm:right-0">
        <p className="font-semibold text-slate-950">{explanation.title}</p>
        <p className="mt-1 leading-5">{explanation.reason}</p>
        <dl className="mt-3 grid gap-2">
          <div>
            <dt className="font-semibold text-slate-600">Omfattning</dt>
            <dd>{explanation.scopeLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Mottagare</dt>
            <dd>{explanation.recipientLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Gräns</dt>
            <dd>{explanation.thresholdLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Utvärderat värde</dt>
            <dd>{explanation.evaluatedValueLabel}</dd>
          </div>
        </dl>
        {explanation.details.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-4">
            {explanation.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  )
}
