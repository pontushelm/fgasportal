import type { ReactNode } from "react"
import { cn } from "./utils"

export function EmptyState({
  action,
  children,
  className,
  description,
  title,
}: {
  action?: ReactNode
  children?: ReactNode
  className?: string
  description?: string
  title?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
        className
      )}
    >
      {title && (
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      )}
      {description && <p className={title ? "mt-1" : ""}>{description}</p>}
      {children}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
