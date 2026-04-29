"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import type { UserRole } from "@/lib/auth"
import {
  calculateInstallationRisk,
  type InstallationRiskLevel,
} from "@/lib/risk-classification"

type Inspection = {
  id: string
  inspectionDate: string
  inspectorName: string
  status?: string | null
  notes?: string | null
  findings?: string | null
  nextDueDate?: string | null
}

type InstallationEventType = "INSPECTION" | "LEAK" | "REFILL" | "SERVICE"

type InstallationEvent = {
  id: string
  date: string
  type: InstallationEventType
  refrigerantAddedKg?: number | null
  notes?: string | null
  createdBy?: {
    name: string
    email: string
  } | null
}

type CreateEventResponse = {
  event?: InstallationEvent
  inspectionSchedule?: {
    lastInspection: string | null
    nextInspection: string | null
  } | null
  error?: string
}

type InstallationDetail = {
  id: string
  name: string
  location: string
  equipmentId?: string | null
  serialNumber?: string | null
  propertyName?: string | null
  equipmentType?: string | null
  operatorName?: string | null
  refrigerantType: string
  refrigerantAmount: number
  hasLeakDetectionSystem: boolean
  installationDate: string
  lastInspection?: string | null
  nextInspection?: string | null
  assignedContractorId?: string | null
  notes?: string | null
  inspections: Inspection[]
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type InspectionFormData = {
  inspectionDate: string
  inspectorName: string
  status: string
  notes: string
}

type EventFormData = {
  date: string
  type: InstallationEventType
  refrigerantAddedKg: string
  notes: string
}

type InstallationEditFormData = {
  name: string
  location: string
  equipmentId: string
  serialNumber: string
  propertyName: string
  equipmentType: string
  operatorName: string
  refrigerantType: string
  refrigerantAmount: string
  hasLeakDetectionSystem: boolean
  assignedContractorId: string
  notes: string
}

type Contractor = {
  id: string
  name: string
  email: string
}

const initialInspectionFormData: InspectionFormData = {
  inspectionDate: "",
  inspectorName: "",
  status: "",
  notes: "",
}

const initialEventFormData: EventFormData = {
  date: "",
  type: "SERVICE",
  refrigerantAddedKg: "",
  notes: "",
}

const initialEditFormData: InstallationEditFormData = {
  name: "",
  location: "",
  equipmentId: "",
  serialNumber: "",
  propertyName: "",
  equipmentType: "",
  operatorName: "",
  refrigerantType: "",
  refrigerantAmount: "",
  hasLeakDetectionSystem: false,
  assignedContractorId: "",
  notes: "",
}

const EVENT_LABELS: Record<InstallationEventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service",
}

const EVENT_TONE: Record<InstallationEventType, string> = {
  INSPECTION: "border-blue-200 bg-blue-50 text-blue-800",
  LEAK: "border-red-200 bg-red-50 text-red-800",
  REFILL: "border-amber-200 bg-amber-50 text-amber-800",
  SERVICE: "border-slate-200 bg-slate-50 text-slate-700",
}

const RISK_TONE: Record<InstallationRiskLevel, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
}

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Kontroll inom 30 dagar",
  OVERDUE: "Försenad kontroll",
  NOT_REQUIRED: "Ej kontrollpliktig",
  NOT_INSPECTED: "Ej kontrollerad",
}

const COMPLIANCE_TONE: Record<ComplianceStatus, string> = {
  OK: "bg-green-100 text-green-700",
  DUE_SOON: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  NOT_REQUIRED: "bg-slate-100 text-slate-700",
  NOT_INSPECTED: "bg-blue-100 text-blue-700",
}

const fieldClassName = "grid gap-1 text-sm font-medium text-slate-700"

export default function InstallationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [installation, setInstallation] = useState<InstallationDetail | null>(null)
  const [events, setEvents] = useState<InstallationEvent[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [inspectionForm, setInspectionForm] = useState<InspectionFormData>(
    initialInspectionFormData
  )
  const [eventForm, setEventForm] = useState<EventFormData>(initialEventFormData)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [eventError, setEventError] = useState("")
  const [eventSuccess, setEventSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  const [editForm, setEditForm] = useState<InstallationEditFormData>(
    initialEditFormData
  )
  const [editError, setEditError] = useState("")
  const [editSuccess, setEditSuccess] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [archiveError, setArchiveError] = useState("")
  const [isArchiving, setIsArchiving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchInstallation() {
      const [installationRes, userRes, eventsRes] = await Promise.all([
        fetch(`/api/installations/${params.id}`, {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        fetch(`/api/installations/${params.id}/events`, {
          credentials: "include",
        }),
      ])

      if (
        installationRes.status === 401 ||
        userRes.status === 401 ||
        eventsRes.status === 401
      ) {
        router.push("/login")
        return
      }

      if (installationRes.status === 404) {
        if (!isMounted) return
        setError("Installationen hittades inte")
        setIsLoading(false)
        return
      }

      if (!installationRes.ok || !userRes.ok || !eventsRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta installationen")
        setIsLoading(false)
        return
      }

      const data: InstallationDetail = await installationRes.json()
      const userData: CurrentUser = await userRes.json()
      const eventsData: InstallationEvent[] = await eventsRes.json()
      const contractorsData: Contractor[] =
        userData.role === "ADMIN"
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : []

      if (!isMounted) return

      setInstallation(data)
      setEvents(eventsData)
      setContractors(contractorsData)
      setCurrentUser(userData)
      setEditForm({
        name: data.name,
        location: data.location,
        equipmentId: data.equipmentId || "",
        serialNumber: data.serialNumber || "",
        propertyName: data.propertyName || "",
        equipmentType: data.equipmentType || "",
        operatorName: data.operatorName || "",
        refrigerantType: data.refrigerantType,
        refrigerantAmount: String(data.refrigerantAmount),
        hasLeakDetectionSystem: data.hasLeakDetectionSystem,
        assignedContractorId: data.assignedContractorId || "",
        notes: data.notes || "",
      })
      setIsLoading(false)
    }

    void fetchInstallation()

    return () => {
      isMounted = false
    }
  }, [params.id, refreshKey, router])

  function handleInspectionChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setInspectionForm({
      ...inspectionForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleEventChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setEventForm({
      ...eventForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleEditChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value

    setEditForm({
      ...editForm,
      [event.target.name]: value,
    })
  }

  function handleQuickEvent(type: InstallationEventType) {
    setEventForm((current) => ({
      ...current,
      type,
      date: current.date || getTodayInputValue(),
    }))
    window.setTimeout(() => {
      document.getElementById("event-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 0)
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault()
    setEditError("")
    setEditSuccess("")
    setIsSavingEdit(true)

    const res = await fetch(`/api/installations/${params.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(editForm),
    })

    const result: { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setEditError(result.error || "Kunde inte uppdatera installationen")
      setIsSavingEdit(false)
      return
    }

    setEditSuccess("Installationen har uppdaterats")
    setIsEditing(false)
    setRefreshKey((current) => current + 1)
    setIsSavingEdit(false)
  }

  async function handleArchiveInstallation() {
    setArchiveError("")

    const confirmed = window.confirm(
      "Är du säker på att du vill arkivera installationen?"
    )

    if (!confirmed) return

    setIsArchiving(true)

    const res = await fetch(`/api/installations/${params.id}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      const result: { error?: string } = await res.json()
      setArchiveError(result.error || "Kunde inte arkivera installationen")
      setIsArchiving(false)
      return
    }

    router.push("/dashboard")
  }

  async function handleInspectionSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError("")
    setSubmitSuccess("")
    setIsSubmitting(true)

    const res = await fetch(`/api/installations/${params.id}/inspections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(inspectionForm),
    })

    const result: { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setSubmitError(result.error || "Kunde inte registrera kontrollen")
      setIsSubmitting(false)
      return
    }

    setInspectionForm(initialInspectionFormData)
    setSubmitSuccess("Kontrollen har registrerats")
    setRefreshKey((current) => current + 1)
    setIsSubmitting(false)
  }

  async function handleEventSubmit(event: React.FormEvent) {
    event.preventDefault()
    setEventError("")
    setEventSuccess("")

    if (eventForm.type === "LEAK" && !eventForm.notes.trim()) {
      setEventError("Anteckningar krävs för läckagehändelser")
      return
    }

    setIsSubmittingEvent(true)

    const res = await fetch(`/api/installations/${params.id}/events`, {
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
    })

    const result: CreateEventResponse = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setEventError(result.error || "Kunde inte lägga till händelsen")
      setIsSubmittingEvent(false)
      return
    }

    if (!result.event) {
      setEventError("Kunde inte lägga till händelsen")
      setIsSubmittingEvent(false)
      return
    }

    const createdEvent = result.event
    setEvents((current) => [createdEvent, ...current].sort(compareEventsByDateDesc))

    if (result.inspectionSchedule) {
      setInstallation((current) =>
        current
          ? {
              ...current,
              lastInspection: result.inspectionSchedule?.lastInspection ?? null,
              nextInspection: result.inspectionSchedule?.nextInspection ?? null,
            }
          : current
      )
    }

    setEventForm(initialEventFormData)
    setEventSuccess("Händelsen har lagts till")
    setIsSubmittingEvent(false)
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900">
        <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline" href="/dashboard">
          Tillbaka till dashboard
        </Link>
        <p className="mt-6 text-slate-600">Laddar...</p>
      </main>
    )
  }

  if (error || !installation) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900">
        <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline" href="/dashboard">
          Tillbaka till dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-bold">Installation</h1>
        <p className="mt-3 text-slate-600">{error || "Installationen hittades inte"}</p>
      </main>
    )
  }

  const compliance = calculateInstallationCompliance(
    installation.refrigerantType,
    installation.refrigerantAmount,
    installation.hasLeakDetectionSystem,
    installation.lastInspection,
    installation.nextInspection
  )
  const leakageEvents = events.filter((event) => event.type === "LEAK")
  const totalLeakageKg = leakageEvents.reduce(
    (sum, event) => sum + (event.refrigerantAddedKg ?? 0),
    0
  )
  const latestLeakage = leakageEvents[0]?.date ?? null
  const risk = calculateInstallationRisk({
    refrigerantType: installation.refrigerantType,
    refrigerantAmount: installation.refrigerantAmount,
    gwp: compliance.gwp,
    hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
    leakageEventsCount: leakageEvents.length,
  })
  const canManage = currentUser?.role === "ADMIN"

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900">
      <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline" href="/dashboard">
        Tillbaka till dashboard
      </Link>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">{installation.name}</h1>
            <p className="mt-2 text-slate-600">{installation.location}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RiskBadge level={risk.level} />
            <ComplianceBadge status={compliance.status} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="Köldmedium" value={installation.refrigerantType} />
          <SummaryItem label="Fyllnadsmängd" value={`${formatNumber(installation.refrigerantAmount)} kg`} />
          <SummaryItem label="CO₂e" value={`${formatNumber(compliance.co2eTon)} ton`} />
          <SummaryItem label="Senaste kontroll" value={formatOptionalDate(installation.lastInspection)} />
          <SummaryItem label="Nästa kontroll" value={formatOptionalDate(installation.nextInspection)} />
        </div>
      </section>

      {canManage && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Snabbåtgärder</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <QuickActionButton label="+ Lägg till kontroll" onClick={() => handleQuickEvent("INSPECTION")} />
            <QuickActionButton label="+ Registrera läckage" onClick={() => handleQuickEvent("LEAK")} />
            <QuickActionButton label="+ Registrera påfyllning" onClick={() => handleQuickEvent("REFILL")} />
            <QuickActionButton label="+ Lägg till service" onClick={() => handleQuickEvent("SERVICE")} />
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Installationsdetaljer</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Fastighet" value={formatOptionalText(installation.propertyName)} />
            <DetailItem label="Utrustnings-ID" value={formatOptionalText(installation.equipmentId)} />
            <DetailItem label="Serienummer" value={formatOptionalText(installation.serialNumber)} />
            <DetailItem label="Utrustningstyp" value={formatOptionalText(installation.equipmentType)} />
            <DetailItem label="Operatör" value={formatOptionalText(installation.operatorName)} />
            <DetailItem
              label="Läckagevarningssystem"
              value={installation.hasLeakDetectionSystem ? "Ja" : "Nej"}
            />
            <DetailItem label="GWP" value={String(compliance.gwp)} />
            <DetailItem label="Kontrollintervall" value={formatInspectionInterval(compliance)} />
            <DetailItem label="Installationsdatum" value={formatDate(installation.installationDate)} />
          </dl>
          {installation.notes && (
            <div className="mt-5 rounded-md bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-950">Anteckningar</h3>
              <p className="mt-1 text-sm text-slate-700">{installation.notes}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Läckagehistorik</h2>
          <div className="mt-4 grid gap-4">
            <SummaryItem label="Antal läckage" value={String(leakageEvents.length)} />
            <SummaryItem label="Total läckagemängd" value={`${formatNumber(totalLeakageKg)} kg`} />
            <SummaryItem label="Senaste läckage" value={formatOptionalDate(latestLeakage)} />
          </div>
        </div>
      </section>

      {canManage && (
        <section className="installation-form-surface mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Redigera installation</h2>

          {!isEditing ? (
            <button
              className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Redigera
            </button>
          ) : (
            <form className="mt-4 grid max-w-xl gap-3" onSubmit={handleEditSubmit}>
              <label className={fieldClassName}>Namn<input name="name" value={editForm.name} onChange={handleEditChange} required /></label>
              <label className={fieldClassName}>Plats<input name="location" value={editForm.location} onChange={handleEditChange} required /></label>
              <label className={fieldClassName}>Fastighet<input name="propertyName" value={editForm.propertyName} onChange={handleEditChange} /></label>
              <label className={fieldClassName}>Utrustnings-ID<input name="equipmentId" value={editForm.equipmentId} onChange={handleEditChange} /></label>
              <label className={fieldClassName}>Serienummer<input name="serialNumber" value={editForm.serialNumber} onChange={handleEditChange} /></label>
              <label className={fieldClassName}>Utrustningstyp<input name="equipmentType" value={editForm.equipmentType} onChange={handleEditChange} /></label>
              <label className={fieldClassName}>Operatör<input name="operatorName" value={editForm.operatorName} onChange={handleEditChange} /></label>
              <label className={fieldClassName}>Köldmedium<input name="refrigerantType" value={editForm.refrigerantType} onChange={handleEditChange} required /></label>
              <label className={fieldClassName}>Mängd kg<input name="refrigerantAmount" value={editForm.refrigerantAmount} onChange={handleEditChange} required /></label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  name="hasLeakDetectionSystem"
                  type="checkbox"
                  checked={editForm.hasLeakDetectionSystem}
                  onChange={handleEditChange}
                />
                Läckagevarningssystem
              </label>
              <label className={fieldClassName}>
                Servicepartner
                <select name="assignedContractorId" value={editForm.assignedContractorId} onChange={handleEditChange}>
                  <option value="">Ingen tilldelad</option>
                  {contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {contractor.name} ({contractor.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldClassName}>Anteckningar<textarea name="notes" value={editForm.notes} onChange={handleEditChange} /></label>
              {editError && <p className="text-sm font-semibold text-red-700">{editError}</p>}
              {editSuccess && <p className="text-sm font-semibold text-green-700">{editSuccess}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={isSavingEdit}>
                  {isSavingEdit ? "Sparar..." : "Spara ändringar"}
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSavingEdit}
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}

          {!isEditing && editSuccess && (
            <p className="mt-3 text-sm font-semibold text-green-700">{editSuccess}</p>
          )}

          <div className="mt-6">
            {archiveError && <p className="mb-2 text-sm font-semibold text-red-700">{archiveError}</p>}
            <button
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              type="button"
              onClick={handleArchiveInstallation}
              disabled={isArchiving}
            >
              {isArchiving ? "Arkiverar..." : "Arkivera installation"}
            </button>
          </div>
        </section>
      )}

      {canManage && (
        <section className="installation-form-surface mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Registrera kontroll</h2>
          <form className="mt-4 grid max-w-xl gap-3" onSubmit={handleInspectionSubmit}>
            <label className={fieldClassName}>Datum<input name="inspectionDate" type="date" value={inspectionForm.inspectionDate} onChange={handleInspectionChange} required /></label>
            <label className={fieldClassName}>Kontrollant<input name="inspectorName" value={inspectionForm.inspectorName} onChange={handleInspectionChange} required /></label>
            <label className={fieldClassName}>
              Resultat
              <select name="status" value={inspectionForm.status} onChange={handleInspectionChange} required>
                <option value="">Välj resultat</option>
                <option value="Godkänd">Godkänd</option>
                <option value="Åtgärd krävs">Åtgärd krävs</option>
                <option value="Ej godkänd">Ej godkänd</option>
              </select>
            </label>
            <label className={fieldClassName}>Noteringar<textarea name="notes" value={inspectionForm.notes} onChange={handleInspectionChange} /></label>
            {submitError && <p className="text-sm font-semibold text-red-700">{submitError}</p>}
            {submitSuccess && <p className="text-sm font-semibold text-green-700">{submitSuccess}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sparar..." : "Spara kontroll"}
            </button>
          </form>
        </section>
      )}

      {canManage && (
        <section
          className="installation-form-surface mt-6 rounded-lg border border-slate-200 bg-white p-5"
          id="event-form"
        >
          <h2 className="text-lg font-semibold text-slate-950">Lägg till händelse</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kontrollhändelser uppdaterar automatiskt senaste och nästa kontroll.
          </p>
          <form className="mt-4 grid max-w-xl gap-3" onSubmit={handleEventSubmit}>
            <label className={fieldClassName}>Datum<input name="date" type="date" value={eventForm.date} onChange={handleEventChange} required /></label>
            <label className={fieldClassName}>
              Typ
              <select name="type" value={eventForm.type} onChange={handleEventChange} required>
                <option value="INSPECTION">Kontroll</option>
                <option value="LEAK">Läckage</option>
                <option value="REFILL">Påfyllning</option>
                <option value="SERVICE">Service</option>
              </select>
            </label>
            {eventForm.type === "REFILL" && (
              <label className={fieldClassName}>
                Påfylld mängd kg
                <input
                  name="refrigerantAddedKg"
                  value={eventForm.refrigerantAddedKg}
                  onChange={handleEventChange}
                  inputMode="decimal"
                />
              </label>
            )}
            <label className={fieldClassName}>
              Anteckningar
              <textarea
                name="notes"
                value={eventForm.notes}
                onChange={handleEventChange}
                required={eventForm.type === "LEAK"}
              />
            </label>
            {eventError && <p className="text-sm font-semibold text-red-700">{eventError}</p>}
            {eventSuccess && <p className="text-sm font-semibold text-green-700">{eventSuccess}</p>}
            <button type="submit" disabled={isSubmittingEvent}>
              {isSubmittingEvent ? "Sparar..." : "Lägg till händelse"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Kontrollhistorik</h2>
        {installation.inspections.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Inga kontroller registrerade ännu.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Datum</TableHeader>
                  <TableHeader>Kontrollant</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Nästa kontroll</TableHeader>
                  <TableHeader>Noteringar</TableHeader>
                  <TableHeader>Äldre fynd</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {installation.inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <TableCell>{formatDate(inspection.inspectionDate)}</TableCell>
                    <TableCell>{inspection.inspectorName}</TableCell>
                    <TableCell>{inspection.status || "-"}</TableCell>
                    <TableCell>{formatOptionalDate(inspection.nextDueDate)}</TableCell>
                    <TableCell>{inspection.notes || "-"}</TableCell>
                    <TableCell>{inspection.findings || "-"}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Händelsetimeline</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Inga händelser registrerade ännu.</p>
        ) : (
          <div className="mt-5 grid gap-4">
            {events.map((event) => (
              <EventTimelineItem event={event} key={event.id} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  )
}

function QuickActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function RiskBadge({ level }: { level: InstallationRiskLevel }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${RISK_TONE[level]}`}>
      Risknivå {level}
    </span>
  )
}

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${COMPLIANCE_TONE[status]}`}>
      {COMPLIANCE_LABELS[status]}
    </span>
  )
}

function EventTimelineItem({ event }: { event: InstallationEvent }) {
  return (
    <article className={`rounded-lg border p-4 ${EVENT_TONE[event.type]}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold">{formatDate(event.date)}</div>
          <h3 className="mt-1 text-base font-bold">{EVENT_LABELS[event.type]}</h3>
        </div>
        {event.refrigerantAddedKg !== null && event.refrigerantAddedKg !== undefined && (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
            {formatNumber(event.refrigerantAddedKg)} kg
          </span>
        )}
      </div>
      <p className="mt-3 text-sm">{event.notes || "Ingen anteckning"}</p>
      <p className="mt-2 text-xs opacity-80">Skapad av: {formatCreatedBy(event.createdBy)}</p>
    </article>
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
  return <td className="px-4 py-3 text-slate-800">{children}</td>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "-"
}

function formatOptionalText(value?: string | null) {
  return value || "-"
}

function formatCreatedBy(createdBy?: InstallationEvent["createdBy"]) {
  if (!createdBy) return "-"
  return createdBy.name || createdBy.email
}

function compareEventsByDateDesc(first: InstallationEvent, second: InstallationEvent) {
  return new Date(second.date).getTime() - new Date(first.date).getTime()
}

function formatInspectionInterval(compliance: {
  baseInspectionIntervalMonths: number | null
  inspectionIntervalMonths: number | null
  hasAdjustedInspectionInterval: boolean
}) {
  if (!compliance.inspectionIntervalMonths) return "Ingen kontrollplikt"

  if (!compliance.hasAdjustedInspectionInterval) {
    return `Var ${compliance.inspectionIntervalMonths}:e månad`
  }

  return `Var ${compliance.inspectionIntervalMonths}:e månad (basintervall ${compliance.baseInspectionIntervalMonths}:e månad, förlängt med läckagevarningssystem)`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}
