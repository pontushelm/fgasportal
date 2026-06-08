"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, Toast, type ToastMessage } from "@/components/ui"
import type { CertificationStatusResult } from "@/lib/certification-status"
import type {
  DashboardActionSeverity,
  DashboardActionType,
} from "@/lib/actions/generate-actions"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import {
  getInstallationEventAmountLabel,
  hasInstallationEventAmount,
  type InstallationEventType,
} from "@/lib/installation-events"

type ServiceInstallation = {
  id: string
  name: string
  location: string
  refrigerantType: string
  refrigerantAmount: number
  nextInspection: string | null
  complianceStatus: ComplianceStatus
  daysUntilDue: number | null
  assignedContractorId: string | null
  assignedContractor: {
    id: string
    name: string | null
    email: string
  } | null
}

type ServiceAction = {
  id: string
  type: DashboardActionType
  severity: DashboardActionSeverity
  title: string
  description: string
  installationId: string
  installationName: string
  equipmentId: string | null
  propertyName: string | null
  assignedServiceContactName: string | null
  href: string
  dueDate?: string | null
  createdAt?: string | null
  sortPriority: number
}

type ActionsResponse = {
  actions: ServiceAction[]
}

type ServiceEventType = Exclude<InstallationEventType, "REFRIGERANT_CHANGE">

type EventFormData = {
  installationId: string
  type: ServiceEventType
  date: string
  refrigerantAddedKg: string
  notes: string
}

type CurrentUser = {
  userId: string
  role: string
  servicePartnerCompanyId: string | null
  isServicePartnerAdmin: boolean
}

type ServiceTechnician = {
  membershipId: string
  id: string
  name: string | null
  email: string
  isServicePartnerAdmin: boolean
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

const EVENT_LABELS: Record<ServiceEventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service",
  REPAIR: "Reparation",
  RECOVERY: "Tömning / Återvinning",
}

const SERVICE_QUEUE_ACTION_TYPES = new Set<DashboardActionType>([
  "OVERDUE_INSPECTION",
  "DUE_SOON_INSPECTION",
  "NOT_INSPECTED",
  "HIGH_RISK",
  "RECENT_LEAKAGE",
  "REFRIGERANT_REVIEW",
])

const ACTION_TYPE_LABELS: Record<DashboardActionType, string> = {
  OVERDUE_INSPECTION: "Försenad kontroll",
  DUE_SOON_INSPECTION: "Kommande kontroll",
  NOT_INSPECTED: "Saknar kontroll",
  HIGH_RISK: "Hög risk",
  NO_SERVICE_PARTNER: "Servicepartner saknas",
  RECENT_LEAKAGE: "Läckage att följa upp",
  REFRIGERANT_REVIEW: "Köldmedium bör granskas",
  SERVICEPARTNER_CERTIFICATE_MISSING: "Servicepartnercertifikat saknas",
  SERVICEPARTNER_CERTIFICATE_EXPIRING: "Servicepartnercertifikat går snart ut",
  SERVICEPARTNER_CERTIFICATE_EXPIRED: "Servicepartnercertifikat har gått ut",
}

const SEVERITY_LABELS: Record<DashboardActionSeverity, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const SEVERITY_BADGE_VARIANTS: Record<
  DashboardActionSeverity,
  "danger" | "neutral" | "warning"
> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
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
  const [actions, setActions] = useState<ServiceAction[]>([])
  const [technicians, setTechnicians] = useState<ServiceTechnician[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [certification, setCertification] = useState<CertificationData | null>(null)
  const [certificationForm, setCertificationForm] =
    useState<CertificationFormData>(initialCertificationForm)
  const [eventForm, setEventForm] = useState<EventFormData>(initialEventForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assigningInstallationId, setAssigningInstallationId] = useState("")
  const [isSavingCertification, setIsSavingCertification] = useState(false)
  const [assignmentFilter, setAssignmentFilter] =
    useState<"all" | "unassigned" | "assigned">("all")
  const [error, setError] = useState("")
  const [certificationError, setCertificationError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchInstallations() {
      setIsLoading(true)
      setError("")

      const [response, userResponse, actionsResponse] = await Promise.all([
        fetch("/api/dashboard/service", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        fetch("/api/dashboard/actions", {
          credentials: "include",
        }),
      ])

      if (
        response.status === 401 ||
        userResponse.status === 401 ||
        actionsResponse.status === 401
      ) {
        router.push("/login")
        return
      }

      if (response.status === 403) {
        if (!isMounted) return
        setError("Serviceuppdrag är endast tillgängligt för servicekontakter.")
        setIsLoading(false)
        return
      }

      if (!response.ok || !userResponse.ok || !actionsResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta serviceuppdrag.")
        setIsLoading(false)
        return
      }

      const data: ServiceInstallation[] = await response.json()
      const userData: CurrentUser = await userResponse.json()
      const actionsData: ActionsResponse = await actionsResponse.json()
      const techniciansResponse = userData.isServicePartnerAdmin
        ? await fetch("/api/dashboard/service/technicians", {
            credentials: "include",
          })
        : null
      const techniciansData: ServiceTechnician[] | null =
        techniciansResponse?.ok ? await techniciansResponse.json() : null
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
      setActions(actionsData.actions ?? [])
      setTechnicians(techniciansData ?? [])
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

  function startEvent(installationId: string, type: ServiceEventType) {
    setError("")
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
    if (event.target.name === "type") {
      const nextType = event.target.value as ServiceEventType
      setEventForm((current) => ({
        ...current,
        type: nextType,
        refrigerantAddedKg:
          nextType === current.type && hasInstallationEventAmount(nextType)
            ? current.refrigerantAddedKg
            : "",
      }))
      return
    }

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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte spara certifieringen.",
      })
      setIsSavingCertification(false)
      return
    }

    setCertification(result)
    setCertificationForm(toCertificationForm(result))
    setToast({
      type: "success",
      title: "Klart",
      message: "Certifieringen har sparats.",
    })
    setIsSavingCertification(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")

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
            hasInstallationEventAmount(eventForm.type) ? eventForm.refrigerantAddedKg : "",
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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte registrera händelsen.",
      })
      setIsSubmitting(false)
      return
    }

    setToast({
      type: "success",
      title: "Klart",
      message: "Händelsen har registrerats.",
    })
    setEventForm(initialEventForm)
    setIsSubmitting(false)
  }

  async function assignTechnician(installationId: string, technicianId: string) {
    setError("")
    setAssigningInstallationId(installationId)

    const response = await fetch("/api/dashboard/service/assign-technician", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationId,
        technicianId: technicianId || null,
      }),
    })
    const result: {
      error?: string
      installationId?: string
      assignedContractorId?: string | null
      assignedContractor?: ServiceInstallation["assignedContractor"]
    } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok || !result.installationId) {
      setError(result.error || "Kunde inte tilldela tekniker.")
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte tilldela tekniker.",
      })
      setAssigningInstallationId("")
      return
    }

    setInstallations((current) =>
      current.map((installation) =>
        installation.id === result.installationId
          ? {
              ...installation,
              assignedContractorId: result.assignedContractorId ?? null,
              assignedContractor: result.assignedContractor ?? null,
            }
          : installation
      )
    )
    setToast({
      type: "success",
      title: "Klart",
      message: result.assignedContractor
        ? "Teknikern har tilldelats aggregatet."
        : "Teknikertilldelningen har tagits bort.",
    })
    setAssigningInstallationId("")
  }

  const eventCertificationWarning = getCertificationWarning(null)
  const isServicePartnerAdmin = Boolean(currentUser?.isServicePartnerAdmin)
  const showCompanyCertificationPanel = false
  const queueActions = useMemo(
    () =>
      actions
        .filter((action) => SERVICE_QUEUE_ACTION_TYPES.has(action.type))
        .sort((first, second) => first.sortPriority - second.sortPriority),
    [actions]
  )
  const unassignedInstallations = useMemo(
    () =>
      installations.filter((installation) => !installation.assignedContractorId),
    [installations]
  )
  const summaryCards = useMemo(
    () =>
      getServiceSummaryCards({
        actions: queueActions,
        installations,
        isServicePartnerAdmin,
        unassignedInstallationsCount: unassignedInstallations.length,
      }),
    [
      installations,
      isServicePartnerAdmin,
      queueActions,
      unassignedInstallations.length,
    ]
  )
  const visibleInstallations = isServicePartnerAdmin
    ? installations.filter((installation) => {
        if (assignmentFilter === "assigned") {
          return Boolean(installation.assignedContractorId)
        }
        if (assignmentFilter === "unassigned") {
          return !installation.assignedContractorId
        }

        return true
      })
    : installations

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Serviceportal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Servicepartnerdashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Vad behöver göras idag?
        </p>
      </div>

      {isLoading && <ServiceDashboardLoadingSkeleton />}
      {error && <p className="mt-8 text-sm font-semibold text-red-700">{error}</p>}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}

      {!isLoading && !error && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} {...card} />
            ))}
          </section>

          <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">Att göra</h2>
              <p className="mt-1 text-sm text-slate-600">
                Prioriterade uppdrag baserat på kontrollstatus, risk och registrerade händelser.
              </p>
            </div>
            {queueActions.length === 0 ? (
              <div className="p-5 text-sm text-slate-700">
                Inga prioriterade uppdrag finns just nu.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {queueActions.slice(0, 10).map((action) => (
                  <WorkQueueRow action={action} key={action.id} />
                ))}
              </div>
            )}
          </section>

          {isServicePartnerAdmin && unassignedInstallations.length > 0 && (
            <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">
                    Ej tilldelade uppdrag
                  </h2>
                  <p className="mt-1 text-sm text-amber-900">
                    Aggregat som är kopplade till servicepartnern men saknar tekniker.
                  </p>
                </div>
                <Badge variant="warning">
                  {unassignedInstallations.length} aggregat
                </Badge>
              </div>
              <div className="mt-4 grid gap-2">
                {unassignedInstallations.slice(0, 5).map((installation) => (
                  <div
                    className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    key={installation.id}
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {installation.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {installation.location || "Ingen plats angiven"} · {formatOptionalDate(installation.nextInspection)}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                      href={`/dashboard/installations/${installation.id}`}
                    >
                      Öppna aggregat
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showCompanyCertificationPanel && !isLoading && !error && certification && !isServicePartnerAdmin && (
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
              <button type="submit" disabled={isSavingCertification}>
                {isSavingCertification ? "Sparar..." : "Spara certifiering"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!isLoading && !error && (
        <section className="mt-8">
          {isServicePartnerAdmin && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Teknikertilldelning
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Endast tekniker inom ert servicepartnerföretag kan väljas.
                  </p>
                </div>
                <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
                  <FilterButton active={assignmentFilter === "all"} onClick={() => setAssignmentFilter("all")}>
                    Alla
                  </FilterButton>
                  <FilterButton active={assignmentFilter === "unassigned"} onClick={() => setAssignmentFilter("unassigned")}>
                    Ej tilldelade
                  </FilterButton>
                  <FilterButton active={assignmentFilter === "assigned"} onClick={() => setAssignmentFilter("assigned")}>
                    Tilldelade
                  </FilterButton>
                </div>
              </div>
            </div>
          )}

          {visibleInstallations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
              {installations.length === 0
                ? "Du har inga tilldelade aggregat just nu."
                : "Inga aggregat matchar filtret."}
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
                    {isServicePartnerAdmin && <TableHeader>Tekniker</TableHeader>}
                    <TableHeader>Åtgärder</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleInstallations.map((installation) => (
                    <tr className="hover:bg-slate-50" key={installation.id}>
                      <TableCell>
                        <Link
                          className="font-semibold text-blue-700 hover:text-blue-900"
                          href={`/dashboard/installations/${installation.id}`}
                        >
                          {installation.name}
                        </Link>
                      </TableCell>
                      <TableCell>{installation.location}</TableCell>
                      <TableCell>{installation.refrigerantType}</TableCell>
                      <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                      <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                      <TableCell>
                        <StatusBadge status={installation.complianceStatus} />
                      </TableCell>
                      {isServicePartnerAdmin && (
                        <TableCell>
                          <label className="sr-only" htmlFor={`technician-${installation.id}`}>
                            Tilldela tekniker
                          </label>
                          <select
                            className="min-w-48 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
                            id={`technician-${installation.id}`}
                            value={installation.assignedContractorId ?? ""}
                            onChange={(event) =>
                              assignTechnician(installation.id, event.target.value)
                            }
                            disabled={assigningInstallationId === installation.id}
                          >
                            <option value="">Ingen tekniker tilldelad</option>
                            {technicians.map((technician) => (
                              <option key={technician.id} value={technician.id}>
                                {formatTechnicianName(technician)}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      )}
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
              </select>
            </label>
            <label className={fieldClassName}>
              Datum
              <input name="date" type="date" value={eventForm.date} onChange={handleChange} required />
            </label>
            {hasInstallationEventAmount(eventForm.type) && (
              <label className={fieldClassName}>
                {getInstallationEventAmountLabel(eventForm.type, { includeUnit: true })}
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

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string
  tone: "amber" | "red" | "slate"
  value: number
}) {
  const toneClassName = {
    amber: "border-l-amber-400",
    red: "border-l-red-400",
    slate: "border-l-slate-300",
  }[tone]

  return (
    <div className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 ${toneClassName}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  )
}

function WorkQueueRow({ action }: { action: ServiceAction }) {
  return (
    <article className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={SEVERITY_BADGE_VARIANTS[action.severity]}>
            {SEVERITY_LABELS[action.severity]}
          </Badge>
          <Badge variant="neutral">{ACTION_TYPE_LABELS[action.type]}</Badge>
          <h3 className="text-sm font-semibold text-slate-950">
            {action.title}
          </h3>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {action.installationName}
          {action.equipmentId ? (
            <span className="font-normal text-slate-600">
              {" "}
              · {action.equipmentId}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-slate-600">{action.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Fastighet: {action.propertyName || "-"}</span>
          <span>Tekniker: {action.assignedServiceContactName || "-"}</span>
          <span>Datum: {formatActionDate(action)}</span>
        </div>
      </div>
      <Link
        className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        href={action.href}
      >
        Öppna aggregat
      </Link>
    </article>
  )
}

function ServiceDashboardLoadingSkeleton() {
  return (
    <div className="mt-8 grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4"
            key={index}
          >
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="mt-4 h-8 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <div className="h-5 w-24 rounded bg-slate-100" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="px-5 py-4" key={index}>
              <div className="h-4 w-56 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-4/5 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={`rounded px-3 py-1.5 font-semibold transition ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
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
        servicekontakt.
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

function getServiceSummaryCards({
  actions,
  installations,
  isServicePartnerAdmin,
  unassignedInstallationsCount,
}: {
  actions: ServiceAction[]
  installations: ServiceInstallation[]
  isServicePartnerAdmin: boolean
  unassignedInstallationsCount: number
}) {
  const overdue = actions.filter(
    (action) =>
      action.type === "OVERDUE_INSPECTION" || action.type === "NOT_INSPECTED"
  ).length
  const dueSoon = actions.filter(
    (action) => action.type === "DUE_SOON_INSPECTION"
  ).length
  const leakage = actions.filter(
    (action) => action.type === "RECENT_LEAKAGE"
  ).length
  const highRisk = actions.filter((action) => action.type === "HIGH_RISK").length

  if (isServicePartnerAdmin) {
    return [
      { label: "Försenade kontroller", value: overdue, tone: "red" as const },
      { label: "Kontroller inom 30 dagar", value: dueSoon, tone: "amber" as const },
      { label: "Läckage att följa upp", value: leakage, tone: "amber" as const },
      {
        label: "Ej tilldelade uppdrag",
        value: unassignedInstallationsCount,
        tone: "amber" as const,
      },
      { label: "Högriskaggregat", value: highRisk, tone: "red" as const },
      { label: "Totala uppdrag", value: installations.length, tone: "slate" as const },
    ]
  }

  return [
    { label: "Mina försenade kontroller", value: overdue, tone: "red" as const },
    { label: "Mina kontroller inom 30 dagar", value: dueSoon, tone: "amber" as const },
    { label: "Mina läckage att följa upp", value: leakage, tone: "amber" as const },
    { label: "Mina högriskaggregat", value: highRisk, tone: "red" as const },
    { label: "Totala uppdrag", value: installations.length, tone: "slate" as const },
  ]
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatActionDate(action: ServiceAction) {
  return formatOptionalDate(action.dueDate ?? action.createdAt ?? null)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTechnicianName(technician: ServiceTechnician) {
  const label = technician.name || technician.email
  return technician.isServicePartnerAdmin ? `${label} (ansvarig)` : label
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
    return "Servicekontaktens certifiering har gått ut."
  }

  if (status.status === "EXPIRING_SOON") {
    return "Servicekontaktens certifiering löper snart ut."
  }

  return "Servicekontakten saknar registrerad certifiering."
}

const fieldClassName = "grid gap-1 text-sm font-medium text-slate-700"
