"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge, Button, Card, PageHeader, Toast, type ToastMessage } from "@/components/ui"
import type {
  NotificationDigest,
  NotificationDigestGroup,
} from "@/lib/notifications/build-notification-digest"
import type { DashboardActionSeverity } from "@/lib/actions/generate-actions"

type NotificationSettings = {
  canManageCompanySettings: boolean
  company: {
    annualReportReminders: boolean
    certificateReminders: boolean
    inspectionReminders: boolean
  }
  user: {
    receiveNotifications: boolean
  }
}

type NotificationCenterData = {
  digest: NotificationDigest
  latestDigest: {
    digestType: "DAILY" | "WEEKLY"
    sentAt: string
    totalItems: number
  } | null
  settings: NotificationSettings
}

type DigestDryRunResult = {
  companiesChecked: number
  digestDate: string
  digestType: "DAILY" | "WEEKLY"
  eligibleRecipients: number
  recipientsChecked: number
  results: Array<{
    companyId: string
    decision:
      | "WOULD_SEND"
      | "SKIP_NO_ITEMS"
      | "SKIP_ALREADY_SENT"
      | "SKIP_DISABLED"
    email: string
    totalItems: number
    userId: string
  }>
  skippedAlreadySent: number
  skippedDisabled: number
  skippedNoItems: number
}

const SEVERITY_LABELS: Record<DashboardActionSeverity, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const SEVERITY_VARIANTS: Record<
  DashboardActionSeverity,
  "danger" | "warning" | "neutral"
> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
}

export default function NotificationsPageClient() {
  const router = useRouter()
  const [data, setData] = useState<NotificationCenterData | null>(null)
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingDigest, setIsTestingDigest] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<DigestDryRunResult | null>(null)
  const [error, setError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchNotifications() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/dashboard/notifications", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta notifieringar.")
        setIsLoading(false)
        return
      }

      const nextData: NotificationCenterData = await response.json()
      if (!isMounted) return

      setData(nextData)
      setSettings(nextData.settings)
      setIsLoading(false)
    }

    void fetchNotifications()

    return () => {
      isMounted = false
    }
  }, [router])

  async function saveSettings() {
    if (!settings) return

    setIsSaving(true)
    const response = await fetch("/api/dashboard/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        company: settings.canManageCompanySettings ? settings.company : undefined,
        user: settings.user,
      }),
    })
    const result: { settings?: NotificationSettings; error?: string } =
      await response.json()

    if (!response.ok || !result.settings) {
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte spara notifieringsinställningar.",
      })
      setIsSaving(false)
      return
    }

    setSettings(result.settings)
    setData((current) => current ? { ...current, settings: result.settings! } : current)
    setToast({
      type: "success",
      title: "Klart",
      message: "Notifieringsinställningar har sparats.",
    })
    setIsSaving(false)
  }

  async function runDigestDryRun() {
    setIsTestingDigest(true)
    const response = await fetch("/api/dashboard/notifications/digest/dry-run", {
      credentials: "include",
      method: "POST",
    })
    const result: DigestDryRunResult & { error?: string } = await response.json()

    if (!response.ok) {
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte testa notifieringsdigest.",
      })
      setIsTestingDigest(false)
      return
    }

    setDryRunResult(result)
    setToast({
      type: "success",
      title: "Klart",
      message: "Digest-testet är klart. Inga e-postmeddelanden skickades.",
    })
    setIsTestingDigest(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <PageHeader
          title="Notifieringar"
          subtitle="Samlad översikt över påminnelser som kan skickas som daglig digest."
        />

        {isLoading && <NotificationsSkeleton />}
        {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

        {data && settings && (
          <div className="mt-6 grid gap-6">
            <Card className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Samlade påminnelser
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold text-slate-950">
                    {data.digest.totalItems}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.digest.totalItems === 0
                      ? "Inga aktuella påminnelser just nu."
                      : "Poster som kan ingå i kommande notifieringsdigest."}
                  </p>
                </div>
                <Link
                  className="inline-flex justify-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                  href="/dashboard/actions"
                >
                  Öppna åtgärder
                </Link>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <DigestGroupCard group={data.digest.inspections} />
              <DigestGroupCard group={data.digest.certificates} />
              <DigestGroupCard group={data.digest.reports} />
            </div>

            <Card className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    Inställningar
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Välj vilka notifieringar som ska vara aktiva. Utskick är inte
                    aktiverat i den här versionen.
                  </p>
                </div>
                <Button disabled={isSaving} type="button" onClick={saveSettings}>
                  {isSaving ? "Sparar..." : "Spara inställningar"}
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Senaste digestaktivitet
                </p>
                {data.latestDigest ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDigestType(data.latestDigest.digestType)} digest skickades{" "}
                    {formatDateTime(data.latestDigest.sentAt)} med{" "}
                    {data.latestDigest.totalItems} poster.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">
                    Ingen digest har skickats ännu.
                  </p>
                )}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-950">
                    Företagets påminnelser
                  </h3>
                  <div className="mt-4 grid gap-3">
                    <NotificationToggle
                      checked={settings.company.inspectionReminders}
                      disabled={!settings.canManageCompanySettings}
                      label="Kontrollpåminnelser"
                      onChange={(value) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                company: {
                                  ...current.company,
                                  inspectionReminders: value,
                                },
                              }
                            : current
                        )
                      }
                    />
                    <NotificationToggle
                      checked={settings.company.certificateReminders}
                      disabled={!settings.canManageCompanySettings}
                      label="Certifikatpåminnelser"
                      onChange={(value) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                company: {
                                  ...current.company,
                                  certificateReminders: value,
                                },
                              }
                            : current
                        )
                      }
                    />
                    <NotificationToggle
                      checked={settings.company.annualReportReminders}
                      disabled={!settings.canManageCompanySettings}
                      label="Årsrapportpåminnelser"
                      onChange={(value) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                company: {
                                  ...current.company,
                                  annualReportReminders: value,
                                },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  {!settings.canManageCompanySettings && (
                    <p className="mt-3 text-sm text-slate-500">
                      Endast ägare kan ändra företagets notifieringar.
                    </p>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-950">
                    Mina notifieringar
                  </h3>
                  <div className="mt-4">
                    <NotificationToggle
                      checked={settings.user.receiveNotifications}
                      label="Ta emot notifieringar"
                      onChange={(value) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                user: {
                                  receiveNotifications: value,
                                },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                </section>
              </div>
            </Card>

            {settings?.canManageCompanySettings && (
              <Card className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      Testa digest
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Kör en torrkörning av leveransbeslut. Inga
                      e-postmeddelanden skickas och inga leveransloggar skrivs.
                    </p>
                  </div>
                  <Button
                    disabled={isTestingDigest}
                    type="button"
                    onClick={runDigestDryRun}
                  >
                    {isTestingDigest ? "Testar..." : "Testa digest"}
                  </Button>
                </div>

                {dryRunResult && (
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-5">
                      <DryRunMetric
                        label="Bolag"
                        value={dryRunResult.companiesChecked}
                      />
                      <DryRunMetric
                        label="Mottagare"
                        value={dryRunResult.recipientsChecked}
                      />
                      <DryRunMetric
                        label="Skulle skickas"
                        value={dryRunResult.eligibleRecipients}
                      />
                      <DryRunMetric
                        label="Inga poster"
                        value={dryRunResult.skippedNoItems}
                      />
                      <DryRunMetric
                        label="Redan skickad"
                        value={dryRunResult.skippedAlreadySent}
                      />
                    </div>
                    {dryRunResult.results.length === 0 ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Inga mottagare hittades för digest-testet.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Mottagare</th>
                              <th className="px-3 py-2">Beslut</th>
                              <th className="px-3 py-2">Poster</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {dryRunResult.results.slice(0, 8).map((result) => (
                              <tr key={`${result.companyId}-${result.userId}`}>
                                <td className="px-3 py-2 text-slate-700">
                                  {result.email}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-900">
                                  {formatDryRunDecision(result.decision)}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {result.totalItems}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </section>
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
    </main>
  )
}

function DigestGroupCard({ group }: { group: NotificationDigestGroup }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{group.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
        </div>
        <Badge variant={group.severity ? SEVERITY_VARIANTS[group.severity] : "success"}>
          {group.count}
        </Badge>
      </div>

      {group.items.length === 0 ? (
        <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Inga aktuella påminnelser.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {group.items.map((item) => (
            <Link
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-blue-200 hover:bg-blue-50"
              href={item.href}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-slate-600">{item.count} poster</p>
                </div>
                <Badge variant={SEVERITY_VARIANTS[item.severity]}>
                  {SEVERITY_LABELS[item.severity]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

function NotificationToggle({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="font-semibold text-slate-900">{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-slate-300"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function DryRunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function formatDryRunDecision(decision: DigestDryRunResult["results"][number]["decision"]) {
  if (decision === "WOULD_SEND") return "Skulle skickas"
  if (decision === "SKIP_ALREADY_SENT") return "Redan skickad"
  if (decision === "SKIP_DISABLED") return "Avstängd"
  return "Inga poster"
}

function NotificationsSkeleton() {
  return (
    <div className="mt-6 grid gap-4">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white"
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

function formatDigestType(type: "DAILY" | "WEEKLY") {
  return type === "DAILY" ? "Daglig" : "Veckovis"
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
