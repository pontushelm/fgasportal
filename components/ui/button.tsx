import type { ButtonHTMLAttributes } from "react"
import { cn } from "./utils"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
type ButtonSize = "sm" | "md"

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700",
  secondary:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600",
  danger:
    "border border-red-300 bg-white text-red-700 shadow-sm hover:bg-red-50 disabled:text-slate-400 dark:border-red-900/70 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40 dark:disabled:text-slate-600",
  ghost:
    "text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600",
}

const sizeClassName: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2 text-sm",
}

export function buttonClassName({
  className,
  size = "sm",
  variant = "secondary",
}: {
  className?: string
  size?: ButtonSize
  variant?: ButtonVariant
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
    sizeClassName[size],
    variantClassName[variant],
    className
  )
}

export function Button({
  className,
  size = "sm",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize
  variant?: ButtonVariant
}) {
  return (
    <button
      className={buttonClassName({ className, size, variant })}
      {...props}
    />
  )
}
