import Link from "next/link"
import type { ReactNode } from "react"
import { Card } from "./card"

export function PageHeader({
  actions,
  backHref,
  backLabel = "Tillbaka",
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  eyebrow?: string
  subtitle?: string
  title: string
}) {
  return (
    <Card className="px-5 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {backHref && (
            <Link
              className="mb-5 inline-flex text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
              href={backHref}
            >
              {backLabel}
            </Link>
          )}
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </Card>
  )
}
