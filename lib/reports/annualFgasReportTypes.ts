export type AnnualFgasReportFilter = {
  companyId: string
  year: number
  municipality?: string
  propertyId?: string
  assignedContractorId?: string
  signingMetadata?: AnnualFgasSigningMetadata | null
}

export type AnnualFgasReportData = {
  reportYear: number
  generatedAt: Date
  period: {
    startDate: Date
    endDate: Date
  }
  operator: {
    name: string
    organizationNumber: string | null
    postalAddress: string | null
    billingAddress: string | null
    contactPerson: string | null
    contactEmail: string | null
    contactPhone: string | null
  }
  facility: {
    name: string
    address: string | null
    municipality: string | null
    propertyDesignation: string | null
  }
  responsibleContractor: {
    name: string | null
    company: string | null
    email: string | null
    phone: string | null
    certificateNumber: string | null
  }
  signingMetadata: AnnualFgasSigningMetadata | null
  certificateRegister: AnnualFgasCertificateEntry[]
  summary: {
    equipmentCount: number
    controlRequiredCount: number
    unknownCo2eEquipmentCount: number
    totalRefrigerantKg: number
    totalCo2eKg: number | null
    knownCo2eKg: number
    leakageCount: number
    addedRefrigerantKg: number
    recoveredRefrigerantKg: number
    regeneratedReusedRefrigerantKg: number | null
    scrappedEquipmentCount: number
  }
  qualitySummary: AnnualFgasReportQualitySummary
  warnings: AnnualFgasReportWarning[]
  equipment: AnnualFgasEquipmentRow[]
  leakageControls: AnnualFgasLeakageControlRow[]
  refrigerantHandlingLog: AnnualFgasRefrigerantHandlingRow[]
  scrappedEquipment: AnnualFgasScrappedEquipmentRow[]
  notes: string[]
}

export type AnnualFgasSigningMetadata = {
  signerName: string
  signerRole: string
  signingDate: Date
  comment: string | null
  attestationText: string
}

export type AnnualFgasReportReadinessStatus =
  | "READY"
  | "HAS_WARNINGS"
  | "MISSING_REQUIRED_DATA"

export type AnnualFgasReportWarningSeverity = "blocking" | "review"

export type AnnualFgasReportQualitySummary = {
  status: AnnualFgasReportReadinessStatus
  blockingIssueCount: number
  warningCount: number
  totalIssueCount: number
}

export type AnnualFgasCertificateEntry = {
  name: string
  role: string
  company: string | null
  certificateNumber: string | null
  certificateOrganization: string | null
  validUntil: Date | null
}

export type AnnualFgasEquipmentRow = {
  id: string
  equipmentId: string | null
  name: string
  location: string | null
  propertyName: string | null
  equipmentType: string | null
  refrigerantType: string
  refrigerantAmountKg: number
  co2eKg: number | null
  controlRequired: boolean
  inspectionIntervalMonths: number | null
  leakDetectionSystem: boolean
  installedAt: Date | null
  lastInspectionAt: Date | null
  nextInspectionAt: Date | null
  status: "active" | "archived" | "scrapped"
}

export type AnnualFgasLeakageControlRow = {
  id: string
  date: Date
  equipmentName: string
  equipmentId: string | null
  inspectorName: string
  result: string
  nextDueDate: Date | null
  notes: string | null
}

export type AnnualFgasRefrigerantHandlingRow = {
  id: string
  date: Date
  equipmentName: string
  equipmentId: string | null
  refrigerantType: string
  eventType: string
  previousRefrigerantType: string | null
  newRefrigerantType: string | null
  addedKg: number | null
  recoveredKg: number | null
  regeneratedReusedKg: number | null
  notes: string | null
}

export type AnnualFgasReportWarning = {
  id: string
  severity: AnnualFgasReportWarningSeverity
  message: string
  equipmentName?: string | null
  equipmentId?: string | null
}

export type AnnualFgasScrappedEquipmentRow = {
  id: string
  scrappedAt: Date
  equipmentName: string
  equipmentId: string | null
  refrigerantType: string
  refrigerantAmountKg: number
  recoveredKg: number | null
  servicePartnerName: string | null
  certificateFileName: string | null
  notes: string | null
}
