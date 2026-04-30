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

type CompanyProfile = {
  id: string
  name: string
  orgNumber: string
  organizationNumber?: string | null
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  supervisoryAuthority?: string | null
  email: string
  phone?: string | null
}

type CompanyProfileFormData = {
  name: string
  organizationNumber: string
  contactPerson: string
  contactEmail: string
  contactPhone: string
  address: string
  postalCode: string
  city: string
  supervisoryAuthority: string
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type InvitationFormData = {
  email: string
  role: UserRole
}

const initialInvitationFormData: InvitationFormData = {
  email: "",
  role: "MEMBER",
}

const initialProfileFormData: CompanyProfileFormData = {
  name: "",
  organizationNumber: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  postalCode: "",
  city: "",
  supervisoryAuthority: "",
}

const fieldClassName = "grid gap-1 text-sm font-medium text-slate-700"
const inputClassName = "rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"

export default function CompanySettingsPage() {
  const router = useRouter()
  const [data, setData] = useState<CompanySettingsData>({
    users: [],
    invitations: [],
  })
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [profileForm, setProfileForm] = useState<CompanyProfileFormData>(
    initialProfileFormData
  )
  const [invitationForm, setInvitationForm] = useState<InvitationFormData>(
    initialInvitationFormData
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [error, setError] = useState("")
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [inviteLink, setInviteLink] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchCompanySettings() {
      const [companyRes, invitationsRes, userRes] = await Promise.all([
        fetch("/api/company", {
          credentials: "include",
        }),
        fetch("/api/company/invitations", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (
        companyRes.status === 401 ||
        invitationsRes.status === 401 ||
        userRes.status === 401
      ) {
        router.push("/login")
        return
      }

      if (!companyRes.ok || !userRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta företagsinställningar")
        setIsLoading(false)
        return
      }

      const company: CompanyProfile = await companyRes.json()
      const userData: CurrentUser = await userRes.json()
      const invitationsData: CompanySettingsData =
        invitationsRes.ok ? await invitationsRes.json() : { users: [], invitations: [] }

      if (!isMounted) return

      setCompanyProfile(company)
      setProfileForm(toProfileFormData(company))
      setCurrentUser(userData)
      setData(invitationsData)
      setIsLoading(false)
    }

    void fetchCompanySettings()

    return () => {
      isMounted = false
    }
  }, [router])

  const canAdminister = currentUser?.role === "ADMIN"

  function handleProfileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setProfileForm({
      ...profileForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleInvitationChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setInvitationForm({
      ...invitationForm,
      [event.target.name]: event.target.value,
    })
  }

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault()
    setProfileError("")
    setProfileSuccess("")
    setIsSavingProfile(true)

    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(profileForm),
    })
    const result: CompanyProfile & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setProfileError(result.error || "Kunde inte spara företagsuppgifter")
      setIsSavingProfile(false)
      return
    }

    setCompanyProfile(result)
    setProfileForm(toProfileFormData(result))
    setIsEditingProfile(false)
    setProfileSuccess("Företagsuppgifter har sparats")
    setIsSavingProfile(false)
  }

  async function handleInviteSubmit(event: React.FormEvent) {
    event.preventDefault()
    setInviteError("")
    setInviteSuccess("")
    setInviteLink("")
    setIsSubmittingInvite(true)

    const res = await fetch("/api/company/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(invitationForm),
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
      setInviteError(result.error || "Kunde inte skapa inbjudan")
      setIsSubmittingInvite(false)
      return
    }

    setInviteSuccess("Inbjudan har skapats")
    setInviteLink(result.inviteLink || "")
    setInvitationForm(initialInvitationFormData)
    setIsSubmittingInvite(false)

    const refreshRes = await fetch("/api/company/invitations", {
      credentials: "include",
    })

    if (refreshRes.ok) {
      const refreshedData: CompanySettingsData = await refreshRes.json()
      setData(refreshedData)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline" href="/dashboard">
        Tillbaka till dashboard
      </Link>
      <div className="mt-6 border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Företagsinställningar
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Hantera företagsuppgifter, användare och inbjudningar för organisationen.
        </p>
      </div>

      {isLoading && <p className="mt-8 text-slate-700">Laddar...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && companyProfile && (
        <>
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Företagsuppgifter</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Uppgifter som kan återanvändas i rapporter, exporter och dokumenthuvuden.
                </p>
              </div>
              {canAdminister && !isEditingProfile && (
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                >
                  Redigera
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
                <label className={fieldClassName}>
                  Företagsnamn
                  <input className={inputClassName} name="name" value={profileForm.name} onChange={handleProfileChange} required />
                </label>
                <label className={fieldClassName}>
                  Organisationsnummer
                  <input className={inputClassName} name="organizationNumber" value={profileForm.organizationNumber} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  Kontaktperson
                  <input className={inputClassName} name="contactPerson" value={profileForm.contactPerson} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  E-post
                  <input className={inputClassName} name="contactEmail" type="email" value={profileForm.contactEmail} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  Telefon
                  <input className={inputClassName} name="contactPhone" value={profileForm.contactPhone} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  Adress
                  <input className={inputClassName} name="address" value={profileForm.address} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  Postnummer
                  <input className={inputClassName} name="postalCode" value={profileForm.postalCode} onChange={handleProfileChange} />
                </label>
                <label className={fieldClassName}>
                  Ort
                  <input className={inputClassName} name="city" value={profileForm.city} onChange={handleProfileChange} />
                </label>
                <label className={`${fieldClassName} md:col-span-2`}>
                  Tillsynsmyndighet
                  <input className={inputClassName} name="supervisoryAuthority" value={profileForm.supervisoryAuthority} onChange={handleProfileChange} />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                    type="submit"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Sparar..." : "Spara"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    type="button"
                    disabled={isSavingProfile}
                    onClick={() => {
                      setProfileForm(toProfileFormData(companyProfile))
                      setIsEditingProfile(false)
                      setProfileError("")
                    }}
                  >
                    Avbryt
                  </button>
                </div>
                {profileError && <p className="font-semibold text-red-700 md:col-span-2">{profileError}</p>}
              </form>
            ) : (
              <dl className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <ProfileItem label="Företagsnamn" value={companyProfile.name} />
                <ProfileItem label="Organisationsnummer" value={companyProfile.organizationNumber || companyProfile.orgNumber} />
                <ProfileItem label="Kontaktperson" value={companyProfile.contactPerson} />
                <ProfileItem label="E-post" value={companyProfile.contactEmail || companyProfile.email} />
                <ProfileItem label="Telefon" value={companyProfile.contactPhone || companyProfile.phone} />
                <ProfileItem label="Adress" value={companyProfile.address} />
                <ProfileItem label="Postnummer" value={companyProfile.postalCode} />
                <ProfileItem label="Ort" value={companyProfile.city} />
                <ProfileItem label="Tillsynsmyndighet" value={companyProfile.supervisoryAuthority} />
              </dl>
            )}

            {profileSuccess && !isEditingProfile && (
              <p className="mt-4 text-sm font-semibold text-green-700">{profileSuccess}</p>
            )}
          </section>

          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-slate-950">Användare</h2>
            {data.users.length === 0 ? (
              <p className="mt-4 text-sm text-slate-700">Inga användare hittades.</p>
            ) : (
              <CompanyTable
                headers={["Namn", "E-post", "Roll", "Status"]}
                rows={data.users.map((user) => [
                  user.name,
                  user.email,
                  user.role,
                  user.isActive ? "Aktiv" : "Inaktiv",
                ])}
              />
            )}
          </section>

          {canAdminister && (
            <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-slate-950">Bjud in användare</h2>
              <form className="mt-5 grid max-w-md gap-4" onSubmit={handleInviteSubmit}>
                <label className={fieldClassName}>
                  E-post
                  <input
                    className={inputClassName}
                    name="email"
                    type="email"
                    value={invitationForm.email}
                    onChange={handleInvitationChange}
                    required
                  />
                </label>

                <label className={fieldClassName}>
                  Roll
                  <select
                    className={inputClassName}
                    name="role"
                    value={invitationForm.role}
                    onChange={handleInvitationChange}
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="CONTRACTOR">CONTRACTOR</option>
                  </select>
                </label>

                {inviteError && <p className="font-semibold text-red-700">{inviteError}</p>}
                {inviteSuccess && <p className="font-semibold text-green-700">{inviteSuccess}</p>}
                {inviteLink && (
                  <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    Inbjudningslänk: <code className="break-all text-slate-950">{inviteLink}</code>
                  </p>
                )}

                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                  type="submit"
                  disabled={isSubmittingInvite}
                >
                  {isSubmittingInvite ? "Skapar..." : "Skapa inbjudan"}
                </button>
              </form>
            </section>
          )}

          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-slate-950">Väntande inbjudningar</h2>
            {data.invitations.length === 0 ? (
              <p className="mt-4 text-sm text-slate-700">Inga väntande inbjudningar.</p>
            ) : (
              <CompanyTable
                headers={["E-post", "Roll", "Inbjuden av", "Går ut"]}
                rows={data.invitations.map((invitation) => [
                  invitation.email,
                  invitation.role,
                  invitation.invitedByUser.email,
                  formatDate(invitation.expiresAt),
                ])}
              />
            )}
          </section>
        </>
      )}
    </main>
  )
}

function ProfileItem({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value || "-"}</dd>
    </div>
  )
}

function CompanyTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td className="whitespace-nowrap px-4 py-3 text-slate-800" key={`${cell}-${index}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function toProfileFormData(company: CompanyProfile): CompanyProfileFormData {
  return {
    name: company.name,
    organizationNumber: company.organizationNumber || company.orgNumber || "",
    contactPerson: company.contactPerson || "",
    contactEmail: company.contactEmail || company.email || "",
    contactPhone: company.contactPhone || company.phone || "",
    address: company.address || "",
    postalCode: company.postalCode || "",
    city: company.city || "",
    supervisoryAuthority: company.supervisoryAuthority || "",
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}
