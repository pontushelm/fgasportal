"use client"

import Link from "next/link"
import { useState } from "react"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import type { InspectionReminderStatus } from "@/lib/inspection-reminders"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"

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

const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"

const labelClassName = "grid gap-1 text-sm font-medium text-slate-700"

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
    const value =
      e.target instanceof HTMLInputElement && e.target.type === "checkbox"
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
    <form
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-900"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-semibold text-slate-900">Lägg till aggregat</h2>

      <input className={inputClassName} name="name" placeholder="Namn" value={formData.name} onChange={handleChange} required />
      <input className={inputClassName} name="location" placeholder="Plats" value={formData.location} onChange={handleChange} required />
      <input className={inputClassName} name="propertyName" placeholder="Fastighet" value={formData.propertyName} onChange={handleChange} />
      <input className={inputClassName} name="equipmentId" placeholder="Utrustnings-ID" value={formData.equipmentId} onChange={handleChange} />
      <input className={inputClassName} name="serialNumber" placeholder="Serienummer" value={formData.serialNumber} onChange={handleChange} />
      <input className={inputClassName} name="equipmentType" placeholder="Utrustningstyp" value={formData.equipmentType} onChange={handleChange} />
      <input className={inputClassName} name="operatorName" placeholder="Operatör" value={formData.operatorName} onChange={handleChange} />
      <input className={inputClassName} name="refrigerantType" placeholder="Köldmedium, t.ex. R410A" value={formData.refrigerantType} onChange={handleChange} required />
      <input className={inputClassName} name="refrigerantAmount" placeholder="Mängd kg" value={formData.refrigerantAmount} onChange={handleChange} required />

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
          name="hasLeakDetectionSystem"
          type="checkbox"
          checked={formData.hasLeakDetectionSystem}
          onChange={handleChange}
        />
        Läckagevarningssystem
      </label>

      <input className={inputClassName} name="installationDate" type="date" value={formData.installationDate} onChange={handleChange} required />

      <label className={labelClassName}>
        Senaste kontroll
        <input className={inputClassName} name="lastInspection" type="date" value={formData.lastInspection} onChange={handleChange} />
      </label>

      <label className={labelClassName}>
        Kontrollintervall
        <select className={inputClassName} name="inspectionIntervalMonths" value={formData.inspectionIntervalMonths} onChange={handleChange}>
          <option value="">Välj intervall</option>
          <option value="3">3 månader</option>
          <option value="6">6 månader</option>
          <option value="12">12 månader</option>
        </select>
      </label>

      {previewNextInspection && (
        <p className="text-sm font-medium text-slate-700">
          Nästa kontroll: {previewNextInspection}
        </p>
      )}

      <textarea className={inputClassName} name="notes" placeholder="Anteckningar" value={formData.notes} onChange={handleChange} />

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sparar..." : "Spara aggregat"}
        </button>
        <Link
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50"
          href="/dashboard/installations/import"
        >
          Import Excel
        </Link>
      </div>
    </form>
  )
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
