"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"

export type ToastTone = "success" | "error" | "warning" | "info"

export type ToastMessage = {
  type: ToastTone
  title?: string
  message: string
}

const toneClassNames: Record<ToastTone, { border: string; title: string }> = {
  success: {
    border: "border-emerald-200",
    title: "text-emerald-900",
  },
  error: {
    border: "border-red-200",
    title: "text-red-900",
  },
  warning: {
    border: "border-amber-200",
    title: "text-amber-900",
  },
  info: {
    border: "border-sky-200",
    title: "text-sky-900",
  },
}

const defaultTitles: Record<ToastTone, string> = {
  success: "Klart",
  error: "Fel",
  warning: "Varning",
  info: "Information",
}

export function Toast({
  autoDismissMs,
  children,
  onClose,
  toast,
}: {
  autoDismissMs?: number
  children?: ReactNode
  onClose: () => void
  toast: ToastMessage
}) {
  const [isExiting, setIsExiting] = useState(false)
  const shouldAutoDismiss =
    autoDismissMs ?? (toast.type === "success" || toast.type === "info" ? 5000 : 0)

  useEffect(() => {
    if (!shouldAutoDismiss) return

    const fadeTimeoutId = window.setTimeout(() => {
      setIsExiting(true)
    }, Math.max(0, shouldAutoDismiss - 250))

    return () => window.clearTimeout(fadeTimeoutId)
  }, [shouldAutoDismiss, toast])

  useEffect(() => {
    if (!isExiting) return

    const removeTimeoutId = window.setTimeout(onClose, 250)
    return () => window.clearTimeout(removeTimeoutId)
  }, [isExiting, onClose])

  const tone = toneClassNames[toast.type]

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border bg-white p-4 text-sm shadow-xl transition-all duration-200 ease-out sm:bottom-6 sm:right-6 ${tone.border} ${
        isExiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold ${tone.title}`}>
            {toast.title || defaultTitles[toast.type]}
          </p>
          <p className="mt-1 text-slate-700">{toast.message}</p>
          {children}
        </div>
        <button
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => setIsExiting(true)}
          type="button"
        >
          Stäng
        </button>
      </div>
    </div>
  )
}
