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

type DocumentType =
  | "INSPECTION_REPORT"
  | "SERVICE_REPORT"
  | "LEAK_REPORT"
  | "PHOTO"
  | "AUTHORITY_DOCUMENT"
  | "OTHER"

type InstallationDocument = {
  id: string
  uploadedById: string
  originalFileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
  documentType: DocumentType
  description?: string | null
  createdAt: string
  uploadedBy?: InstallationEvent["createdBy"]
  event?: {
    id: string
    type: InstallationEventType
    date: string
  } | null
}

type ActivityLogEntry = {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  user?: InstallationEvent["createdBy"]
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
  propertyId?: string | null
  property?: {
    id: string
    name: string
    municipality?: string | null
    city?: string | null
  } | null
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

type DocumentFormData = {
  documentType: DocumentType
  description: string
  eventId: string
}

type InstallationEditFormData = {
  name: string
  location: string
  propertyId: string
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

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
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

const initialDocumentFormData: DocumentFormData = {
  documentType: "OTHER",
  description: "",
  eventId: "",
}

const initialEditFormData: InstallationEditFormData = {
  name: "",
  location: "",
  propertyId: "",
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

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INSPECTION_REPORT: "Kontrollrapport",
  SERVICE_REPORT: "Serviceprotokoll",
  LEAK_REPORT: "Läckagerapport",
  PHOTO: "Foto",
  AUTHORITY_DOCUMENT: "Myndighetsunderlag",
  OTHER: "Övrigt",
}

const ACTIVITY_LABELS: Record<string, string> = {
  installation_created: "Aggregat skapat",
  installation_updated: "Aggregat uppdaterat",
  service_partner_assigned: "Servicepartner tilldelad",
  inspection_added: "Kontroll registrerad",
  leak_registered: "Läckage registrerat",
  refill_registered: "Påfyllning registrerad",
  service_added: "Service registrerad",
  document_uploaded: "Dokument uppladdat",
  document_deleted: "Dokument borttaget",
  report_exported: "Rapport exporterad",
  installation_archived: "Aggregat arkiverat",
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
  const [documents, setDocuments] = useState<InstallationDocument[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [inspectionForm, setInspectionForm] = useState<InspectionFormData>(
    initialInspectionFormData
  )
  const [eventForm, setEventForm] = useState<EventFormData>(initialEventFormData)
  const [documentForm, setDocumentForm] = useState<DocumentFormData>(
    initialDocumentFormData
  )
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [eventError, setEventError] = useState("")
  const [eventSuccess, setEventSuccess] = useState("")
  const [documentError, setDocumentError] = useState("")
  const [documentSuccess, setDocumentSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
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
      const [
        installationRes,
        userRes,
        eventsRes,
        documentsRes,
        activityRes,
        propertiesRes,
      ] = await Promise.all([
        fetch(`/api/installations/${params.id}`, {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        fetch(`/api/installations/${params.id}/events`, {
          credentials: "include",
        }),
        fetch(`/api/installations/${params.id}/documents`, {
          credentials: "include",
        }),
        fetch(`/api/installations/${params.id}/activity`, {
          credentials: "include",
        }),
        fetch("/api/properties", {
          credentials: "include",
        }),
      ])

      if (
        installationRes.status === 401 ||
        userRes.status === 401 ||
        eventsRes.status === 401 ||
        documentsRes.status === 401 ||
        activityRes.status === 401 ||
        propertiesRes.status === 401
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

      if (
        !installationRes.ok ||
        !userRes.ok ||
        !eventsRes.ok ||
        !documentsRes.ok ||
        !activityRes.ok ||
        !propertiesRes.ok
      ) {
        if (!isMounted) return
        setError("Kunde inte hämta installationen")
        setIsLoading(false)
        return
      }

      const data: InstallationDetail = await installationRes.json()
      const userData: CurrentUser = await userRes.json()
      const eventsData: InstallationEvent[] = await eventsRes.json()
      const documentsData: InstallationDocument[] = await documentsRes.json()
      const activityData: ActivityLogEntry[] = await activityRes.json()
      const propertiesData: PropertyOption[] = await propertiesRes.json()
      const contractorsData: Contractor[] =
        userData.role === "ADMIN"
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : []

      if (!isMounted) return

      setInstallation(data)
      setEvents(eventsData)
      setDocuments(documentsData)
      setActivityLogs(activityData)
      setContractors(contractorsData)
      setProperties(propertiesData)
      setCurrentUser(userData)
      setEditForm({
        name: data.name,
        location: data.location,
        propertyId: data.propertyId || "",
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

  function handleDocumentChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setDocumentForm({
      ...documentForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleDocumentFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setDocumentFile(event.target.files?.[0] ?? null)
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
    setRefreshKey((current) => current + 1)
    setIsSubmittingEvent(false)
  }

  async function handleDocumentSubmit(event: React.FormEvent) {
    event.preventDefault()
    setDocumentError("")
    setDocumentSuccess("")

    if (!documentFile) {
      setDocumentError("Välj en fil att ladda upp")
      return
    }

    setIsUploadingDocument(true)

    const formData = new FormData()
    formData.append("file", documentFile)
    formData.append("documentType", documentForm.documentType)
    formData.append("description", documentForm.description)
    formData.append("eventId", documentForm.eventId)

    const res = await fetch(`/api/installations/${params.id}/documents`, {
      method: "POST",
      credentials: "include",
      body: formData,
    })
    const result: InstallationDocument & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setDocumentError(result.error || "Kunde inte ladda upp dokumentet")
      setIsUploadingDocument(false)
      return
    }

    setDocuments((current) => [result, ...current])
    setDocumentForm(initialDocumentFormData)
    setDocumentFile(null)
    setDocumentSuccess("Dokumentet har laddats upp")
    setRefreshKey((current) => current + 1)
    setIsUploadingDocument(false)
  }

  async function handleDeleteDocument(documentId: string) {
    setDocumentError("")
    setDocumentSuccess("")
    setDeletingDocumentId(documentId)

    const res = await fetch(`/api/installations/${params.id}/documents/${documentId}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      const result: { error?: string } = await res.json()
      setDocumentError(result.error || "Kunde inte ta bort dokumentet")
      setDeletingDocumentId(null)
      return
    }

    setDocuments((current) => current.filter((document) => document.id !== documentId))
    setDocumentSuccess("Dokumentet har tagits bort")
    setRefreshKey((current) => current + 1)
    setDeletingDocumentId(null)
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
  const documentsByEventId = documents.reduce<Record<string, number>>((counts, document) => {
    if (!document.event?.id) return counts
    counts[document.event.id] = (counts[document.event.id] ?? 0) + 1
    return counts
  }, {})

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
            <DetailItem label="Kopplad fastighet" value={formatOptionalText(installation.property?.name)} />
            <DetailItem label="Kommun" value={formatOptionalText(installation.property?.municipality)} />
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
              <label className={fieldClassName}>
                Kopplad fastighet
                <select name="propertyId" value={editForm.propertyId} onChange={handleEditChange}>
                  <option value="">Ingen vald fastighet</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}{property.municipality ? `, ${property.municipality}` : ""}
                    </option>
                  ))}
                </select>
              </label>
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

      <section className="installation-form-surface mt-6 rounded-lg border border-slate-200 bg-white p-5" id="documents">
        <h2 className="text-lg font-semibold text-slate-950">Dokument</h2>
        <form className="mt-4 grid max-w-2xl gap-3" onSubmit={handleDocumentSubmit}>
          <label className={fieldClassName}>
            Ladda upp dokument
            <input
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,application/pdf,image/png,image/jpeg,image/webp,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleDocumentFileChange}
              type="file"
            />
          </label>
          <label className={fieldClassName}>
            Dokumenttyp
            <select
              name="documentType"
              value={documentForm.documentType}
              onChange={handleDocumentChange}
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClassName}>
            Beskrivning
            <textarea
              name="description"
              value={documentForm.description}
              onChange={handleDocumentChange}
            />
          </label>
          {events.length > 0 && (
            <label className={fieldClassName}>
              Koppla till händelse
              <select
                name="eventId"
                value={documentForm.eventId}
                onChange={handleDocumentChange}
              >
                <option value="">Ingen kopplad händelse</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatDate(event.date)} - {EVENT_LABELS[event.type]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {documentError && <p className="text-sm font-semibold text-red-700">{documentError}</p>}
          {documentSuccess && <p className="text-sm font-semibold text-green-700">{documentSuccess}</p>}
          <button type="submit" disabled={isUploadingDocument}>
            {isUploadingDocument ? "Laddar upp..." : "Ladda upp dokument"}
          </button>
        </form>

        {documents.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Inga dokument uppladdade ännu.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Dokument</TableHeader>
                  <TableHeader>Dokumenttyp</TableHeader>
                  <TableHeader>Kopplad händelse</TableHeader>
                  <TableHeader>Uppladdad av</TableHeader>
                  <TableHeader>Uppladdad datum</TableHeader>
                  <TableHeader>Storlek</TableHeader>
                  <TableHeader>Åtgärder</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-950">{document.originalFileName}</div>
                      {document.description && (
                        <div className="mt-1 text-xs text-slate-600">{document.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{DOCUMENT_TYPE_LABELS[document.documentType]}</TableCell>
                    <TableCell>{formatLinkedEvent(document.event)}</TableCell>
                    <TableCell>{formatCreatedBy(document.uploadedBy)}</TableCell>
                    <TableCell>{formatDate(document.createdAt)}</TableCell>
                    <TableCell>{formatFileSize(document.sizeBytes)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="font-semibold text-blue-700 underline-offset-4 hover:underline"
                          href={document.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Öppna dokument
                        </a>
                        {canDeleteDocument(document, currentUser) && (
                          <button
                            className="font-semibold text-red-700 underline-offset-4 hover:underline disabled:text-slate-400"
                            type="button"
                            disabled={deletingDocumentId === document.id}
                            onClick={() => void handleDeleteDocument(document.id)}
                          >
                            {deletingDocumentId === document.id ? "Tar bort..." : "Ta bort"}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
              <EventTimelineItem
                documentCount={documentsByEventId[event.id] ?? 0}
                event={event}
                key={event.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Aktivitetslogg</h2>
        {activityLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Ingen aktivitet registrerad ännu.</p>
        ) : (
          <div className="mt-5 grid gap-3">
            {activityLogs.map((entry) => (
              <article
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                key={entry.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      {formatActivityLabel(entry.action)}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {formatActivityMetadata(entry)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 sm:text-right">
                    <div>{formatDate(entry.createdAt)}</div>
                    <div>{formatCreatedBy(entry.user)}</div>
                  </div>
                </div>
              </article>
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

function EventTimelineItem({
  event,
  documentCount,
}: {
  event: InstallationEvent
  documentCount: number
}) {
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
      <div className="mt-2 flex flex-wrap gap-3 text-xs opacity-80">
        <span>Skapad av: {formatCreatedBy(event.createdBy)}</span>
        {documentCount > 0 && (
          <a className="font-semibold underline-offset-4 hover:underline" href="#documents">
            {documentCount} dokument
          </a>
        )}
      </div>
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

function formatLinkedEvent(event?: InstallationDocument["event"]) {
  if (!event) return "-"
  return `${formatDate(event.date)} - ${EVENT_LABELS[event.type]}`
}

function formatActivityLabel(action: string) {
  return ACTIVITY_LABELS[action] ?? action
}

function formatActivityMetadata(entry: ActivityLogEntry) {
  const metadata = entry.metadata

  if (!metadata) return entry.entityType

  if (typeof metadata.fileName === "string") return metadata.fileName
  if (typeof metadata.inspectorName === "string") return metadata.inspectorName
  if (typeof metadata.eventType === "string") {
    return EVENT_LABELS[metadata.eventType as InstallationEventType] ?? metadata.eventType
  }
  if (typeof metadata.name === "string") return metadata.name
  if (typeof metadata.format === "string" && typeof metadata.year === "number") {
    return `F-gas årsrapport ${metadata.year} (${metadata.format.toUpperCase()})`
  }

  return entry.entityType
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} kB`
  }

  return `${formatNumber(sizeBytes / 1024 / 1024)} MB`
}

function canDeleteDocument(
  document: InstallationDocument,
  currentUser: CurrentUser | null
) {
  if (!currentUser) return false
  if (currentUser.role === "ADMIN") return true

  return document.uploadedById === currentUser.userId
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
