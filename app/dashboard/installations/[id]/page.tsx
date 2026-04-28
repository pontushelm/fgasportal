"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import type { UserRole } from "@/lib/auth"

type Inspection = {
  id: string
  inspectionDate: string
  inspectorName: string
  status?: string | null
  notes?: string | null
  findings?: string | null
  nextDueDate?: string | null
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
  notes: string
}

const initialInspectionFormData: InspectionFormData = {
  inspectionDate: "",
  inspectorName: "",
  status: "",
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
  notes: "",
}

export default function InstallationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [installation, setInstallation] = useState<InstallationDetail | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [inspectionForm, setInspectionForm] = useState<InspectionFormData>(
    initialInspectionFormData
  )
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      const [installationRes, userRes] = await Promise.all([
        fetch(`/api/installations/${params.id}`, {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (installationRes.status === 401 || userRes.status === 401) {
        router.push("/login")
        return
      }

      if (installationRes.status === 404) {
        if (!isMounted) return
        setError("Installationen hittades inte")
        setIsLoading(false)
        return
      }

      if (!installationRes.ok || !userRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta installationen")
        setIsLoading(false)
        return
      }

      const data: InstallationDetail = await installationRes.json()
      const userData: CurrentUser = await userRes.json()

      if (!isMounted) return

      setInstallation(data)
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

  function handleEditChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const value = event.target instanceof HTMLInputElement && event.target.type === "checkbox"
      ? event.target.checked
      : event.target.value

    setEditForm({
      ...editForm,
      [event.target.name]: value,
    })
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

  if (isLoading) {
    return (
      <main style={pageStyle}>
        <Link href="/dashboard">Tillbaka till dashboard</Link>
        <p>Laddar...</p>
      </main>
    )
  }

  if (error || !installation) {
    return (
      <main style={pageStyle}>
        <Link href="/dashboard">Tillbaka till dashboard</Link>
        <h1>Installation</h1>
        <p>{error || "Installationen hittades inte"}</p>
      </main>
    )
  }

  const compliance = calculateInstallationCompliance(
    installation.refrigerantType,
    installation.refrigerantAmount,
    installation.hasLeakDetectionSystem
  )
  const canManage = currentUser?.role === "ADMIN"

  return (
    <main style={pageStyle}>
      <Link href="/dashboard">Tillbaka till dashboard</Link>

      <h1>{installation.name}</h1>
      <p>{installation.location}</p>

      <section style={sectionStyle}>
        <h2>Installationsdetaljer</h2>
        <dl style={detailsGridStyle}>
          <DetailItem label="Fastighet" value={formatOptionalText(installation.propertyName)} />
          <DetailItem label="Utrustnings-ID" value={formatOptionalText(installation.equipmentId)} />
          <DetailItem label="Serienummer" value={formatOptionalText(installation.serialNumber)} />
          <DetailItem label="Utrustningstyp" value={formatOptionalText(installation.equipmentType)} />
          <DetailItem label="Operatör" value={formatOptionalText(installation.operatorName)} />
          <DetailItem label="Köldmedium" value={installation.refrigerantType} />
          <DetailItem label="Mängd" value={`${installation.refrigerantAmount} kg`} />
          <DetailItem
            label="Läckagevarningssystem"
            value={installation.hasLeakDetectionSystem ? "Ja" : "Nej"}
          />
          <DetailItem label="GWP" value={compliance.gwp.toString()} />
          <DetailItem label="CO₂e" value={`${compliance.co2eTon.toFixed(2)} ton`} />
          <DetailItem
            label="Kontrollintervall"
            value={formatInspectionInterval(compliance)}
          />
          <DetailItem
            label="Installationsdatum"
            value={formatDate(installation.installationDate)}
          />
          <DetailItem
            label="Senaste kontroll"
            value={formatOptionalDate(installation.lastInspection)}
          />
          <DetailItem
            label="Nästa kontroll"
            value={formatOptionalDate(installation.nextInspection)}
          />
        </dl>

        {installation.notes && (
          <div style={{ marginTop: 20 }}>
            <h3>Anteckningar</h3>
            <p>{installation.notes}</p>
          </div>
        )}
      </section>

      {canManage && (
        <section style={sectionStyle}>
          <h2>Redigera installation</h2>

          {!isEditing ? (
            <button type="button" onClick={() => setIsEditing(true)}>
              Redigera
            </button>
          ) : (
            <form onSubmit={handleEditSubmit} style={formStyle}>
              <label style={fieldStyle}>
                Namn
                <input
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label style={fieldStyle}>
                Plats
                <input
                  name="location"
                  value={editForm.location}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label style={fieldStyle}>
                Fastighet
                <input
                  name="propertyName"
                  value={editForm.propertyName}
                  onChange={handleEditChange}
                />
              </label>

              <label style={fieldStyle}>
                Utrustnings-ID
                <input
                  name="equipmentId"
                  value={editForm.equipmentId}
                  onChange={handleEditChange}
                />
              </label>

              <label style={fieldStyle}>
                Serienummer
                <input
                  name="serialNumber"
                  value={editForm.serialNumber}
                  onChange={handleEditChange}
                />
              </label>

              <label style={fieldStyle}>
                Utrustningstyp
                <input
                  name="equipmentType"
                  value={editForm.equipmentType}
                  onChange={handleEditChange}
                />
              </label>

              <label style={fieldStyle}>
                Operatör
                <input
                  name="operatorName"
                  value={editForm.operatorName}
                  onChange={handleEditChange}
                />
              </label>

              <label style={fieldStyle}>
                Köldmedium
                <input
                  name="refrigerantType"
                  value={editForm.refrigerantType}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label style={fieldStyle}>
                Mängd kg
                <input
                  name="refrigerantAmount"
                  value={editForm.refrigerantAmount}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label>
                <input
                  name="hasLeakDetectionSystem"
                  type="checkbox"
                  checked={editForm.hasLeakDetectionSystem}
                  onChange={handleEditChange}
                />
                Läckagevarningssystem
              </label>

              <label style={fieldStyle}>
                Anteckningar
                <textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditChange}
                />
              </label>

              {editError && <p style={{ color: "#b91c1c" }}>{editError}</p>}
              {editSuccess && <p style={{ color: "#047857" }}>{editSuccess}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={isSavingEdit}>
                  {isSavingEdit ? "Sparar..." : "Spara ändringar"}
                </button>
                <button
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
            <p style={{ color: "#047857" }}>{editSuccess}</p>
          )}

          <div style={{ marginTop: 24 }}>
            {archiveError && <p style={{ color: "#b91c1c" }}>{archiveError}</p>}
            <button
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
        <section style={sectionStyle}>
          <h2>Registrera kontroll</h2>

          <form onSubmit={handleInspectionSubmit} style={formStyle}>
          <label style={fieldStyle}>
            Datum
            <input
              name="inspectionDate"
              type="date"
              value={inspectionForm.inspectionDate}
              onChange={handleInspectionChange}
              required
            />
          </label>

          <label style={fieldStyle}>
            Kontrollant
            <input
              name="inspectorName"
              value={inspectionForm.inspectorName}
              onChange={handleInspectionChange}
              required
            />
          </label>

          <label style={fieldStyle}>
            Resultat
            <select
              name="status"
              value={inspectionForm.status}
              onChange={handleInspectionChange}
              required
            >
              <option value="">Välj resultat</option>
              <option value="Godkänd">Godkänd</option>
              <option value="Åtgärd krävs">Åtgärd krävs</option>
              <option value="Ej godkänd">Ej godkänd</option>
            </select>
          </label>

          <label style={fieldStyle}>
            Noteringar
            <textarea
              name="notes"
              value={inspectionForm.notes}
              onChange={handleInspectionChange}
            />
          </label>

          {submitError && <p style={{ color: "#b91c1c" }}>{submitError}</p>}
          {submitSuccess && <p style={{ color: "#047857" }}>{submitSuccess}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sparar..." : "Spara kontroll"}
          </button>
          </form>
        </section>
      )}

      <section style={sectionStyle}>
        <h2>Kontrollhistorik</h2>

        {installation.inspections.length === 0 ? (
          <p>Inga kontroller registrerade ännu.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={cellStyle}>Datum</th>
                <th style={cellStyle}>Kontrollant</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Nästa kontroll</th>
                <th style={cellStyle}>Noteringar</th>
                <th style={cellStyle}>Äldre fynd</th>
              </tr>
            </thead>
            <tbody>
              {installation.inspections.map((inspection) => (
                <tr key={inspection.id}>
                  <td style={cellStyle}>{formatDate(inspection.inspectionDate)}</td>
                  <td style={cellStyle}>{inspection.inspectorName}</td>
                  <td style={cellStyle}>{inspection.status || "-"}</td>
                  <td style={cellStyle}>{formatOptionalDate(inspection.nextDueDate)}</td>
                  <td style={cellStyle}>{inspection.notes || "-"}</td>
                  <td style={cellStyle}>{inspection.findings || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontWeight: 700 }}>{label}</dt>
      <dd style={{ margin: "4px 0 0" }}>{value}</dd>
    </div>
  )
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

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "60px auto",
  padding: 20,
}

const sectionStyle: React.CSSProperties = {
  marginTop: 32,
}

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  maxWidth: 520,
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 20,
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
}
