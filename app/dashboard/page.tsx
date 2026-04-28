"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import CreateInstallationForm from "@/components/installations/create-installation-form"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import type { UserRole } from "@/lib/auth"

type Installation = {
  id: string
  name: string
  location: string
  refrigerantType: string
  refrigerantAmount: number
  installationDate: string
  gwp: number
  co2eTon: number
  baseInspectionInterval: number | null
  inspectionInterval: number | null
  hasAdjustedInspectionInterval: boolean
  complianceStatus: ComplianceStatus
  daysUntilDue: number | null
  nextInspection?: string | null
  notes?: string | null
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type ComplianceFilter = "ALL" | ComplianceStatus

const FILTERS: Array<{ label: string; value: ComplianceFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Due soon", value: "DUE_SOON" },
  { label: "Not inspected", value: "NOT_INSPECTED" },
  { label: "OK", value: "OK" },
  { label: "Not required", value: "NOT_REQUIRED" },
]

const STATUS_SORT_ORDER: Record<ComplianceStatus, number> = {
  OVERDUE: 1,
  DUE_SOON: 2,
  NOT_INSPECTED: 3,
  OK: 4,
  NOT_REQUIRED: 5,
}

export default function DashboardPage() {
  const [installations, setInstallations] = useState<Installation[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [activeFilter, setActiveFilter] = useState<ComplianceFilter>("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function fetchDashboardData() {
      const [installationsRes, userRes] = await Promise.all([
        fetch("/api/installations", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (installationsRes.status === 401 || userRes.status === 401) {
        router.push("/login")
        return
      }

      const installationsData: Installation[] = await installationsRes.json()
      const userData: CurrentUser = await userRes.json()

      if (!isMounted) return

      setInstallations(installationsData)
      setCurrentUser(userData)
      setIsLoading(false)
    }

    void fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [router])

  function handleInstallationCreated(installation: Installation) {
    setInstallations((prev) => sortInstallations([installation, ...prev]))
  }

  const summary = {
    total: installations.length,
    overdue: installations.filter((item) => item.complianceStatus === "OVERDUE").length,
    dueSoon: installations.filter((item) => item.complianceStatus === "DUE_SOON").length,
    notInspected: installations.filter((item) => item.complianceStatus === "NOT_INSPECTED").length,
  }
  const canManage = currentUser?.role === "ADMIN"
  const sortedInstallations = sortInstallations(installations)
  const filteredInstallations =
    activeFilter === "ALL"
      ? sortedInstallations
      : sortedInstallations.filter((item) => item.complianceStatus === activeFilter)
  const needsAttentionInstallations = sortedInstallations.filter((item) =>
    ["OVERDUE", "DUE_SOON", "NOT_INSPECTED"].includes(item.complianceStatus)
  )

  return (
    <main style={{ maxWidth: 1100, margin: "60px auto", padding: 20 }}>
      <h1>F-gas Dashboard</h1>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          <Link href="/dashboard/company">Företagsinställningar</Link>
        </div>
      )}

      {canManage && (
        <CreateInstallationForm onInstallationCreated={handleInstallationCreated} />
      )}

      {canManage && (
        <div style={exportActionsStyle}>
          <Link href="/api/installations/export" style={exportButtonStyle}>
            Export CSV
          </Link>
          <Link href="/api/installations/export/pdf" style={exportButtonStyle}>
            Export PDF
          </Link>
        </div>
      )}

      <section style={summaryGridStyle}>
        <SummaryCard label="Totalt antal" value={summary.total} />
        <SummaryCard label="Försenade" value={summary.overdue} />
        <SummaryCard label="Förfaller snart" value={summary.dueSoon} />
        <SummaryCard label="Ej kontrollerade" value={summary.notInspected} />
      </section>

      <section style={sectionStyle}>
        <h2>Needs attention</h2>
        {needsAttentionInstallations.length === 0 ? (
          <p>Inga installationer kräver åtgärd just nu.</p>
        ) : (
          <InstallationTable installations={needsAttentionInstallations} />
        )}
      </section>

      <h2 style={{ marginTop: 40 }}>Registrerade aggregat</h2>

      <div style={filterRowStyle}>
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveFilter(filter.value)}
            style={{
              ...filterButtonStyle,
              ...(activeFilter === filter.value ? activeFilterButtonStyle : {}),
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && <p>Laddar...</p>}

      {installations.length === 0 && !isLoading && (
        <p>Inga aggregat registrerade ännu.</p>
      )}

      {installations.length > 0 && filteredInstallations.length === 0 && (
        <p>Inga installationer matchar filtret.</p>
      )}

      {filteredInstallations.length > 0 && (
        <InstallationTable installations={filteredInstallations} />
      )}
    </main>
  )
}

function InstallationTable({ installations }: { installations: Installation[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
      <thead>
        <tr>
          <th style={cellStyle}>Aggregat</th>
          <th style={cellStyle}>Plats</th>
          <th style={cellStyle}>Köldmedium</th>
          <th style={cellStyle}>Mängd</th>
          <th style={cellStyle}>GWP</th>
          <th style={cellStyle}>CO₂e</th>
          <th style={cellStyle}>Kontrollintervall</th>
          <th style={cellStyle}>Nästa kontroll</th>
          <th style={cellStyle}>Status</th>
        </tr>
      </thead>

      <tbody>
        {installations.map((item) => (
          <tr key={item.id}>
            <td style={cellStyle}>
              <Link href={`/dashboard/installations/${item.id}`}>
                {item.name}
              </Link>
            </td>
            <td style={cellStyle}>{item.location}</td>
            <td style={cellStyle}>{item.refrigerantType}</td>
            <td style={cellStyle}>{item.refrigerantAmount} kg</td>
            <td style={cellStyle}>{item.gwp}</td>
            <td style={cellStyle}>{item.co2eTon.toFixed(2)} ton</td>
            <td style={cellStyle}>{formatInspectionInterval(item)}</td>
            <td style={cellStyle}>{formatOptionalDate(item.nextInspection)}</td>
            <td style={cellStyle}>
              <StatusBadge
                status={item.complianceStatus}
                daysUntilDue={item.daysUntilDue}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ color: "#525252", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function StatusBadge({
  status,
  daysUntilDue,
}: {
  status: ComplianceStatus
  daysUntilDue: number | null
}) {
  const statusConfig: Record<ComplianceStatus, { label: string; color: string }> = {
    OK: { label: "OK", color: "#047857" },
    DUE_SOON: { label: formatDueSoonLabel(daysUntilDue), color: "#b45309" },
    OVERDUE: { label: "Försenad", color: "#b91c1c" },
    NOT_REQUIRED: { label: "Ej kontrollpliktig", color: "#525252" },
    NOT_INSPECTED: { label: "Ej kontrollerad", color: "#1d4ed8" },
  }
  const config = statusConfig[status]

  return (
    <span style={{ ...badgeStyle, color: config.color, borderColor: config.color }}>
      {config.label}
    </span>
  )
}

function sortInstallations(items: Installation[]) {
  return [...items].sort((first, second) => {
    const statusDiff =
      STATUS_SORT_ORDER[first.complianceStatus] -
      STATUS_SORT_ORDER[second.complianceStatus]

    if (statusDiff !== 0) return statusDiff

    return compareNextInspection(first.nextInspection, second.nextInspection)
  })
}

function compareNextInspection(
  firstDate?: string | null,
  secondDate?: string | null
) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return new Date(firstDate).getTime() - new Date(secondDate).getTime()
}

function formatDueSoonLabel(daysUntilDue: number | null) {
  if (daysUntilDue === null) return "Förfaller snart"
  if (daysUntilDue === 0) return "Förfaller idag"
  return `Förfaller om ${daysUntilDue} dagar`
}

function formatInspectionInterval(installation: Installation) {
  if (!installation.inspectionInterval) return "Ingen kontrollplikt"

  if (!installation.hasAdjustedInspectionInterval) {
    return `Var ${installation.inspectionInterval}:e månad`
  }

  return `Var ${installation.inspectionInterval}:e månad (bas ${installation.baseInspectionInterval}:e månad, läckagevarning)`
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

const sectionStyle: React.CSSProperties = {
  marginTop: 32,
}

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  marginTop: 32,
}

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 16,
  borderRadius: 8,
}

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
}

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid #d4d4d4",
  borderRadius: 6,
  background: "#fff",
  padding: "7px 10px",
  cursor: "pointer",
}

const activeFilterButtonStyle: React.CSSProperties = {
  borderColor: "#171717",
  background: "#171717",
  color: "#fff",
}

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 13,
  fontWeight: 600,
}

const exportButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #171717",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#171717",
  textDecoration: "none",
  fontWeight: 600,
}

const exportActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 24,
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
}
