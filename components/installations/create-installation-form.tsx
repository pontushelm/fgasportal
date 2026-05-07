"use client"

import { useEffect, useState } from "react"
import {
  calculateCO2e,
  calculateInspectionObligation,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import type { InspectionReminderStatus } from "@/lib/inspection-reminders"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"

type InstallationFormData = {
  name: string
  location: string
  propertyId: string
  equipmentId: string
  serialNumber: string
  equipmentType: string
  operatorName: string
  refrigerantType: string
  refrigerantAmount: string
  hasLeakDetectionSystem: boolean
  installationDate: string
  lastInspection: string
  notes: string
}

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
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
  gwp: number | null
  co2eTon: number | null
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
  propertyId: "",
  equipmentId: "",
  serialNumber: "",
  equipmentType: "",
  operatorName: "",
  refrigerantType: "",
  refrigerantAmount: "",
  hasLeakDetectionSystem: false,
  installationDate: "",
  lastInspection: "",
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
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchProperties() {
      const res = await fetch("/api/properties", {
        credentials: "include",
      })

      if (!isMounted || !res.ok) return

      const data: PropertyOption[] = await res.json()
      setProperties(data)
    }

    void fetchProperties()

    return () => {
      isMounted = false
    }
  }, [])

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

  const inspectionPreview = calculateInspectionPreview(
    formData.refrigerantType,
    formData.refrigerantAmount,
    formData.hasLeakDetectionSystem
  )
  const previewNextInspection = calculateNextInspectionPreview(
    formData.lastInspection,
    inspectionPreview.intervalMonths
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
      setError(result.error || "Kunde inte skapa aggregat")
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

      <p className="text-xs text-slate-500">* Obligatoriskt</p>

      <label className={labelClassName}>
        <span>Namn <RequiredMark /></span>
        <input className={inputClassName} name="name" placeholder="Namn" value={formData.name} onChange={handleChange} required />
      </label>

      <label className={labelClassName}>
        <span>Plats <RequiredMark /></span>
        <input className={inputClassName} name="location" placeholder="Plats" value={formData.location} onChange={handleChange} required />
      </label>

      <label className={labelClassName}>
        <span>Fastighet <RequiredMark /></span>
        <select className={inputClassName} name="propertyId" value={formData.propertyId} onChange={handleChange} required>
          <option value="">Välj fastighet</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}{property.municipality ? `, ${property.municipality}` : ""}
            </option>
          ))}
        </select>
      </label>
      <input className={inputClassName} name="equipmentId" placeholder="Utrustnings-ID" value={formData.equipmentId} onChange={handleChange} />
      <input className={inputClassName} name="serialNumber" placeholder="Serienummer" value={formData.serialNumber} onChange={handleChange} />
      <input className={inputClassName} name="equipmentType" placeholder="Utrustningstyp" value={formData.equipmentType} onChange={handleChange} />
      <input className={inputClassName} name="operatorName" placeholder="Operatör" value={formData.operatorName} onChange={handleChange} />

      <label className={labelClassName}>
        <span>Köldmedium <RequiredMark /></span>
        <input className={inputClassName} name="refrigerantType" placeholder="Köldmedium, t.ex. R410A" value={formData.refrigerantType} onChange={handleChange} required />
      </label>

      <label className={labelClassName}>
        <span>Mängd kg <RequiredMark /></span>
        <input className={inputClassName} name="refrigerantAmount" placeholder="Mängd kg" value={formData.refrigerantAmount} onChange={handleChange} required />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
          name="hasLeakDetectionSystem"
          type="checkbox"
          checked={formData.hasLeakDetectionSystem}
          onChange={handleChange}
        />
        <span>
          Läckagevarningssystem finns
          <span className="block text-xs font-normal text-slate-500">
            Kan påverka lagstadgat kontrollintervall.
          </span>
        </span>
      </label>

      <label className={labelClassName}>
        <span>Driftsättningsdatum <RequiredMark /></span>
        <input className={inputClassName} name="installationDate" type="date" value={formData.installationDate} onChange={handleChange} required />
      </label>

      <label className={labelClassName}>
        Senaste kontroll
        <input className={inputClassName} name="lastInspection" type="date" value={formData.lastInspection} onChange={handleChange} />
      </label>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">Kontrollplikt</p>
        <p className="mt-1 text-slate-700">{inspectionPreview.label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {inspectionPreview.explanation}
        </p>
        {inspectionPreview.co2eTon != null && (
          <p className="mt-2 text-xs font-medium text-slate-600">
            Beräknad CO₂e: {formatNumber(inspectionPreview.co2eTon)} ton
          </p>
        )}
      </div>

      {inspectionPreview.gwpWarning && (
        <p className="text-sm font-semibold text-amber-700">
          {inspectionPreview.gwpWarning}
        </p>
      )}

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
      </div>
    </form>
  )
}

function RequiredMark() {
  return <span aria-hidden="true" className="text-xs text-red-500">*</span>
}

function calculateNextInspectionPreview(
  lastInspection: string,
  inspectionIntervalMonths: number | null
) {
  if (!lastInspection || !inspectionIntervalMonths) return null

  const nextInspection = calculateNextInspectionDate(
    lastInspection,
    inspectionIntervalMonths
  )

  return nextInspection
    ? new Intl.DateTimeFormat("sv-SE").format(nextInspection)
    : null
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
