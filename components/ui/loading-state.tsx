export function getLoadingSpinnerClass(className = "") {
  return [
    "inline-block rounded-full border-2 border-slate-300 border-t-blue-600 motion-safe:animate-spin motion-reduce:animate-none",
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

export function LoadingSpinner({ className = "h-5 w-5" }: { className?: string }) {
  return <span aria-hidden="true" className={getLoadingSpinnerClass(className)} />
}

export function LoadingStatus({
  className = "",
  text = "Laddar...",
}: {
  className?: string
  text?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-sm font-medium text-slate-700 ${className}`}
      role="status"
    >
      <LoadingSpinner />
      <span>{text}</span>
    </div>
  )
}

export function CenteredLoadingState({
  className = "",
  text = "Laddar sidan...",
}: {
  className?: string
  text?: string
}) {
  return (
    <div
      className={`flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white p-8 ${className}`}
    >
      <LoadingStatus text={text} />
    </div>
  )
}
