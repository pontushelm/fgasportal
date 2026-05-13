"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui"
import type { CertificationStatusResult } from "@/lib/certification-status"
import {
  calculateCO2e,
  calculateInspectionObligation,
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import type { UserRole } from "@/lib/auth"
import {
  getInstallationEventAmountLabel,
  hasInstallationEventAmount,
} from "@/lib/installation-events"
import { isAdminRole } from "@/lib/roles"
import {
  calculateInstallationRisk,
  type InstallationRiskLevel,
} from "@/lib/risk-classification"
import {
  getRefrigerantRegulatoryStatus,
  type RefrigerantRegulatoryStatus,
} from "@/lib/refrigerant-regulatory-status"

type Inspection = {
  id: string
  inspectionDate: string
  inspectorName: string
  status?: string | null
  notes?: string | null
  findings?: string | null
  nextDueDate?: string | null
}

type InstallationEventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"
type LifecycleEventType = "ARCHIVE" | "SCRAP"
type EventFormType = InstallationEventType | LifecycleEventType

type InstallationEvent = {
  id: string
  date: string
  type: InstallationEventType
  refrigerantAddedKg?: number | null
  previousRefrigerantType?: string | null
  newRefrigerantType?: string | null
  previousAmountKg?: number | null
  newAmountKg?: number | null
  recoveredAmountKg?: number | null
  notes?: string | null
  supersededAt?: string | null
  supersededByEventId?: string | null
  supersededReason?: string | null
  supersededByUserId?: string | null
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
  installationDate: string | null
  lastInspection?: string | null
  nextInspection?: string | null
  archivedAt?: string | null
  scrappedAt?: string | null
  scrappedByCompanyMembershipId?: string | null
  scrapComment?: string | null
  scrapCertificateUrl?: string | null
  scrapCertificateFileName?: string | null
  scrapServicePartnerId?: string | null
  recoveredRefrigerantKg?: number | null
  assignedServicePartnerCompanyId?: string | null
  assignedServicePartnerCompany?: ServicePartnerCompanySummary | null
  assignedContractorId?: string | null
  assignedContractor?: {
    id: string
    name: string
    email: string
    certificationStatus: CertificationStatusResult
    servicePartnerCompany?: ServicePartnerCompanySummary | null
  } | null
  scrapServicePartner?: {
    id: string
    name: string
    email: string
    certificationStatus: CertificationStatusResult
    servicePartnerCompany?: ServicePartnerCompanySummary | null
  } | null
  notes?: string | null
  inspections: Inspection[]
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type EventFormData = {
  date: string
  type: EventFormType
  refrigerantAddedKg: string
  newRefrigerantType: string
  recoveredRefrigerantKg: string
  inspectionResult: string
  leakSource: string
  leakRepairedStatus: string
  refillRefrigerantType: string
  refillReason: string
  performedAction: string
  recoveryReason: string
  recoveryHandledBy: string
  supersededReason: string
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
  installationDate: string
  isInstallationDateUnknown: boolean
  assignedServicePartnerCompanyId: string
  assignedContractorId: string
  notes: string
}

type Contractor = {
  id: string
  name: string
  email: string
  certificationStatus?: CertificationStatusResult
  servicePartnerCompany?: ServicePartnerCompanySummary | null
}

type ServicePartnerCompanySummary = {
  id: string
  name: string
  organizationNumber?: string | null
}

type ScrapFormData = {
  scrappedAt: string
  servicePartnerId: string
  scrapComment: string
  recoveredRefrigerantKg: string
}

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
}

const initialEventFormData: EventFormData = {
  date: "",
  type: "SERVICE",
  refrigerantAddedKg: "",
  newRefrigerantType: "",
  recoveredRefrigerantKg: "",
  inspectionResult: "OK",
  leakSource: "UNKNOWN",
  leakRepairedStatus: "UNKNOWN",
  refillRefrigerantType: "",
  refillReason: "UNKNOWN",
  performedAction: "",
  recoveryReason: "UNKNOWN",
  recoveryHandledBy: "",
  supersededReason: "",
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
  installationDate: "",
  isInstallationDateUnknown: false,
  assignedServicePartnerCompanyId: "",
  assignedContractorId: "",
  notes: "",
}

const initialScrapFormData: ScrapFormData = {
  scrappedAt: "",
  servicePartnerId: "",
  scrapComment: "",
  recoveredRefrigerantKg: "",
}

const EVENT_LABELS: Record<InstallationEventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service / Reparation",
  REPAIR: "Service / Reparation",
  RECOVERY: "Tömning / Återvinning",
  REFRIGERANT_CHANGE: "Byte av köldmedium",
}

const EVENT_FORM_LABELS: Record<EventFormType, string> = {
  ...EVENT_LABELS,
  SCRAP: "Skrotning",
  ARCHIVE: "Arkivering",
}

const EVENT_TONE: Record<InstallationEventType, string> = {
  INSPECTION: "border-blue-200 bg-blue-50 text-blue-800",
  LEAK: "border-red-200 bg-red-50 text-red-800",
  REFILL: "border-amber-200 bg-amber-50 text-amber-800",
  SERVICE: "border-slate-200 bg-slate-50 text-slate-700",
  REPAIR: "border-violet-200 bg-violet-50 text-violet-800",
  RECOVERY: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REFRIGERANT_CHANGE: "border-cyan-200 bg-cyan-50 text-cyan-800",
}

const EVENT_HELP_TEXT: Record<EventFormType, string> = {
  INSPECTION: "Uppdaterar senaste och nästa kontroll automatiskt.",
  LEAK: "Registrera läckage och eventuell uppföljning utan att låsa ett helt arbetsflöde.",
  REFILL: "Ange mängd påfyllt köldmedium och kort orsak.",
  SERVICE: "En enkel journalanteckning för service eller reparation.",
  REPAIR: "Beskriv utförd åtgärd kort.",
  RECOVERY: "Ange återvunnen eller borttagen mängd om den är känd.",
  REFRIGERANT_CHANGE: "Används när aggregatet byter köldmedium.",
  ARCHIVE: "Arkivering tar bort aggregatet från aktiva vyer men sparar historiken.",
  SCRAP: "Skrotning markerar aggregatet som permanent taget ur drift.",
}

const INSPECTION_RESULT_OPTIONS = [
  { value: "OK", label: "OK" },
  { value: "REMARK", label: "Anmärkning" },
]

const LEAK_SOURCE_OPTIONS = [
  { value: "INSPECTION", label: "Kontroll" },
  { value: "ALARM", label: "Larm" },
  { value: "OPERATIONS", label: "Drift" },
  { value: "SERVICE", label: "Service" },
  { value: "OTHER", label: "Annat" },
  { value: "UNKNOWN", label: "Okänt" },
]

const LEAK_REPAIRED_OPTIONS = [
  { value: "YES", label: "Ja" },
  { value: "NO", label: "Nej" },
  { value: "UNKNOWN", label: "Okänt" },
]

const REFILL_REASON_OPTIONS = [
  { value: "LEAK", label: "Läckage" },
  { value: "SERVICE", label: "Service" },
  { value: "REFRIGERANT_CHANGE", label: "Byte av köldmedium" },
  { value: "OTHER", label: "Annat" },
  { value: "UNKNOWN", label: "Okänt" },
]

const RECOVERY_REASON_OPTIONS = [
  { value: "SERVICE", label: "Service" },
  { value: "REFRIGERANT_CHANGE", label: "Byte av köldmedium" },
  { value: "SCRAP", label: "Skrotning" },
  { value: "OTHER", label: "Annat" },
  { value: "UNKNOWN", label: "Okänt" },
]

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
  installation_scrapped: "Aggregat skrotat",
  service_partner_assigned: "Servicepartner tilldelad",
  inspection_added: "Kontroll registrerad",
  leak_registered: "Läckage registrerat",
  refill_registered: "Påfyllning registrerad",
  service_added: "Service registrerad",
  repair_registered: "Reparation registrerad",
  recovery_registered: "Tömning/återvinning registrerad",
  refrigerant_change_registered: "Byte av köldmedium registrerat",
  event_corrected: "Händelse korrigerad",
  document_uploaded: "Dokument uppladdat",
  document_deleted: "Dokument borttaget",
  report_exported: "Rapport exporterad",
  installation_archived: "Aggregat arkiverat",
  property_assigned: "Fastighet tilldelad",
  property_removed: "Fastighet borttagen",
}

const RISK_TONE: Record<InstallationRiskLevel, string> = {
  LOW: "border-green-200 bg-green-50 text-green-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  HIGH: "border-red-200 bg-red-50 text-red-800",
}

const REGULATORY_STATUS_TONE: Record<RefrigerantRegulatoryStatus, string> = {
  OK: "border-emerald-300 bg-emerald-50 text-emerald-900",
  REVIEW: "border-sky-300 bg-sky-50 text-sky-900",
  RESTRICTED: "border-red-300 bg-red-50 text-red-900",
  PHASE_OUT_RISK: "border-amber-300 bg-amber-50 text-amber-900",
  UNKNOWN: "border-slate-300 bg-slate-50 text-slate-800",
}

const RISK_LABELS: Record<InstallationRiskLevel, string> = {
  LOW: "Låg risk",
  MEDIUM: "Medelrisk",
  HIGH: "Hög risk",
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
const formControlClassName =
  "rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-600"
const historyPreviewLimit = 5
const minInstallationDate = "1950-01-01"
const maxInstallationDate = `${new Date().getFullYear() + 1}-12-31`

export default function InstallationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [installation, setInstallation] = useState<InstallationDetail | null>(null)
  const [events, setEvents] = useState<InstallationEvent[]>([])
  const [documents, setDocuments] = useState<InstallationDocument[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [servicePartnerCompanies, setServicePartnerCompanies] = useState<ServicePartnerCompanySummary[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [eventForm, setEventForm] = useState<EventFormData>(initialEventFormData)
  const [documentForm, setDocumentForm] = useState<DocumentFormData>(
    initialDocumentFormData
  )
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [eventError, setEventError] = useState("")
  const [eventSuccess, setEventSuccess] = useState("")
  const [correctingEvent, setCorrectingEvent] = useState<InstallationEvent | null>(null)
  const [documentError, setDocumentError] = useState("")
  const [documentSuccess, setDocumentSuccess] = useState("")
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<InstallationEditFormData>(
    initialEditFormData
  )
  const [editError, setEditError] = useState("")
  const [editSuccess, setEditSuccess] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showRefrigerantEditHelp, setShowRefrigerantEditHelp] = useState(false)
  const [archiveError, setArchiveError] = useState("")
  const [isArchiving, setIsArchiving] = useState(false)
  const [permanentDeleteConfirmation, setPermanentDeleteConfirmation] = useState("")
  const [permanentDeleteError, setPermanentDeleteError] = useState("")
  const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false)
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false)
  const [scrapForm, setScrapForm] = useState<ScrapFormData>(initialScrapFormData)
  const [scrapCertificateFile, setScrapCertificateFile] = useState<File | null>(null)
  const [scrapError, setScrapError] = useState("")
  const [isScrapping, setIsScrapping] = useState(false)
  const [lifecycleConfirmed, setLifecycleConfirmed] = useState(false)
  const [isInspectionHistoryExpanded, setIsInspectionHistoryExpanded] = useState(false)
  const [isEventTimelineExpanded, setIsEventTimelineExpanded] = useState(false)
  const [isActivityLogExpanded, setIsActivityLogExpanded] = useState(false)
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
        setError("Aggregatet hittades inte")
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
        setError("Kunde inte hämta aggregatet")
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
        isAdminRole(userData.role)
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : []
      const servicePartnerCompaniesData: ServicePartnerCompanySummary[] =
        isAdminRole(userData.role)
          ? await fetch("/api/service-partner-companies", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : []

      if (!isMounted) return

      setInstallation(data)
      setEvents(eventsData)
      setDocuments(documentsData)
      setActivityLogs(activityData)
      setContractors(contractorsData)
      setServicePartnerCompanies(servicePartnerCompaniesData)
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
        installationDate: toDateInputValue(data.installationDate),
        isInstallationDateUnknown: !data.installationDate,
        assignedServicePartnerCompanyId:
          data.assignedServicePartnerCompany?.id ??
          data.assignedContractor?.servicePartnerCompany?.id ??
          "",
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

  function handleEventChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    if (event.target.name === "type") {
      const nextType = event.target.value as EventFormType
      setLifecycleConfirmed(false)
      setEventForm((current) => ({
        ...current,
        type: nextType,
        date: current.date || getTodayInputValue(),
        refrigerantAddedKg:
          nextType === current.type &&
          isInstallationEventType(nextType) &&
          hasInstallationEventAmount(nextType)
            ? current.refrigerantAddedKg
            : "",
        newRefrigerantType:
          nextType === "REFRIGERANT_CHANGE" ? current.newRefrigerantType : "",
        recoveredRefrigerantKg:
          nextType === "REFRIGERANT_CHANGE" || nextType === "RECOVERY"
            ? current.recoveredRefrigerantKg
            : "",
        refillRefrigerantType:
          nextType === "REFILL"
            ? current.refillRefrigerantType || installation?.refrigerantType || ""
            : "",
      }))
      if (nextType === "SCRAP") {
        setScrapError("")
        setScrapForm((current) => ({
          ...current,
          servicePartnerId:
            current.servicePartnerId || installation?.assignedContractorId || "",
        }))
        setScrapCertificateFile(null)
      }
      return
    }

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

  function handleScrapChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setScrapForm({
      ...scrapForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleScrapFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setScrapCertificateFile(event.target.files?.[0] ?? null)
  }

  function handleEditChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value

    setEditForm((current) => {
      const next = {
        ...current,
        [event.target.name]: value,
        ...(event.target.name === "isInstallationDateUnknown" && value === true
          ? { installationDate: "" }
          : {}),
      }

      if (event.target.name === "assignedServicePartnerCompanyId") {
        const selectedContractor = contractors.find(
          (contractor) => contractor.id === current.assignedContractorId
        )
        if (
          selectedContractor?.servicePartnerCompany?.id &&
          selectedContractor.servicePartnerCompany.id !== value
        ) {
          next.assignedContractorId = ""
        }
      }

      if (event.target.name === "assignedContractorId") {
        const selectedContractor = contractors.find(
          (contractor) => contractor.id === value
        )
        if (selectedContractor?.servicePartnerCompany?.id) {
          next.assignedServicePartnerCompanyId =
            selectedContractor.servicePartnerCompany.id
        }
      }

      return next
    })
  }

  function openEventModal(type?: EventFormType) {
    const nextType = type ?? eventForm.type
    setCorrectingEvent(null)
    setEventError("")
    setEventSuccess("")
    setArchiveError("")
    setScrapError("")
    setLifecycleConfirmed(false)
    setEventForm((current) => ({
      ...current,
      type: nextType,
      date: current.date || getTodayInputValue(),
      newRefrigerantType:
        nextType === "REFRIGERANT_CHANGE" ? current.newRefrigerantType : "",
      recoveredRefrigerantKg:
        nextType === "REFRIGERANT_CHANGE" || nextType === "RECOVERY"
          ? current.recoveredRefrigerantKg
          : "",
      refillRefrigerantType:
        nextType === "REFILL"
          ? current.refillRefrigerantType || installation?.refrigerantType || ""
          : "",
    }))
    if (nextType === "SCRAP") {
      setScrapForm({
        ...initialScrapFormData,
        servicePartnerId: installation?.assignedContractorId || "",
      })
      setScrapCertificateFile(null)
    }
    setIsEventModalOpen(true)
  }

  function openCorrectionModal(event: InstallationEvent) {
    if (event.type === "REFRIGERANT_CHANGE") {
      setEventError(
        "Byte av köldmedium behöver korrigeras genom en ny köldmediehändelse så att aggregatets aktuella köldmedium inte ändras fel."
      )
      return
    }

    const noteDetails = parseEventNoteDetails(event.notes)
    const formType: EventFormType = event.type === "REPAIR" ? "SERVICE" : event.type

    setCorrectingEvent(event)
    setEventError("")
    setEventSuccess("")
    setArchiveError("")
    setScrapError("")
    setLifecycleConfirmed(false)
    setEventForm({
      ...initialEventFormData,
      date: toDateInputValue(event.date),
      type: formType,
      refrigerantAddedKg:
        event.refrigerantAddedKg !== null && event.refrigerantAddedKg !== undefined
          ? String(event.refrigerantAddedKg)
          : "",
      newRefrigerantType: event.newRefrigerantType || "",
      recoveredRefrigerantKg:
        event.recoveredAmountKg !== null && event.recoveredAmountKg !== undefined
          ? String(event.recoveredAmountKg)
          : "",
      inspectionResult: noteDetails.result === "Anmärkning" ? "REMARK" : "OK",
      leakSource: getOptionValue(LEAK_SOURCE_OPTIONS, noteDetails.source) ?? "UNKNOWN",
      leakRepairedStatus:
        getOptionValue(LEAK_REPAIRED_OPTIONS, noteDetails.repaired) ?? "UNKNOWN",
      refillRefrigerantType: noteDetails.refrigerant || installation?.refrigerantType || "",
      refillReason: getOptionValue(REFILL_REASON_OPTIONS, noteDetails.reason) ?? "UNKNOWN",
      performedAction: noteDetails.action || "",
      recoveryReason: getOptionValue(RECOVERY_REASON_OPTIONS, noteDetails.reason) ?? "UNKNOWN",
      recoveryHandledBy: noteDetails.handledBy || "",
      supersededReason: "Korrigerad felregistrering",
      notes: event.notes || "",
    })
    setIsEventModalOpen(true)
  }

  function closeEventModal() {
    if (isSubmittingEvent || isArchiving || isScrapping) return
    setIsEventModalOpen(false)
    setEventError("")
    setArchiveError("")
    setScrapError("")
    setCorrectingEvent(null)
    setLifecycleConfirmed(false)
  }

  function openDocumentModal() {
    setDocumentError("")
    setDocumentSuccess("")
    setDocumentFile(null)
    setDocumentForm(initialDocumentFormData)
    setIsDocumentModalOpen(true)
  }

  function closeDocumentModal() {
    if (isUploadingDocument) return
    setIsDocumentModalOpen(false)
    setDocumentError("")
  }

  function openPermanentDeleteModal() {
    setPermanentDeleteConfirmation("")
    setPermanentDeleteError("")
    setIsPermanentDeleteModalOpen(true)
  }

  function closePermanentDeleteModal() {
    if (isPermanentlyDeleting) return
    setIsPermanentDeleteModalOpen(false)
    setPermanentDeleteConfirmation("")
    setPermanentDeleteError("")
  }

  function openEditModal() {
    setEditError("")
    setEditSuccess("")
    setIsEditing(true)
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
      body: JSON.stringify({
        ...editForm,
        installationDate: editForm.isInstallationDateUnknown
          ? null
          : editForm.installationDate,
      }),
    })

    const result: { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setEditError(result.error || "Kunde inte uppdatera aggregatet")
      setIsSavingEdit(false)
      return
    }

    setEditSuccess("Aggregatet har uppdaterats")
    setIsEditing(false)
    setRefreshKey((current) => current + 1)
    setIsSavingEdit(false)
  }

  async function handleArchiveInstallation() {
    setArchiveError("")
    setEventError("")

    if (!lifecycleConfirmed) {
      setArchiveError("Bekräfta arkiveringen innan du fortsätter")
      return
    }

    setIsArchiving(true)

    const res = await fetch(`/api/installations/${params.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        archiveComment: eventForm.notes,
      }),
    })

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      const result: { error?: string } = await res.json()
      setArchiveError(result.error || "Kunde inte arkivera aggregatet")
      setIsArchiving(false)
      return
    }

    setEventSuccess("Aggregatet har arkiverats")
    setIsEventModalOpen(false)
    router.push("/dashboard")
  }

  async function submitScrapEvent() {
    setScrapError("")
    setEventError("")

    if (!lifecycleConfirmed) {
      setScrapError("Bekräfta skrotningen innan du fortsätter")
      return
    }

    if (!scrapCertificateFile) {
      setScrapError("Skrotningsintyg krävs")
      return
    }

    setIsScrapping(true)
    const formData = new FormData()
    formData.append("scrappedAt", eventForm.date)
    formData.append("servicePartnerId", scrapForm.servicePartnerId)
    formData.append("scrapComment", eventForm.notes)
    formData.append("recoveredRefrigerantKg", scrapForm.recoveredRefrigerantKg)
    formData.append("certificate", scrapCertificateFile)

    const res = await fetch(`/api/installations/${params.id}/scrap`, {
      method: "POST",
      credentials: "include",
      body: formData,
    })
    const result: { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setScrapError(result.error || "Kunde inte skrota aggregatet")
      setIsScrapping(false)
      return
    }

    setEventSuccess("Aggregatet har skrotats")
    setIsEventModalOpen(false)
    setEventForm(initialEventFormData)
    setScrapForm(initialScrapFormData)
    setScrapCertificateFile(null)
    setRefreshKey((current) => current + 1)
    setIsScrapping(false)
  }

  async function handleEventSubmit(event: React.FormEvent) {
    event.preventDefault()
    setEventError("")
    setEventSuccess("")
    setArchiveError("")
    setScrapError("")

    if (eventForm.type === "ARCHIVE") {
      await handleArchiveInstallation()
      return
    }

    if (eventForm.type === "SCRAP") {
      await submitScrapEvent()
      return
    }

    if (
      eventForm.type === "REFRIGERANT_CHANGE" &&
      !eventForm.newRefrigerantType.trim()
    ) {
      setEventError("Ange nytt köldmedium")
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
          (eventForm.type === "LEAK" ||
            eventForm.type === "REFILL" ||
            eventForm.type === "REFRIGERANT_CHANGE")
            ? eventForm.refrigerantAddedKg
            : "",
        newRefrigerantType:
          eventForm.type === "REFRIGERANT_CHANGE"
            ? eventForm.newRefrigerantType
            : "",
        recoveredRefrigerantKg:
          eventForm.type === "REFRIGERANT_CHANGE" || eventForm.type === "RECOVERY"
            ? eventForm.recoveredRefrigerantKg
            : "",
        notes: buildEventNotes(eventForm),
        correctingEventId: correctingEvent?.id,
        supersededReason: correctingEvent ? eventForm.supersededReason : undefined,
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
    setEvents((current) =>
      [
        createdEvent,
        ...current.map((existingEvent) =>
          correctingEvent && existingEvent.id === correctingEvent.id
            ? {
                ...existingEvent,
                supersededAt: new Date().toISOString(),
                supersededByEventId: createdEvent.id,
                supersededReason:
                  eventForm.supersededReason.trim() || "Korrigerad händelse",
              }
            : existingEvent
        ),
      ].sort(compareEventsByDateDesc)
    )

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
    setEventSuccess(
      correctingEvent ? "Händelsen har korrigerats" : "Händelsen har lagts till"
    )
    setCorrectingEvent(null)
    setIsEventModalOpen(false)
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
    setIsDocumentModalOpen(false)
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

  async function handlePermanentDelete(event: React.FormEvent) {
    event.preventDefault()
    setPermanentDeleteError("")
    setIsPermanentlyDeleting(true)

    const res = await fetch(`/api/installations/${params.id}/permanent-delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        confirmation: permanentDeleteConfirmation,
      }),
    })

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      const result: { error?: string } = await res.json()
      setPermanentDeleteError(
        result.error || "Kunde inte ta bort aggregatet permanent"
      )
      setIsPermanentlyDeleting(false)
      return
    }

    router.push("/dashboard/installations")
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900">
        <p className="text-slate-600">Laddar...</p>
      </main>
    )
  }

  if (error || !installation) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900">
        <h1 className="text-3xl font-bold">Aggregat</h1>
        <p className="mt-3 text-slate-600">{error || "Aggregatet hittades inte"}</p>
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
    isInspectionOverdue: compliance.status === "OVERDUE",
  })
  const refrigerantRegulatoryStatus = getRefrigerantRegulatoryStatus({
    refrigerantType: installation.refrigerantType,
    refrigerantAmountKg: installation.refrigerantAmount,
  })
  const canManage = isAdminRole(currentUser?.role)
  const canPermanentlyDelete = currentUser?.role === "OWNER"
  const isArchived = Boolean(installation.archivedAt)
  const isScrapped = Boolean(installation.scrappedAt)
  const canManageActiveInstallation = canManage && !isArchived && !isScrapped
  const permanentDeleteLabel = installation.equipmentId || installation.name
  const editInspectionPreview = calculateInspectionPreview(
    editForm.refrigerantType,
    editForm.refrigerantAmount,
    editForm.hasLeakDetectionSystem
  )
  const documentsByEventId = documents.reduce<Record<string, number>>((counts, document) => {
    if (!document.event?.id) return counts
    counts[document.event.id] = (counts[document.event.id] ?? 0) + 1
    return counts
  }, {})
  const eventCertificationWarning = getCertificationWarning(
    installation.assignedContractor?.certificationStatus ?? null
  )
  const visibleInspections = isInspectionHistoryExpanded
    ? installation.inspections
    : installation.inspections.slice(0, historyPreviewLimit)
  const visibleEvents = isEventTimelineExpanded
    ? events
    : events.slice(0, historyPreviewLimit)
  const visibleActivityLogs = isActivityLogExpanded
    ? activityLogs
    : activityLogs.slice(0, historyPreviewLimit)
  const selectedScrapContractor = contractors.find(
    (contractor) => contractor.id === scrapForm.servicePartnerId
  )
  const servicePartnerCompanyOptions = deriveServicePartnerCompanies(
    contractors,
    servicePartnerCompanies,
    installation.assignedServicePartnerCompany
  )
  const editContactOptions = editForm.assignedServicePartnerCompanyId
    ? contractors.filter(
        (contractor) =>
          contractor.servicePartnerCompany?.id ===
          editForm.assignedServicePartnerCompanyId
      )
    : contractors
  const scrapCertificationWarning = getCertificationWarning(
    selectedScrapContractor?.certificationStatus ?? null
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-slate-900 sm:py-10">
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{installation.name}</h1>
            <p className="mt-2 text-slate-600">{installation.location}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isScrapped ? (
              <ScrappedBadge />
            ) : isArchived ? (
              <ArchivedBadge />
            ) : (
              <>
                <RiskBadge level={risk.level} reasons={risk.reasons} />
                <RefrigerantRegulatoryBadge status={refrigerantRegulatoryStatus} />
                <ComplianceBadge status={compliance.status} />
              </>
            )}
          </div>
        </div>

        {canManageActiveInstallation && (
          <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 sm:flex sm:flex-wrap">
            <ActionButton label="Ny händelse" onClick={() => openEventModal()} primary />
            <ActionButton label="Redigera aggregat" onClick={openEditModal} />
          </div>
        )}

        {(editSuccess || eventSuccess || documentSuccess || archiveError) && (
          <div className="mt-4 grid gap-2 text-sm font-semibold">
            {editSuccess && <p className="text-green-700">{editSuccess}</p>}
            {eventSuccess && <p className="text-green-700">{eventSuccess}</p>}
            {documentSuccess && <p className="text-green-700">{documentSuccess}</p>}
            {archiveError && <p className="text-red-700">{archiveError}</p>}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="Köldmedium" value={installation.refrigerantType} />
          <SummaryItem label="Fyllnadsmängd" value={`${formatNumber(installation.refrigerantAmount)} kg`} />
          <SummaryItem
            label="CO₂e"
            value={
              compliance.co2eTon === null
                ? "Okänt GWP-värde"
                : `${formatNumber(compliance.co2eTon)} ton`
            }
          />
          <SummaryItem label="Senaste kontroll" value={formatOptionalDate(installation.lastInspection)} />
          <SummaryItem label="Nästa kontroll" value={formatOptionalDate(installation.nextInspection)} />
        </div>

      </section>

      {isScrapped && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Skrotning</h2>
              <p className="mt-1 text-sm text-slate-600">
                Aggregatet är permanent taget ur drift men sparas historiskt.
              </p>
            </div>
            <ScrappedBadge />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Skrotningsdatum" value={formatOptionalDate(installation.scrappedAt)} />
            <DetailItem
              label="Servicekontakt"
              value={
                formatAssignedContractor(installation.scrapServicePartner) ||
                selectedScrapContractor?.name ||
                "-"
              }
            />
            {installation.recoveredRefrigerantKg != null && (
              <DetailItem
                label="Återvunnen mängd köldmedium"
                value={`${formatNumber(installation.recoveredRefrigerantKg)} kg`}
              />
            )}
            <div>
              <dt className="text-sm font-medium text-slate-600">Skrotningsintyg</dt>
              <dd className="mt-2">
                {installation.scrapCertificateUrl ? (
                  <a
                    className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    href={installation.scrapCertificateUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {installation.scrapCertificateFileName || "Öppna intyg"}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-950">-</span>
                )}
              </dd>
            </div>
          </dl>
          {installation.scrapComment && (
            <div className="mt-4 rounded-md bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Kommentar</h3>
              <p className="mt-1 text-sm text-slate-700">{installation.scrapComment}</p>
            </div>
          )}
        </section>
      )}

      {isArchived && !isScrapped && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Arkiverat aggregat</h2>
              <p className="mt-1 text-sm text-slate-600">
                Aggregatet visas för historik men ingår inte i aktiva listor.
              </p>
            </div>
            <ArchivedBadge />
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Aggregatdetaljer</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Kopplad fastighet" value={formatOptionalText(installation.property?.name)} />
            <DetailItem label="Kommun" value={formatOptionalText(installation.property?.municipality)} />
            <DetailItem label="Utrustnings-ID" value={formatOptionalText(installation.equipmentId)} />
            <DetailItem label="Serienummer" value={formatOptionalText(installation.serialNumber)} />
            <DetailItem label="Utrustningstyp" value={formatOptionalText(installation.equipmentType)} />
            <DetailItem label="Operatör" value={formatOptionalText(installation.operatorName)} />
            <DetailItem
              label="Servicepartnerföretag"
              value={formatOptionalText(
                installation.assignedServicePartnerCompany?.name ??
                  installation.assignedContractor?.servicePartnerCompany?.name
              )}
            />
            {installation.assignedContractor && (
              <ServicepartnerDetailItem contractor={installation.assignedContractor} />
            )}
            <DetailItem
              label="Läckagevarningssystem"
              value={installation.hasLeakDetectionSystem ? "Ja" : "Nej"}
            />
            <DetailItem
              label="GWP"
              value={compliance.gwp === null ? "Okänt GWP-värde" : String(compliance.gwp)}
            />
            <DetailItem label="Kontrollintervall" value={formatInspectionInterval(compliance)} />
            <DetailItem
              label="Driftsättningsdatum"
              value={formatKnownDate(installation.installationDate)}
            />
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

      <section className="installation-form-surface mt-6 rounded-lg border border-slate-200 bg-white p-5" id="documents">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Dokument</h2>
            <p className="mt-1 text-sm text-slate-600">
              {documents.length} uppladdade dokument
            </p>
          </div>
          {canManageActiveInstallation && (
            <ActionButton label="Ladda upp dokument" onClick={openDocumentModal} />
          )}
        </div>
        {isScrapped && (
          <p className="mt-2 text-sm text-slate-600">
            Aggregatet är skrotat. Befintliga dokument visas för historik.
          </p>
        )}
        {documentError && <p className="mt-3 text-sm font-semibold text-red-700">{documentError}</p>}
        {documentSuccess && <p className="mt-3 text-sm font-semibold text-green-700">{documentSuccess}</p>}

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
                        {!isArchived &&
                          !isScrapped &&
                          canDeleteDocument(document, currentUser) && (
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
                {visibleInspections.map((inspection) => (
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
            <HistoryToggleButton
              isExpanded={isInspectionHistoryExpanded}
              itemCount={installation.inspections.length}
              limit={historyPreviewLimit}
              onClick={() =>
                setIsInspectionHistoryExpanded((current) => !current)
              }
            />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Händelsetimeline</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Inga händelser registrerade ännu.</p>
        ) : (
          <div className="mt-5 grid gap-4">
            {visibleEvents.map((event) => (
              <EventTimelineItem
                documentCount={documentsByEventId[event.id] ?? 0}
                event={event}
                key={event.id}
                onCorrect={openCorrectionModal}
                canCorrect={
                  canManageActiveInstallation &&
                  isAdminRole(currentUser?.role) &&
                  event.type !== "REFRIGERANT_CHANGE"
                }
              />
            ))}
            <HistoryToggleButton
              isExpanded={isEventTimelineExpanded}
              itemCount={events.length}
              limit={historyPreviewLimit}
              onClick={() => setIsEventTimelineExpanded((current) => !current)}
            />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Aktivitetslogg</h2>
        {activityLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Ingen aktivitet registrerad ännu.</p>
        ) : (
          <div className="mt-5 grid gap-3">
            {visibleActivityLogs.map((entry) => (
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
            <HistoryToggleButton
              isExpanded={isActivityLogExpanded}
              itemCount={activityLogs.length}
              limit={historyPreviewLimit}
              onClick={() => setIsActivityLogExpanded((current) => !current)}
            />
          </div>
        )}
      </section>

      {canPermanentlyDelete && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Avancerade åtgärder
              </h2>
            </div>
            <button
              className="inline-flex justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              type="button"
              onClick={openPermanentDeleteModal}
            >
              Ta bort permanent
            </button>
          </div>
        </section>
      )}

      {isEditing && canManageActiveInstallation && (
        <ModalFrame
          title="Redigera aggregat"
          onClose={() => setIsEditing(false)}
          closeDisabled={isSavingEdit}
        >
          <form className="grid gap-3" onSubmit={handleEditSubmit}>
            <p className="text-xs text-slate-500">* Obligatoriskt</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldClassName}>
                <span>Namn <RequiredMark /></span>
                <input className={formControlClassName} name="name" value={editForm.name} onChange={handleEditChange} required />
              </label>
              <label className={fieldClassName}>
                Plats
                <input className={formControlClassName} name="location" value={editForm.location} onChange={handleEditChange} placeholder="Plats eller placering" />
              </label>
              <label className={fieldClassName}>
                Fastighet
                <select className={formControlClassName} name="propertyId" value={editForm.propertyId} onChange={handleEditChange}>
                  <option value="">Ingen vald fastighet</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}{property.municipality ? `, ${property.municipality}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldClassName}>
                Utrustnings-ID
                <input className={formControlClassName} name="equipmentId" value={editForm.equipmentId} onChange={handleEditChange} />
              </label>
              <label className={fieldClassName}>
                Serienummer
                <input className={formControlClassName} name="serialNumber" value={editForm.serialNumber} onChange={handleEditChange} />
              </label>
              <label className={fieldClassName}>
                Utrustningstyp
                <input className={formControlClassName} name="equipmentType" value={editForm.equipmentType} onChange={handleEditChange} />
              </label>
              <label className={fieldClassName}>
                Operatör
                <input className={formControlClassName} name="operatorName" value={editForm.operatorName} onChange={handleEditChange} />
              </label>
              <label
                className={fieldClassName}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setShowRefrigerantEditHelp(false)
                  }
                }}
              >
                <span>Köldmedium <RequiredMark /></span>
                <div className="flex gap-2">
                  <input
                    className={`${formControlClassName} flex-1`}
                    name="refrigerantType"
                    value={editForm.refrigerantType}
                    readOnly
                    onClick={() => setShowRefrigerantEditHelp(true)}
                    onFocus={() => setShowRefrigerantEditHelp(true)}
                  />
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                    aria-label="Information om köldmedium"
                    onClick={() => setShowRefrigerantEditHelp((current) => !current)}
                  >
                    i
                  </button>
                </div>
                {showRefrigerantEditHelp && (
                  <span className="text-xs font-normal text-amber-700">
                    Ändring av köldmedium påverkar CO₂e, kontrollplikt och
                    historik. Registrera normalt ändringen via händelsen “Byte
                    av köldmedium”.
                  </span>
                )}
              </label>
              <label className={fieldClassName}>
                <span>Mängd kg <RequiredMark /></span>
                <input className={formControlClassName} name="refrigerantAmount" value={editForm.refrigerantAmount} onChange={handleEditChange} required />
              </label>
              <label className={fieldClassName}>
                Driftsättningsdatum
                <input
                  className={formControlClassName}
                  name="installationDate"
                  type="date"
                  min={minInstallationDate}
                  max={maxInstallationDate}
                  value={editForm.installationDate}
                  onChange={handleEditChange}
                  disabled={editForm.isInstallationDateUnknown}
                  required={!editForm.isInstallationDateUnknown}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  name="isInstallationDateUnknown"
                  type="checkbox"
                  checked={editForm.isInstallationDateUnknown}
                  onChange={handleEditChange}
                />
                Driftsättningsdatum okänt
              </label>
              <label className={fieldClassName}>
                Servicepartnerföretag
                <select
                  className={formControlClassName}
                  name="assignedServicePartnerCompanyId"
                  value={editForm.assignedServicePartnerCompanyId}
                  onChange={handleEditChange}
                >
                  <option value="">Ingen vald</option>
                  {servicePartnerCompanyOptions.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldClassName}>
                Valfri servicekontakt / tekniker
                <select
                  className={formControlClassName}
                  name="assignedContractorId"
                  value={editForm.assignedContractorId}
                  onChange={handleEditChange}
                >
                  <option value="">Ingen vald</option>
                  {editContactOptions.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {formatContractorOption(contractor)} ({contractor.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                name="hasLeakDetectionSystem"
                type="checkbox"
                checked={editForm.hasLeakDetectionSystem}
                onChange={handleEditChange}
              />
              <span>
                Läckagevarningssystem finns
                <span className="block text-xs font-normal text-slate-500">
                  Kan påverka lagstadgat kontrollintervall.
                </span>
              </span>
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">Kontrollplikt</p>
              <p className="mt-1 text-slate-700">{editInspectionPreview.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {editInspectionPreview.explanation}
              </p>
              {editInspectionPreview.co2eTon != null && (
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Beräknad CO₂e: {formatNumber(editInspectionPreview.co2eTon)} ton
                </p>
              )}
            </div>
            <label className={fieldClassName}>
              Anteckningar
              <textarea className={formControlClassName} name="notes" value={editForm.notes} onChange={handleEditChange} />
            </label>
            {editError && <p className="text-sm font-semibold text-red-700">{editError}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                type="submit"
                disabled={isSavingEdit}
              >
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
        </ModalFrame>
      )}

      {isEventModalOpen && canManageActiveInstallation && (
        <ModalFrame
          title={
            correctingEvent
              ? `Korrigera händelse: ${EVENT_FORM_LABELS[eventForm.type]}`
              : `Ny händelse: ${EVENT_FORM_LABELS[eventForm.type]}`
          }
          description={
            correctingEvent
              ? "En korrigering skapar en ny ersättande händelse. Den ursprungliga händelsen sparas i historiken men används inte i beräkningar."
              : EVENT_HELP_TEXT[eventForm.type]
          }
          onClose={closeEventModal}
          closeDisabled={isSubmittingEvent || isArchiving || isScrapping}
        >
          <form className="grid gap-4" onSubmit={handleEventSubmit}>
            {correctingEvent && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Korrigering av tidigare händelse</p>
                <p className="mt-1">
                  En ny händelse skapas och den tidigare markeras som ersatt. Den ersatta
                  händelsen finns kvar i historiken men används inte i beräkningar.
                </p>
                <label className={`${fieldClassName} mt-3`}>
                  Orsak till korrigering
                  <input
                    className={formControlClassName}
                    name="supersededReason"
                    value={eventForm.supersededReason}
                    onChange={handleEventChange}
                  />
                </label>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldClassName}>
                Datum
                <input className={formControlClassName} name="date" type="date" value={eventForm.date} onChange={handleEventChange} required autoFocus />
              </label>
              <label className={fieldClassName}>
                Typ
                <select className={formControlClassName} name="type" value={eventForm.type} onChange={handleEventChange} required disabled={Boolean(correctingEvent)}>
                  <option value="INSPECTION">Kontroll</option>
                  <option value="LEAK">Läckage</option>
                  <option value="REFILL">Påfyllning</option>
                  <option value="SERVICE">Service / Reparation</option>
                  <option value="RECOVERY">Tömning / Återvinning</option>
                  <option value="REFRIGERANT_CHANGE">Byte av köldmedium</option>
                  <option value="SCRAP">Skrotning</option>
                </select>
              </label>
            </div>
            {eventForm.type === "INSPECTION" && (
              <div className="grid gap-3 rounded-md border border-blue-100 bg-blue-50 p-3">
                <label className={fieldClassName}>
                  Resultat
                  <select
                    className={formControlClassName}
                    name="inspectionResult"
                    value={eventForm.inspectionResult}
                    onChange={handleEventChange}
                  >
                    {INSPECTION_RESULT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-blue-900">
                  Kontrollrapport kan laddas upp som dokument efter att händelsen sparats.
                </p>
              </div>
            )}
            {eventForm.type === "LEAK" && (
              <div className="grid gap-3 rounded-md border border-red-100 bg-red-50 p-3 sm:grid-cols-2">
                <label className={fieldClassName}>
                  Läckagemängd (kg)
                  <input
                    className={formControlClassName}
                    name="refrigerantAddedKg"
                    value={eventForm.refrigerantAddedKg}
                    onChange={handleEventChange}
                    inputMode="decimal"
                  />
                </label>
                <label className={fieldClassName}>
                  Upptäckt via
                  <select
                    className={formControlClassName}
                    name="leakSource"
                    value={eventForm.leakSource}
                    onChange={handleEventChange}
                  >
                    {LEAK_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={fieldClassName}>
                  Åtgärdat
                  <select
                    className={formControlClassName}
                    name="leakRepairedStatus"
                    value={eventForm.leakRepairedStatus}
                    onChange={handleEventChange}
                  >
                    {LEAK_REPAIRED_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {eventForm.type === "REFILL" && (
              <div className="grid gap-3 rounded-md border border-amber-100 bg-amber-50 p-3 sm:grid-cols-2">
                <label className={fieldClassName}>
                  <span>Påfylld mängd (kg) <RequiredMark /></span>
                  <input
                    className={formControlClassName}
                    name="refrigerantAddedKg"
                    value={eventForm.refrigerantAddedKg}
                    onChange={handleEventChange}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className={fieldClassName}>
                  Köldmedium
                  <input
                    className={formControlClassName}
                    name="refillRefrigerantType"
                    value={eventForm.refillRefrigerantType}
                    onChange={handleEventChange}
                    placeholder={installation.refrigerantType}
                  />
                </label>
                <label className={fieldClassName}>
                  Orsak
                  <select
                    className={formControlClassName}
                    name="refillReason"
                    value={eventForm.refillReason}
                    onChange={handleEventChange}
                  >
                    {REFILL_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {eventForm.type === "SERVICE" && (
              <label className={fieldClassName}>
                Utförd åtgärd
                <input
                  className={formControlClassName}
                  name="performedAction"
                  value={eventForm.performedAction}
                  onChange={handleEventChange}
                  placeholder="Kort beskrivning av service eller reparation"
                />
              </label>
            )}
            {eventForm.type === "RECOVERY" && (
              <div className="grid gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-2">
                <label className={fieldClassName}>
                  Omhändertagen mängd (kg)
                  <input
                    className={formControlClassName}
                    name="recoveredRefrigerantKg"
                    value={eventForm.recoveredRefrigerantKg}
                    onChange={handleEventChange}
                    inputMode="decimal"
                  />
                </label>
                <label className={fieldClassName}>
                  Orsak
                  <select
                    className={formControlClassName}
                    name="recoveryReason"
                    value={eventForm.recoveryReason}
                    onChange={handleEventChange}
                  >
                    {RECOVERY_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={fieldClassName}>
                  Omhändertaget av
                  <input
                    className={formControlClassName}
                    name="recoveryHandledBy"
                    value={eventForm.recoveryHandledBy}
                    onChange={handleEventChange}
                    placeholder="Företag, tekniker eller mottagare"
                  />
                </label>
              </div>
            )}
            {eventForm.type === "REFRIGERANT_CHANGE" && (
              <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">
                  Byte av köldmedium påverkar CO₂e, kontrollplikt,
                  kontrollintervall, riskklassning och rapportering.
                </p>
                <p className="text-xs text-amber-900">
                  Åtgärden bör utföras av behörig/certifierad personal.
                  Ändringen kommer sparas i aggregatets historik.
                </p>
                <label className={fieldClassName}>
                  Nuvarande köldmedium
                  <input
                    className={formControlClassName}
                    value={installation.refrigerantType}
                    readOnly
                  />
                </label>
                <label className={fieldClassName}>
                  Nuvarande fyllnadsmängd
                  <input
                    className={formControlClassName}
                    value={`${formatNumber(installation.refrigerantAmount)} kg`}
                    readOnly
                  />
                </label>
                <label className={fieldClassName}>
                  <span>Nytt köldmedium <RequiredMark /></span>
                  <input
                    className={formControlClassName}
                    name="newRefrigerantType"
                    placeholder="t.ex. R449A"
                    value={eventForm.newRefrigerantType}
                    onChange={handleEventChange}
                    required
                  />
                </label>
                <label className={fieldClassName}>
                  Omhändertagen mängd (kg)
                  <input
                    className={formControlClassName}
                    name="recoveredRefrigerantKg"
                    value={eventForm.recoveredRefrigerantKg}
                    onChange={handleEventChange}
                    inputMode="decimal"
                  />
                </label>
                <label className={fieldClassName}>
                  {getInstallationEventAmountLabel("REFRIGERANT_CHANGE", {
                    includeUnit: true,
                  })}
                  <input
                    className={formControlClassName}
                    name="refrigerantAddedKg"
                    value={eventForm.refrigerantAddedKg}
                    onChange={handleEventChange}
                    inputMode="decimal"
                    required
                  />
                </label>
              </div>
            )}
            <label className={fieldClassName}>
              {eventForm.type === "ARCHIVE" || eventForm.type === "SCRAP"
                ? "Anteckning"
                : "Anteckningar"}
              <textarea
                className={formControlClassName}
                name="notes"
                value={eventForm.notes}
                onChange={handleEventChange}
              />
            </label>
            {eventForm.type === "SCRAP" && (
              <>
                <label className={fieldClassName}>
                  <span>Servicekontakt/tekniker <RequiredMark /></span>
                  <select
                    className={formControlClassName}
                    name="servicePartnerId"
                    value={scrapForm.servicePartnerId}
                    onChange={handleScrapChange}
                    required
                  >
                    <option value="">Välj servicekontakt</option>
                  {contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {formatContractorOption(contractor)} ({contractor.email})
                    </option>
                  ))}
                  </select>
                </label>
                {selectedScrapContractor?.certificationStatus && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <span className="font-medium">Certifiering:</span>
                    <CertificationBadge status={selectedScrapContractor.certificationStatus} />
                  </div>
                )}
                {scrapCertificationWarning && (
                  <CertificationWarningBox message={scrapCertificationWarning} />
                )}
                <label className={fieldClassName}>
                  Återvunnen mängd köldmedium kg
                  <input
                    className={formControlClassName}
                    name="recoveredRefrigerantKg"
                    inputMode="decimal"
                    value={scrapForm.recoveredRefrigerantKg}
                    onChange={handleScrapChange}
                  />
                </label>
                <label className={fieldClassName}>
                  <span>Skrotningsintyg <RequiredMark /></span>
                <input
                    className={formControlClassName}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    type="file"
                    onChange={handleScrapFileChange}
                    required
                  />
                </label>
              </>
            )}
            {(eventForm.type === "ARCHIVE" || eventForm.type === "SCRAP") && (
              <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-700"
                  type="checkbox"
                  checked={lifecycleConfirmed}
                  onChange={(event) => setLifecycleConfirmed(event.target.checked)}
                  required
                />
                <span>
                  Jag bekräftar att aggregatet ska{" "}
                  {eventForm.type === "ARCHIVE" ? "arkiveras" : "skrotas"} och att
                  åtgärden sparas i historiken.
                </span>
              </label>
            )}
            {eventCertificationWarning &&
              eventForm.type !== "ARCHIVE" &&
              eventForm.type !== "SCRAP" && (
              <CertificationWarningBox message={eventCertificationWarning} />
            )}
            {eventError && <p className="text-sm font-semibold text-red-700">{eventError}</p>}
            {archiveError && <p className="text-sm font-semibold text-red-700">{archiveError}</p>}
            {scrapError && <p className="text-sm font-semibold text-red-700">{scrapError}</p>}
            <div className="grid gap-2 pt-2 sm:flex sm:flex-wrap">
              <button
                className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                type="submit"
                disabled={isSubmittingEvent || isArchiving || isScrapping}
              >
                {eventForm.type === "ARCHIVE"
                  ? isArchiving
                    ? "Arkiverar..."
                    : "Arkivera aggregat"
                  : eventForm.type === "SCRAP"
                    ? isScrapping
                      ? "Skrotar..."
                      : "Skrota aggregat"
                    : isSubmittingEvent
                      ? "Sparar..."
                      : "Lägg till händelse"}
              </button>
              <button
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                type="button"
                onClick={closeEventModal}
                disabled={isSubmittingEvent || isArchiving || isScrapping}
              >
                Avbryt
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {isDocumentModalOpen && canManageActiveInstallation && (
        <ModalFrame title="Ladda upp dokument" onClose={closeDocumentModal} closeDisabled={isUploadingDocument}>
          <form className="grid gap-3" onSubmit={handleDocumentSubmit}>
            <label className={fieldClassName}>
              Fil
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
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={isUploadingDocument}>
                {isUploadingDocument ? "Laddar upp..." : "Ladda upp dokument"}
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                type="button"
                onClick={closeDocumentModal}
                disabled={isUploadingDocument}
              >
                Avbryt
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {isPermanentDeleteModalOpen && canPermanentlyDelete && (
        <ModalFrame
          title="Ta bort aggregat permanent"
          description="Permanent borttagning kan inte ångras."
          onClose={closePermanentDeleteModal}
          closeDisabled={isPermanentlyDeleting}
        >
          <form className="grid gap-4" onSubmit={handlePermanentDelete}>
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950">
              <p className="font-semibold">
                Använd bara permanent borttagning för felregistreringar.
              </p>
              <p className="mt-1">
                Arkivering och skrotning är de normala livscykelåtgärderna och
                sparar aggregatets historik. Permanent borttagning raderar
                aggregatet och kan inte ångras.
              </p>
            </div>
            <label className={fieldClassName}>
              Skriv {permanentDeleteLabel} för att bekräfta
              <input
                className={formControlClassName}
                value={permanentDeleteConfirmation}
                onChange={(event) =>
                  setPermanentDeleteConfirmation(event.target.value)
                }
              />
            </label>
            {permanentDeleteError && (
              <p className="text-sm font-semibold text-red-700">
                {permanentDeleteError}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
                type="submit"
                disabled={
                  isPermanentlyDeleting ||
                  permanentDeleteConfirmation.trim().length === 0
                }
              >
                {isPermanentlyDeleting ? "Tar bort..." : "Ta bort permanent"}
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                type="button"
                onClick={closePermanentDeleteModal}
                disabled={isPermanentlyDeleting}
              >
                Avbryt
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

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

function HistoryToggleButton({
  isExpanded,
  itemCount,
  limit,
  onClick,
}: {
  isExpanded: boolean
  itemCount: number
  limit: number
  onClick: () => void
}) {
  if (itemCount <= limit) return null

  return (
    <div className="mt-4 flex justify-center">
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        type="button"
        onClick={onClick}
      >
        {isExpanded ? "Visa mindre" : `Visa mer (${itemCount - limit})`}
      </button>
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

function ServicepartnerDetailItem({
  contractor,
}: {
  contractor: NonNullable<InstallationDetail["assignedContractor"]>
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-600">Servicekontakt</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 font-semibold text-slate-950">
        <span>{formatAssignedContractor(contractor)}</span>
        <CertificationBadge status={contractor.certificationStatus} />
      </dd>
    </div>
  )
}

function formatContractorOption(contractor: Contractor) {
  return contractor.servicePartnerCompany?.name
    ? `${contractor.name} - ${contractor.servicePartnerCompany.name}`
    : contractor.name
}

function deriveServicePartnerCompanies(
  contractors: Contractor[],
  companies: ServicePartnerCompanySummary[],
  currentCompany?: ServicePartnerCompanySummary | null
) {
  const options = new Map<string, ServicePartnerCompanySummary>()

  companies.forEach((company) => options.set(company.id, company))
  contractors.forEach((contractor) => {
    if (contractor.servicePartnerCompany) {
      options.set(contractor.servicePartnerCompany.id, contractor.servicePartnerCompany)
    }
  })
  if (currentCompany) options.set(currentCompany.id, currentCompany)

  return Array.from(options.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function formatAssignedContractor(
  contractor?: {
    name: string
    email: string
    servicePartnerCompany?: ServicePartnerCompanySummary | null
  } | null
) {
  if (!contractor) return null

  const contactName = contractor.name || contractor.email
  return contractor.servicePartnerCompany?.name
    ? `${contractor.servicePartnerCompany.name} (${contactName})`
    : contactName
}

function ActionButton({
  disabled = false,
  label,
  onClick,
  primary = false,
  tone = "neutral",
}: {
  disabled?: boolean
  label: string
  onClick: () => void
  primary?: boolean
  tone?: "neutral" | "warning" | "danger"
}) {
  const toneClass = primary
    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
    : tone === "warning"
      ? "border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
      : tone === "danger"
        ? "border-red-300 bg-white text-red-700 hover:bg-red-50"
        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"

  return (
    <button
      className={`min-h-11 w-full rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${toneClass}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function ModalFrame({
  children,
  closeDisabled = false,
  description,
  onClose,
  title,
}: {
  children: React.ReactNode
  closeDisabled?: boolean
  description?: string
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-3 py-3 sm:items-center sm:px-4 sm:py-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          <button
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
          >
            Stäng
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

function RiskBadge({
  level,
  reasons = [],
}: {
  level: InstallationRiskLevel
  reasons?: string[]
}) {
  const tooltipId = `risk-tooltip-${level.toLowerCase()}`

  return (
    <span className="group relative inline-flex items-center gap-1">
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${RISK_TONE[level]}`}>
        {RISK_LABELS[level] ?? "Risk saknas"}
      </span>
      {reasons.length > 0 && (
        <>
          <span
            aria-describedby={tooltipId}
            aria-label="Visa riskförklaring"
            className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600"
            tabIndex={0}
          >
            i
          </span>
          <span
            className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-700 shadow-lg group-focus-within:block group-hover:block"
            id={tooltipId}
            role="tooltip"
          >
            <span className="font-semibold text-slate-900">
              Riskklassningen påverkas av:
            </span>
            <span className="mt-2 block space-y-1">
              {reasons.map((reason) => (
                <span className="block" key={reason}>
                  {reason}
                </span>
              ))}
            </span>
          </span>
        </>
      )}
    </span>
  )
}

function RefrigerantRegulatoryBadge({
  status,
}: {
  status: ReturnType<typeof getRefrigerantRegulatoryStatus>
}) {
  if (status.status === "OK") return null

  return (
    <span className="group relative inline-flex items-center gap-1">
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${REGULATORY_STATUS_TONE[status.status]}`}>
        {status.shortLabel}
      </span>
      <span
        aria-label="Visa köldmediestatus"
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600"
        tabIndex={0}
      >
        i
      </span>
      <span
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-80 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-700 shadow-lg group-focus-within:block group-hover:block"
        role="tooltip"
      >
        <span className="font-semibold text-slate-900">{status.label}</span>
        <span className="mt-1 block">{status.description}</span>
        {status.gwp !== null && (
          <span className="mt-2 block text-slate-500">GWP: {status.gwp}</span>
        )}
      </span>
    </span>
  )
}

function CertificationBadge({ status }: { status: CertificationStatusResult }) {
  return <Badge variant={status.variant}>{status.label}</Badge>
}

function ScrappedBadge() {
  return <Badge variant="neutral">Skrotad</Badge>
}

function ArchivedBadge() {
  return <Badge variant="neutral">Arkiverad</Badge>
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

function RequiredMark() {
  return <span aria-hidden="true" className="text-xs text-red-500">*</span>
}

function buildEventNotes(form: EventFormData) {
  const details: string[] = []
  const freeText = form.notes.trim()

  if (form.type === "INSPECTION") {
    details.push(`Resultat: ${getOptionLabel(INSPECTION_RESULT_OPTIONS, form.inspectionResult)}.`)
  }

  if (form.type === "LEAK") {
    details.push(`Upptäckt via: ${getOptionLabel(LEAK_SOURCE_OPTIONS, form.leakSource)}.`)
    details.push(
      `Åtgärdat: ${getOptionLabel(LEAK_REPAIRED_OPTIONS, form.leakRepairedStatus)}.`
    )
  }

  if (form.type === "REFILL") {
    const refrigerant = form.refillRefrigerantType.trim()
    if (refrigerant) details.push(`Köldmedium: ${refrigerant}.`)
    details.push(`Orsak: ${getOptionLabel(REFILL_REASON_OPTIONS, form.refillReason)}.`)
  }

  if (form.type === "SERVICE") {
    const performedAction = form.performedAction.trim()
    if (performedAction) details.push(`Utförd åtgärd: ${performedAction}.`)
  }

  if (form.type === "RECOVERY") {
    details.push(`Orsak: ${getOptionLabel(RECOVERY_REASON_OPTIONS, form.recoveryReason)}.`)
    const handledBy = form.recoveryHandledBy.trim()
    if (handledBy) details.push(`Omhändertaget av: ${handledBy}.`)
  }

  if (freeText) details.push(freeText)

  return details.join(" ").trim()
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function getOptionValue(
  options: Array<{ value: string; label: string }>,
  label: string | null
) {
  if (!label) return null

  return options.find((option) => option.label.toLowerCase() === label.toLowerCase())?.value ?? null
}

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${COMPLIANCE_TONE[status]}`}>
      {COMPLIANCE_LABELS[status]}
    </span>
  )
}

function EventTimelineItem({
  canCorrect = false,
  event,
  documentCount,
  onCorrect,
}: {
  canCorrect?: boolean
  event: InstallationEvent
  documentCount: number
  onCorrect?: (event: InstallationEvent) => void
}) {
  const structuredDetails = formatEventStructuredDetails(event)
  const isSuperseded = Boolean(event.supersededAt)

  return (
    <article
      className={`rounded-lg border p-4 ${
        isSuperseded ? "border-slate-200 bg-slate-50 text-slate-500" : EVENT_TONE[event.type]
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span>{formatDate(event.date)}</span>
            {isSuperseded && (
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                Ersatt
              </span>
            )}
          </div>
          <h3 className={`mt-1 text-base font-bold ${isSuperseded ? "line-through" : ""}`}>
            {EVENT_LABELS[event.type]}
          </h3>
        </div>
        {!isSuperseded &&
          structuredDetails.length === 0 &&
          event.refrigerantAddedKg !== null &&
          event.refrigerantAddedKg !== undefined && (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
            {getInstallationEventAmountLabel(event.type) ?? "Mängd"}:{" "}
            {formatNumber(event.refrigerantAddedKg)} kg
          </span>
        )}
        {canCorrect && !isSuperseded && onCorrect && (
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => onCorrect(event)}
          >
            Korrigera
          </button>
        )}
      </div>
      {structuredDetails.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          {structuredDetails.map((detail) => (
            <span key={detail} className="rounded-full bg-white/80 px-3 py-1">
              {detail}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm">{event.notes || "Ingen anteckning"}</p>
      {isSuperseded && (
        <p className="mt-2 text-xs font-semibold text-slate-600">
          Denna händelse är ersatt och används inte i beräkningar.
          {event.supersededReason ? ` Orsak: ${event.supersededReason}.` : ""}
        </p>
      )}
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

function formatEventStructuredDetails(event: InstallationEvent) {
  const details: string[] = []
  const noteDetails = parseEventNoteDetails(event.notes)

  if (event.type === "INSPECTION" && noteDetails.result) {
    details.push(`Resultat: ${noteDetails.result}`)
  }

  if (event.type === "LEAK") {
    if (event.refrigerantAddedKg != null) {
      details.push(`Läckagemängd: ${formatNumber(event.refrigerantAddedKg)} kg`)
    }
    if (noteDetails.source) details.push(`Upptäckt via ${noteDetails.source.toLowerCase()}`)
    if (noteDetails.repaired) details.push(`Åtgärdat: ${noteDetails.repaired}`)
  }

  if (event.type === "REFILL") {
    if (event.refrigerantAddedKg != null) {
      details.push(
        `Påfyllt: ${formatNumber(event.refrigerantAddedKg)} kg${
          noteDetails.refrigerant ? ` ${noteDetails.refrigerant}` : ""
        }`
      )
    }
    if (noteDetails.reason) details.push(`Orsak: ${noteDetails.reason}`)
  }

  if ((event.type === "SERVICE" || event.type === "REPAIR") && noteDetails.action) {
    details.push(`Åtgärd: ${noteDetails.action}`)
  }

  if (event.type === "REFRIGERANT_CHANGE") {
    if (event.previousRefrigerantType && event.newRefrigerantType) {
      details.push(`${event.previousRefrigerantType} → ${event.newRefrigerantType}`)
    }
    if (event.previousAmountKg != null && event.newAmountKg != null) {
      details.push(
        `${formatNumber(event.previousAmountKg)} kg → ${formatNumber(event.newAmountKg)} kg`
      )
    }
    if (event.recoveredAmountKg != null) {
      details.push(`Omhändertagen mängd: ${formatNumber(event.recoveredAmountKg)} kg`)
    }
  }

  if (event.type === "RECOVERY" && event.recoveredAmountKg != null) {
    details.push(`Omhändertagen mängd: ${formatNumber(event.recoveredAmountKg)} kg`)
  }
  if (event.type === "RECOVERY") {
    if (noteDetails.reason) details.push(`Orsak: ${noteDetails.reason}`)
    if (noteDetails.handledBy) details.push(`Omhändertaget av: ${noteDetails.handledBy}`)
  }

  return details
}

function parseEventNoteDetails(notes?: string | null) {
  return {
    action: matchNoteValue(notes, "Utförd åtgärd"),
    handledBy: matchNoteValue(notes, "Omhändertaget av"),
    reason: matchNoteValue(notes, "Orsak"),
    refrigerant: matchNoteValue(notes, "Köldmedium"),
    repaired: matchNoteValue(notes, "Åtgärdat"),
    result: matchNoteValue(notes, "Resultat"),
    source: matchNoteValue(notes, "Upptäckt via"),
  }
}

function matchNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = notes.match(new RegExp(`${escapedLabel}:\\s*([^\\.]+)\\.`))
  return match?.[1]?.trim() || null
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

function formatKnownDate(value?: string | null) {
  return value ? formatDate(value) : "Okänt"
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
  if (isAdminRole(currentUser.role)) return true

  return document.uploadedById === currentUser.userId
}

function compareEventsByDateDesc(first: InstallationEvent, second: InstallationEvent) {
  return new Date(second.date).getTime() - new Date(first.date).getTime()
}

function isInstallationEventType(type: EventFormType): type is InstallationEventType {
  return type !== "ARCHIVE" && type !== "SCRAP"
}

function calculateInspectionPreview(
  refrigerantType: string,
  refrigerantAmount: string,
  hasLeakDetectionSystem: boolean
) {
  const amount = parseFloat(refrigerantAmount)

  if (!refrigerantType || !Number.isFinite(amount)) {
    return {
      ...calculateInspectionObligation(null, hasLeakDetectionSystem),
      co2eTon: null,
      gwpWarning: null,
    }
  }

  const { co2eTon, warning } = calculateCO2e(refrigerantType, amount)

  return {
    ...calculateInspectionObligation(co2eTon, hasLeakDetectionSystem),
    co2eTon,
    gwpWarning: warning,
  }
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

function toDateInputValue(value?: string | null) {
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
