import type { HTMLAttributes } from "react"
import { cn } from "./utils"

type BadgeVariant =
  | "success"
  | "ok"
  | "warning"
  | "danger"
  | "overdue"
  | "info"
  | "neutral"

const variantClassName: Record<BadgeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        variantClassName[variant],
        className
      )}
      {...props}
    />
  )
}
