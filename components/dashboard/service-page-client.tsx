"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui"
import type { CertificationStatusResult } from "@/lib/certification-status"
import type { ComplianceStatus } from "@/lib/fgas-calculations"

type ServiceInstallation = {
  id: string
  name: string
  location: string
  refrigerantType: string
  refrigerantAmount: number
  nextInspection: string | null
  complianceStatus: ComplianceStatus
  daysUntilDue: number | null
}

type EventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"

type EventFormData = {
  installationId: string
  type: EventType
  date: string
  refrigerantAddedKg: string
  notes: string
}

type CurrentUser = {
  userId: string
}

type CertificationData = {
  isCertifiedCompany: boolean
  certificationNumber: string | null
  certificationOrganization: string | null
  certificationValidUntil: string | null
  certificationStatus: CertificationStatusResult
}

type CertificationFormData = {
  isCertifiedCompany: boolean
  certificationNumber: string
  certificationOrganization: string
  certificationValidUntil: string
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Kontroll inom 30 dagar",
  OVERDUE: "Försenad kontroll",
  NOT_REQUIRED: "Ej kontrollpliktig",
  NOT_INSPECTED: "Ej kontrollerad",
}

const STATUS_TONE: Record<ComplianceStatus, string> = {
  OK: "bg-green-100 text-green-700",
  DUE_SOON: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  NOT_REQUIRED: "bg-slate-100 text-slate-700",
  NOT_INSPECTED: "bg-blue-100 text-blue-700",
}

const EVENT_LABELS: Record<EventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service",
  REPAIR: "Reparation",
  RECOVERY: "Tömning / Återvinning",
  REFRIGERANT_CHANGE: "Byte av köldmedium",
}

const initialEventForm: EventFormData = {
  installationId: "",
  type: "INSPECTION",
  date: "",
  refrigerantAddedKg: "",
  notes: "",
}

const initialCertificationForm: CertificationFormData = {
  isCertifiedCompany: false,
  certificationNumber: "",
  certificationOrganization: "",
  certificationValidUntil: "",
}

export default function ServiceDashboardPage() {
  const router = useRouter()
  const [installations, setInstallations] = useState<ServiceInstallation[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [certification, setCertification] = useState<CertificationData | null>(null)
  const [certificationForm, setCertificationForm] =
    useState<CertificationFormData>(initialCertificationForm)
  const [eventForm, setEventForm] = useState<EventFormData>(initialEventForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingCertification, setIsSavingCertification] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [certificationError, setCertificationError] = useState("")
  const [certificationSuccess, setCertificationSuccess] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchInstallations() {
      setIsLoading(true)
      setError("")

      const [response, userResponse] = await Promise.all([
        fetch("/api/dashboard/service", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (response.status === 401 || userResponse.status === 401) {
        router.push("/login")
        return
      }

      if (response.status === 403) {
        if (!isMounted) return
        setError("Serviceuppdrag är endast tillgängligt för servicepartner.")
        setIsLoading(false)
        return
      }

      if (!response.ok || !userResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta serviceuppdrag.")
        setIsLoading(false)
        return
      }

      const data: ServiceInstallation[] = await response.json()
      const userData: CurrentUser = await userResponse.json()
      const certificationResponse = await fetch(
        `/api/company/contractors/${userData.userId}/certification`,
        {
          credentials: "include",
        }
      )
      const certificationData: CertificationData | null = certificationResponse.ok
        ? await certificationResponse.json()
        : null

      if (!isMounted) return
      setInstallations(data)
      setCurrentUser(userData)
      setCertification(certificationData)
      setCertificationForm(toCertificationForm(certificationData))
      setIsLoading(false)
    }

    void fetchInstallations()

    return () => {
      isMounted = false
    }
  }, [router])

  function startEvent(installationId: string, type: EventType) {
    setError("")
    setSuccess("")
    setEventForm({
      installationId,
      type,
      date: getTodayInputValue(),
      refrigerantAddedKg: "",
      notes: "",
    })
    window.setTimeout(() => {
      document.getElementById("service-event-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 0)
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setEventForm({
      ...eventForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleCertificationChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value

    setCertificationForm((current) => ({
      ...current,
      [event.target.name]: value,
    }))
  }

  async function handleCertificationSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!currentUser) return

    setCertificationError("")
    setCertificationSuccess("")
    setIsSavingCertification(true)

    const response = await fetch(
      `/api/company/contractors/${currentUser.userId}/certification`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(certificationForm),
      }
    )
    const result: CertificationData & { error?: string } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setCertificationError(result.error || "Kunde inte spara certifieringen.")
      setIsSavingCertification(false)
      return
    }

    setCertification(result)
    setCertificationForm(toCertificationForm(result))
    setCertificationSuccess("Certifieringen har sparats.")
    setIsSavingCertification(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (!eventForm.installationId) {
      setError("Välj ett aggregat först.")
      return
    }

    setIsSubmitting(true)

    const response = await fetch(
      `/api/installations/${eventForm.installationId}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          date: eventForm.date,
          type: eventForm.type,
          refrigerantAddedKg:
            eventForm.type === "REFILL" ? eventForm.refrigerantAddedKg : "",
          notes: eventForm.notes,
        }),
      }
    )

    const result: { error?: string } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setError(result.error || "Kunde inte registrera händelsen.")
      setIsSubmitting(false)
      return
    }

    setSuccess("Händelsen har registrerats.")
    setEventForm(initialEventForm)
    setIsSubmitting(false)
  }

  const eventCertificationWarning = getCertificationWarning(
    certification?.certificationStatus ?? null
  )

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Serviceportal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Serviceuppdrag</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Registrera kontroller, läckage, påfyllningar och service för tilldelade
          aggregat.
        </p>
      </div>

      {isLoading && <p className="mt-8 text-slate-700">Laddar serviceuppdrag...</p>}
      {error && <p className="mt-8 text-sm font-semibold text-red-700">{error}</p>}
      {success && <p className="mt-8 text-sm font-semibold text-green-700">{success}</p>}

      {!isLoading && !error && certification && (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Företagscertifiering</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-700">
                Företag som utför ingrepp i köldmediekretsen behöver giltig certifiering.
              </p>
            </div>
            <CertificationBadge status={certification.certificationStatus} />
          </div>

          <form className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={handleCertificationSubmit}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
              <input
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                name="isCertifiedCompany"
                type="checkbox"
                checked={certificationForm.isCertifiedCompany}
                onChange={handleCertificationChange}
              />
              Certifierat företag
            </label>

            <label className={fieldClassName}>
              Certifieringsnummer
              <input
                name="certificationNumber"
                value={certificationForm.certificationNumber}
                onChange={handleCertificationChange}
              />
            </label>

            <label className={fieldClassName}>
              Certifieringsorgan
              <select
                name="certificationOrganization"
                value={certificationForm.certificationOrganization}
                onChange={handleCertificationChange}
              >
                <option value="">Välj certifieringsorgan</option>
                <option value="INCERT">INCERT</option>
                <option value="DNV">DNV</option>
                <option value="Kiwa">Kiwa</option>
                <option value="Other">Annat</option>
              </select>
            </label>

            <label className={fieldClassName}>
              Giltigt till
              <input
                name="certificationValidUntil"
                type="date"
                value={certificationForm.certificationValidUntil}
                onChange={handleCertificationChange}
              />
            </label>

            <div className="flex flex-col gap-2 sm:justify-end">
              {certificationError && (
                <p className="text-sm font-semibold text-red-700">{certificationError}</p>
              )}
              {certificationSuccess && (
                <p className="text-sm font-semibold text-green-700">{certificationSuccess}</p>
              )}
              <button type="submit" disabled={isSavingCertification}>
                {isSavingCertification ? "Sparar..." : "Spara certifiering"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!isLoading && !error && (
        <section className="mt-8">
          {installations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
              Du har inga tilldelade aggregat just nu.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Aggregat</TableHeader>
                    <TableHeader>Plats</TableHeader>
                    <TableHeader>Köldmedium</TableHeader>
                    <TableHeader>Fyllnadsmängd</TableHeader>
                    <TableHeader>Nästa kontroll</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Åtgärder</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {installations.map((installation) => (
                    <tr className="hover:bg-slate-50" key={installation.id}>
                      <TableCell>{installation.name}</TableCell>
                      <TableCell>{installation.location}</TableCell>
                      <TableCell>{installation.refrigerantType}</TableCell>
                      <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                      <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                      <TableCell>
                        <StatusBadge status={installation.complianceStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton label="Registrera kontroll" onClick={() => startEvent(installation.id, "INSPECTION")} />
                          <ActionButton label="Registrera läckage" onClick={() => startEvent(installation.id, "LEAK")} />
                          <ActionButton label="Registrera påfyllning" onClick={() => startEvent(installation.id, "REFILL")} />
                          <ActionButton label="Registrera service" onClick={() => startEvent(installation.id, "SERVICE")} />
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {eventForm.installationId && (
        <section
          className="installation-form-surface mt-8 rounded-lg border border-slate-200 bg-white p-5"
          id="service-event-form"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            Registrera {EVENT_LABELS[eventForm.type].toLowerCase()}
          </h2>
          <form className="mt-4 grid max-w-xl gap-3" onSubmit={handleSubmit}>
            <label className={fieldClassName}>
              Aggregat
              <select name="installationId" value={eventForm.installationId} onChange={handleChange} required>
                {installations.map((installation) => (
                  <option key={installation.id} value={installation.id}>
                    {installation.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldClassName}>
              Typ
              <select name="type" value={eventForm.type} onChange={handleChange} required>
                <option value="INSPECTION">Kontroll</option>
                <option value="LEAK">Läckage</option>
                <option value="REFILL">Påfyllning</option>
                <option value="SERVICE">Service</option>
                <option value="REPAIR">Reparation</option>
                <option value="RECOVERY">Tömning / Återvinning</option>
                <option value="REFRIGERANT_CHANGE">Byte av köldmedium</option>
              </select>
            </label>
            <label className={fieldClassName}>
              Datum
              <input name="date" type="date" value={eventForm.date} onChange={handleChange} required />
            </label>
            {eventForm.type === "REFILL" && (
              <label className={fieldClassName}>
                Påfylld mängd kg
                <input
                  name="refrigerantAddedKg"
                  value={eventForm.refrigerantAddedKg}
                  onChange={handleChange}
                  inputMode="decimal"
                />
              </label>
            )}
            <label className={fieldClassName}>
              Anteckningar
              <textarea
                name="notes"
                value={eventForm.notes}
                onChange={handleChange}
                required={eventForm.type === "LEAK"}
              />
            </label>
            {eventCertificationWarning && (
              <CertificationWarningBox message={eventCertificationWarning} />
            )}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sparar..." : "Spara händelse"}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}

function ActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function CertificationBadge({ status }: { status: CertificationStatusResult }) {
  return <Badge variant={status.variant}>{status.label}</Badge>
}

function CertificationWarningBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">{message}</p>
      <p className="mt-1 text-amber-800">
        Kontrollera att arbete på köldmediekrets utförs av giltigt certifierad
        servicepartner.
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-slate-800">{children}</td>
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toCertificationForm(
  certification: CertificationData | null
): CertificationFormData {
  return {
    isCertifiedCompany: certification?.isCertifiedCompany ?? false,
    certificationNumber: certification?.certificationNumber || "",
    certificationOrganization: certification?.certificationOrganization || "",
    certificationValidUntil: toDateInputValue(
      certification?.certificationValidUntil ?? null
    ),
  }
}

function toDateInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : ""
}

function getCertificationWarning(status: CertificationStatusResult | null) {
  if (!status || status.status === "VALID") return null

  if (status.status === "EXPIRED") {
    return "Servicepartnerns certifiering har gått ut."
  }

  if (status.status === "EXPIRING_SOON") {
    return "Servicepartnerns certifiering löper snart ut."
  }

  return "Servicepartnern saknar registrerad certifiering."
}

const fieldClassName = "grid gap-1 text-sm font-medium text-slate-700"
