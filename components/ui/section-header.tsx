import type { ReactNode } from "react"

export function SectionHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode
  eyebrow?: string
  subtitle?: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
