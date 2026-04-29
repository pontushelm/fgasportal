"use client"

import Link from "next/link"
import { useState } from "react"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import type { InspectionReminderStatus } from "@/lib/inspection-reminders"

type InstallationFormData = {
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
  installationDate: string
  lastInspection: string
  inspectionIntervalMonths: string
  notes: string
}

type CreatedInstallation = {
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
  inspectionIntervalMonths?: number | null
  nextInspection?: string | null
  gwp: number
  co2eTon: number
  baseInspectionInterval: number | null
  inspectionInterval: number | null
  hasAdjustedInspectionInterval: boolean
  complianceStatus: ComplianceStatus
  inspectionReminderStatus: InspectionReminderStatus | null
  daysUntilDue: number | null
  notes?: string | null
}

const initialFormData: InstallationFormData = {
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
  installationDate: "",
  lastInspection: "",
  inspectionIntervalMonths: "",
  notes: "",
}

export default function CreateInstallationForm({
  onInstallationCreated,
}: {
  onInstallationCreated: (installation: CreatedInstallation) => void
}) {
  const [formData, setFormData] = useState<InstallationFormData>(initialFormData)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const value = e.target instanceof HTMLInputElement && e.target.type === "checkbox"
      ? e.target.checked
      : e.target.value

    setFormData({
      ...formData,
      [e.target.name]: value,
    })
  }

  const previewNextInspection = calculateNextInspectionPreview(
    formData.lastInspection,
    formData.inspectionIntervalMonths
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    const res = await fetch("/api/installations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(formData),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error || "Kunde inte skapa installation")
      setIsSubmitting(false)
      return
    }

    onInstallationCreated(result)
    setFormData(initialFormData)
    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2>Lägg till aggregat</h2>

      <input name="name" placeholder="Namn" value={formData.name} onChange={handleChange} required />
      <input name="location" placeholder="Plats" value={formData.location} onChange={handleChange} required />
      <input name="propertyName" placeholder="Fastighet" value={formData.propertyName} onChange={handleChange} />
      <input name="equipmentId" placeholder="Utrustnings-ID" value={formData.equipmentId} onChange={handleChange} />
      <input name="serialNumber" placeholder="Serienummer" value={formData.serialNumber} onChange={handleChange} />
      <input name="equipmentType" placeholder="Utrustningstyp" value={formData.equipmentType} onChange={handleChange} />
      <input name="operatorName" placeholder="Operatör" value={formData.operatorName} onChange={handleChange} />
      <input name="refrigerantType" placeholder="Köldmedium, t.ex. R410A" value={formData.refrigerantType} onChange={handleChange} required />
      <input name="refrigerantAmount" placeholder="Mängd kg" value={formData.refrigerantAmount} onChange={handleChange} required />
      <label>
        <input
          name="hasLeakDetectionSystem"
          type="checkbox"
          checked={formData.hasLeakDetectionSystem}
          onChange={handleChange}
        />
        Läckagevarningssystem
      </label>
      <input name="installationDate" type="date" value={formData.installationDate} onChange={handleChange} required />
      <label>
        Senaste kontroll
        <input name="lastInspection" type="date" value={formData.lastInspection} onChange={handleChange} />
      </label>
      <label>
        Kontrollintervall
        <select name="inspectionIntervalMonths" value={formData.inspectionIntervalMonths} onChange={handleChange}>
          <option value="">Välj intervall</option>
          <option value="3">3 månader</option>
          <option value="6">6 månader</option>
          <option value="12">12 månader</option>
        </select>
      </label>
      {previewNextInspection && (
        <p>Nästa kontroll: {previewNextInspection}</p>
      )}
      <textarea name="notes" placeholder="Anteckningar" value={formData.notes} onChange={handleChange} />

      {error && <p>{error}</p>}

      <div style={actionsStyle}>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sparar..." : "Spara aggregat"}
        </button>
        <Link href="/dashboard/installations/import" style={secondaryButtonStyle}>
          Import Excel
        </Link>
      </div>
    </form>
  )
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
}

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
}

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #171717",
  borderRadius: 6,
  padding: "7px 10px",
  color: "#171717",
  textDecoration: "none",
  fontWeight: 600,
}

function calculateNextInspectionPreview(
  lastInspection: string,
  inspectionIntervalMonths: string
) {
  if (!lastInspection || !inspectionIntervalMonths) return null

  const nextInspection = calculateNextInspectionDate(
    lastInspection,
    parseInt(inspectionIntervalMonths, 10)
  )

  return nextInspection
    ? new Intl.DateTimeFormat("sv-SE").format(nextInspection)
    : null
}
