"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/auth"

type CompanyUser = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

type PendingInvitation = {
  id: string
  email: string
  role: UserRole
  expiresAt: string
  createdAt: string
  invitedByUser: {
    name: string
    email: string
  }
}

type CompanySettingsData = {
  users: CompanyUser[]
  invitations: PendingInvitation[]
}

type InvitationFormData = {
  email: string
  role: UserRole
}

const initialFormData: InvitationFormData = {
  email: "",
  role: "MEMBER",
}

export default function CompanySettingsPage() {
  const router = useRouter()
  const [data, setData] = useState<CompanySettingsData>({
    users: [],
    invitations: [],
  })
  const [formData, setFormData] = useState<InvitationFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [inviteLink, setInviteLink] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchCompanySettings() {
      const res = await fetch("/api/company/invitations", {
        credentials: "include",
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      if (res.status === 403) {
        if (!isMounted) return
        setError("Behörighet saknas")
        setIsLoading(false)
        return
      }

      if (!res.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta företagsinställningar")
        setIsLoading(false)
        return
      }

      const result: CompanySettingsData = await res.json()

      if (!isMounted) return

      setData(result)
      setIsLoading(false)
    }

    void fetchCompanySettings()

    return () => {
      isMounted = false
    }
  }, [router])

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setInviteLink("")
    setIsSubmitting(true)

    const res = await fetch("/api/company/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(formData),
    })
    const result: {
      error?: string
      inviteLink?: string
      invitation?: PendingInvitation
    } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setError(result.error || "Kunde inte skapa inbjudan")
      setIsSubmitting(false)
      return
    }

    setSuccess("Inbjudan har skapats")
    setInviteLink(result.inviteLink || "")
    setFormData(initialFormData)
    setIsSubmitting(false)

    const refreshRes = await fetch("/api/company/invitations", {
      credentials: "include",
    })

    if (refreshRes.ok) {
      const refreshedData: CompanySettingsData = await refreshRes.json()
      setData(refreshedData)
    }
  }

  return (
    <main style={pageStyle}>
      <Link href="/dashboard">Tillbaka till dashboard</Link>
      <h1>Företagsinställningar</h1>

      {isLoading && <p>Laddar...</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!isLoading && !error && (
        <>
          <section style={sectionStyle}>
            <h2>Användare</h2>
            {data.users.length === 0 ? (
              <p>Inga användare hittades.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Namn</th>
                    <th style={cellStyle}>E-post</th>
                    <th style={cellStyle}>Roll</th>
                    <th style={cellStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td style={cellStyle}>{user.name}</td>
                      <td style={cellStyle}>{user.email}</td>
                      <td style={cellStyle}>{user.role}</td>
                      <td style={cellStyle}>{user.isActive ? "Aktiv" : "Inaktiv"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={sectionStyle}>
            <h2>Bjud in användare</h2>
            <form onSubmit={handleSubmit} style={formStyle}>
              <label style={fieldStyle}>
                E-post
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label style={fieldStyle}>
                Roll
                <select name="role" value={formData.role} onChange={handleChange}>
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>

              {success && <p style={{ color: "#047857" }}>{success}</p>}
              {inviteLink && (
                <p>
                  Inbjudningslänk: <code>{inviteLink}</code>
                </p>
              )}

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Skapar..." : "Skapa inbjudan"}
              </button>
            </form>
          </section>

          <section style={sectionStyle}>
            <h2>Väntande inbjudningar</h2>
            {data.invitations.length === 0 ? (
              <p>Inga väntande inbjudningar.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>E-post</th>
                    <th style={cellStyle}>Roll</th>
                    <th style={cellStyle}>Inbjuden av</th>
                    <th style={cellStyle}>Går ut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td style={cellStyle}>{invitation.email}</td>
                      <td style={cellStyle}>{invitation.role}</td>
                      <td style={cellStyle}>{invitation.invitedByUser.email}</td>
                      <td style={cellStyle}>{formatDate(invitation.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "60px auto",
  padding: 20,
}

const sectionStyle: React.CSSProperties = {
  marginTop: 32,
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  maxWidth: 420,
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
