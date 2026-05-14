"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, Card, PageHeader } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import {
  formatRoleDescription,
  formatRoleLabel,
  isAdminRole,
} from "@/lib/roles"

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
  contactPhone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  billingEmail?: string | null
  invoiceReference?: string | null
  billingAddress?: string | null
  vatNumber?: string | null
  eInvoiceId?: string | null
  phone?: string | null
}

type CompanyProfileFormData = {
  name: string
  organizationNumber: string
  contactPerson: string
  contactPhone: string
  address: string
  postalCode: string
  city: string
}

type BillingFormData = {
  billingEmail: string
  invoiceReference: string
  billingAddress: string
  vatNumber: string
  eInvoiceId: string
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
  contactPhone: "",
  address: "",
  postalCode: "",
  city: "",
}

const initialBillingFormData: BillingFormData = {
  billingEmail: "",
  invoiceReference: "",
  billingAddress: "",
  vatNumber: "",
  eInvoiceId: "",
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
  const [billingForm, setBillingForm] = useState<BillingFormData>(
    initialBillingFormData
  )
  const [invitationForm, setInvitationForm] = useState<InvitationFormData>(
    initialInvitationFormData
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isEditingBilling, setIsEditingBilling] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingBilling, setIsSavingBilling] = useState(false)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [error, setError] = useState("")
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")
  const [billingError, setBillingError] = useState("")
  const [billingSuccess, setBillingSuccess] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [inviteWarning, setInviteWarning] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [userManagementError, setUserManagementError] = useState("")
  const [userManagementSuccess, setUserManagementSuccess] = useState("")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [transferTargetUser, setTransferTargetUser] =
    useState<CompanyUser | null>(null)
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchCompanySettings() {
      const accessRes = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (accessRes.status === 401) {
        router.push("/login")
        return
      }

      if (!accessRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta företagsinställningar")
        setIsLoading(false)
        return
      }

      const accessUser: CurrentUser = await accessRes.json()

      if (!isMounted) return

      const [companyRes, userRes, invitationsRes] = await Promise.all([
        fetch("/api/company", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        isAdminRole(accessUser.role)
          ? fetch("/api/company/invitations", {
              credentials: "include",
            })
          : Promise.resolve(null),
      ])

      if (
        companyRes.status === 401 ||
        userRes.status === 401 ||
        invitationsRes?.status === 401
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
        invitationsRes?.ok ? await invitationsRes.json() : { users: [], invitations: [] }

      if (!isMounted) return

      setCompanyProfile(company)
      setProfileForm(toProfileFormData(company))
      setBillingForm(toBillingFormData(company))
      setCurrentUser(userData)
      setData(invitationsData)
      setIsLoading(false)
    }

    void fetchCompanySettings()

    return () => {
      isMounted = false
    }
  }, [router])

  const canAdminister = isAdminRole(currentUser?.role)
  const canEditProfile = currentUser?.role === "OWNER"
  const canViewBilling = isAdminRole(currentUser?.role)
  const canEditBilling = currentUser?.role === "OWNER"
  const canManageUsers = currentUser?.role === "OWNER"
  const internalInviteRoleOptions: UserRole[] =
    currentUser?.role === "OWNER" ? ["OWNER", "ADMIN", "MEMBER"] : ["MEMBER"]
  const selectedInvitationRole = internalInviteRoleOptions.includes(invitationForm.role)
    ? invitationForm.role
    : "MEMBER"
  const visiblePendingInvitations = data.invitations.filter(
    (invitation) => new Date(invitation.expiresAt) > new Date()
  )

  function handleProfileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value

    setProfileForm({
      ...profileForm,
      [event.target.name]: value,
    })
  }

  function handleBillingChange(event: React.ChangeEvent<HTMLInputElement>) {
    setBillingForm({
      ...billingForm,
      [event.target.name]: event.target.value,
    })
  }

  function handleInvitationChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const nextValue =
      event.target.name === "role" &&
      !internalInviteRoleOptions.includes(event.target.value as UserRole)
        ? "MEMBER"
        : event.target.value

    setInvitationForm({
      ...invitationForm,
      [event.target.name]: nextValue,
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

  async function handleBillingSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBillingError("")
    setBillingSuccess("")
    setIsSavingBilling(true)

    const res = await fetch("/api/company/billing", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(billingForm),
    })
    const result: Partial<CompanyProfile> & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setBillingError(result.error || "Kunde inte spara fakturauppgifter")
      setIsSavingBilling(false)
      return
    }

    const updatedCompany = {
      ...companyProfile,
      ...result,
    } as CompanyProfile
    setCompanyProfile(updatedCompany)
    setBillingForm(toBillingFormData(updatedCompany))
    setIsEditingBilling(false)
    setBillingSuccess("Fakturauppgifter har sparats")
    setIsSavingBilling(false)
  }

  async function handleInviteSubmit(event: React.FormEvent) {
    event.preventDefault()
    setInviteError("")
    setInviteSuccess("")
    setInviteWarning("")
    setInviteLink("")
    setIsSubmittingInvite(true)

    const res = await fetch("/api/company/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ...invitationForm,
        role: selectedInvitationRole,
      }),
    })
    const result: {
      error?: string
      message?: string
      emailSent?: boolean
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

    if (result.emailSent === false) {
      setInviteWarning(
        result.message ||
          "Inbjudan skapad, men e-post kunde inte skickas. Använd inbjudningslänken nedan."
      )
    } else {
      setInviteSuccess(result.message || "Inbjudan skapad och e-post har skickats.")
    }
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

  async function handleRoleChange(user: CompanyUser, role: UserRole) {
    if (isTransferringOwnership) return
    if (role === "OWNER") return
    if (role === "CONTRACTOR") {
      setUserManagementError("Servicepartners och servicekontakter hanteras från sidan Servicepartners.")
      return
    }
    if (user.id === currentUser?.userId) return

    setUserManagementError("")
    setUserManagementSuccess("")
    setUpdatingUserId(user.id)

    const res = await fetch(`/api/company/users/${user.id}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ role }),
    })
    const result: CompanyUser & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setUserManagementError(result.error || "Kunde inte ändra roll")
      setUpdatingUserId(null)
      return
    }

    setData((current) => ({
      ...current,
      users: current.users.map((currentUser) =>
        currentUser.id === result.id ? result : currentUser
      ),
    }))
    setUserManagementSuccess("Användarrollen har uppdaterats")
    setUpdatingUserId(null)
  }

  async function handleRemoveUser(user: CompanyUser) {
    if (isTransferringOwnership) return
    setUserManagementError("")
    setUserManagementSuccess("")

    const confirmed = window.confirm(
      `Vill du ta bort ${user.name || user.email} från företaget? Användaren inaktiveras och kan inte längre logga in.`
    )

    if (!confirmed) return

    setUpdatingUserId(user.id)

    const res = await fetch(`/api/company/users/${user.id}`, {
      method: "DELETE",
      credentials: "include",
    })
    const result: CompanyUser & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setUserManagementError(result.error || "Kunde inte ta bort användaren")
      setUpdatingUserId(null)
      return
    }

    setData((current) => ({
      ...current,
      users: current.users.map((currentUser) =>
        currentUser.id === result.id ? result : currentUser
      ),
    }))
    setUserManagementSuccess("Användaren har inaktiverats")
    setUpdatingUserId(null)
  }

  async function handleTransferOwnership() {
    if (!transferTargetUser) return

    setUserManagementError("")
    setUserManagementSuccess("")
    setIsTransferringOwnership(true)
    setUpdatingUserId(transferTargetUser.id)

    const res = await fetch("/api/company/transfer-ownership", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ targetUserId: transferTargetUser.id }),
    })
    const result: {
      error?: string
      newOwner?: CompanyUser
      previousOwner?: CompanyUser
    } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok || !result.newOwner || !result.previousOwner) {
      setUserManagementError(result.error || "Kunde inte överföra ägarskap")
      setIsTransferringOwnership(false)
      setUpdatingUserId(null)
      return
    }

    setData((current) => ({
      ...current,
      users: current.users.map((user) => {
        if (user.id === result.newOwner?.id) return result.newOwner
        if (user.id === result.previousOwner?.id) return result.previousOwner
        return user
      }),
    }))
    setCurrentUser((user) => (user ? { ...user, role: "ADMIN" } : user))
    setTransferTargetUser(null)
    setIsTransferringOwnership(false)
    setUpdatingUserId(null)
    setUserManagementSuccess("Ägarskapet har överförts. Du är nu Ansvarig.")
    router.refresh()
    window.setTimeout(() => {
      window.location.assign("/dashboard/company")
    }, 900)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <PageHeader
        title="Företagsinställningar"
        subtitle="Hantera företagsuppgifter, användare och inbjudningar för organisationen."
      />
      <div className="hidden">
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
          <Card className="mt-8 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Företagsuppgifter</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Uppgifter som kan återanvändas i rapporter, exporter och dokumenthuvuden.
                </p>
              </div>
              {canEditProfile && !isEditingProfile && (
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
                  <input
                    className={inputClassName}
                    name="organizationNumber"
                    placeholder="556703-7485"
                    value={profileForm.organizationNumber}
                    onChange={handleProfileChange}
                  />
                </label>
                <label className={fieldClassName}>
                  Kontaktperson
                  <input className={inputClassName} name="contactPerson" value={profileForm.contactPerson} onChange={handleProfileChange} />
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
                <ProfileItem label="Telefon" value={companyProfile.contactPhone || companyProfile.phone} />
                <ProfileItem label="Adress" value={companyProfile.address} />
                <ProfileItem label="Postnummer" value={companyProfile.postalCode} />
                <ProfileItem label="Ort" value={companyProfile.city} />
              </dl>
            )}

            {profileSuccess && !isEditingProfile && (
              <p className="mt-4 text-sm font-semibold text-green-700">{profileSuccess}</p>
            )}
          </Card>

          {canViewBilling && (
          <Card className="mt-8 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Fakturauppgifter</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Uppgifter som används för fakturering. Endast ägare kan ändra dem.
                </p>
              </div>
              {canEditBilling && !isEditingBilling && (
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  type="button"
                  onClick={() => setIsEditingBilling(true)}
                >
                  Redigera
                </button>
              )}
            </div>

            {isEditingBilling ? (
              <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleBillingSubmit}>
                <label className={fieldClassName}>
                  Faktura-e-post
                  <input className={inputClassName} name="billingEmail" type="email" value={billingForm.billingEmail} onChange={handleBillingChange} />
                </label>
                <label className={fieldClassName}>
                  Fakturareferens
                  <input className={inputClassName} name="invoiceReference" value={billingForm.invoiceReference} onChange={handleBillingChange} />
                </label>
                <label className={fieldClassName}>
                  VAT-nummer
                  <input className={inputClassName} name="vatNumber" value={billingForm.vatNumber} onChange={handleBillingChange} />
                </label>
                <label className={fieldClassName}>
                  E-faktura-ID
                  <input className={inputClassName} name="eInvoiceId" value={billingForm.eInvoiceId} onChange={handleBillingChange} />
                </label>
                <label className={`${fieldClassName} md:col-span-2`}>
                  Fakturaadress
                  <input className={inputClassName} name="billingAddress" value={billingForm.billingAddress} onChange={handleBillingChange} />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                    type="submit"
                    disabled={isSavingBilling}
                  >
                    {isSavingBilling ? "Sparar..." : "Spara fakturauppgifter"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    type="button"
                    disabled={isSavingBilling}
                    onClick={() => {
                      setBillingForm(toBillingFormData(companyProfile))
                      setIsEditingBilling(false)
                      setBillingError("")
                    }}
                  >
                    Avbryt
                  </button>
                </div>
                {billingError && <p className="font-semibold text-red-700 md:col-span-2">{billingError}</p>}
              </form>
            ) : (
              <dl className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <ProfileItem label="Faktura-e-post" value={companyProfile.billingEmail} />
                <ProfileItem label="Fakturareferens" value={companyProfile.invoiceReference} />
                <ProfileItem label="Fakturaadress" value={companyProfile.billingAddress} />
                <ProfileItem label="VAT-nummer" value={companyProfile.vatNumber} />
                <ProfileItem label="E-faktura-ID" value={companyProfile.eInvoiceId} />
              </dl>
            )}

            {billingSuccess && !isEditingBilling && (
              <p className="mt-4 text-sm font-semibold text-green-700">{billingSuccess}</p>
            )}
          </Card>
          )}

          {canAdminister && (
          <Card className="mt-8 p-5">
            <h2 className="text-xl font-semibold text-slate-950">Användare</h2>
            {data.users.length === 0 ? (
              <p className="mt-4 text-sm text-slate-700">Inga användare hittades.</p>
            ) : canManageUsers ? (
              <>
                <ManagedUsersTable
                  currentUserId={currentUser?.userId || ""}
                  disabledUserId={updatingUserId}
                  isTransferPending={isTransferringOwnership}
                  users={data.users}
                  onRemoveUser={handleRemoveUser}
                  onRoleChange={handleRoleChange}
                  onTransferOwnership={setTransferTargetUser}
                />
                {userManagementError && (
                  <p className="mt-4 font-semibold text-red-700">
                    {userManagementError}
                  </p>
                )}
                {userManagementSuccess && (
                  <p className="mt-4 font-semibold text-green-700">
                    {userManagementSuccess}
                  </p>
                )}
              </>
            ) : (
              <ReadOnlyUsersTable users={data.users} />
            )}
          </Card>
          )}

          {canAdminister && (
            <Card className="mt-8 p-5">
              <h2 className="text-xl font-semibold text-slate-950">
                Bjud in användare till organisationen
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Används för interna användare. Servicepartners bjuds in från servicepartnersidan.
              </p>
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
                    value={selectedInvitationRole}
                    onChange={handleInvitationChange}
                  >
                    {internalInviteRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-normal text-slate-600">
                    {formatRoleDescription(selectedInvitationRole)}
                  </span>
                </label>

                {inviteError && <p className="font-semibold text-red-700">{inviteError}</p>}
                {inviteSuccess && <p className="font-semibold text-green-700">{inviteSuccess}</p>}
                {inviteWarning && <p className="font-semibold text-amber-700">{inviteWarning}</p>}
                {inviteLink && (
                  <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    Inbjudningslänk: <code className="break-all text-slate-950">{inviteLink}</code>
                  </p>
                )}

                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                  type="submit"
                  disabled={isSubmittingInvite || isTransferringOwnership}
                >
                  {isSubmittingInvite ? "Skapar..." : "Skapa inbjudan"}
                </button>
              </form>
            </Card>
          )}

          {canAdminister && (
          <Card className="mt-8 p-5">
            <h2 className="text-xl font-semibold text-slate-950">Väntande inbjudningar</h2>
            {visiblePendingInvitations.length === 0 ? (
              <p className="mt-4 text-sm text-slate-700">Inga väntande inbjudningar.</p>
            ) : (
              <CompanyTable
                headers={["E-post", "Roll", "Inbjuden av", "Går ut"]}
                rows={visiblePendingInvitations.map((invitation) => [
                  invitation.email,
                  formatRoleLabel(invitation.role),
                  invitation.invitedByUser.email,
                  formatDate(invitation.expiresAt),
                ])}
              />
            )}
          </Card>
          )}
        </>
      )}
      {transferTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              Överför ägarskap
            </h2>
            <p className="mt-3 text-sm text-slate-700">
              Du kommer att förlora din ägarroll och bli Ansvarig. Vill du
              fortsätta?
            </p>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              Ny ägare:{" "}
              <span className="font-semibold text-slate-950">
                {transferTargetUser.name || transferTargetUser.email}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isTransferringOwnership}
                onClick={() => setTransferTargetUser(null)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isTransferringOwnership}
                onClick={handleTransferOwnership}
              >
                {isTransferringOwnership ? "Överför..." : "Fortsätt"}
              </Button>
            </div>
          </div>
        </div>
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

function ManagedUsersTable({
  currentUserId,
  disabledUserId,
  isTransferPending,
  onRemoveUser,
  onRoleChange,
  onTransferOwnership,
  users,
}: {
  currentUserId: string
  disabledUserId: string | null
  isTransferPending: boolean
  onRemoveUser: (user: CompanyUser) => void
  onRoleChange: (user: CompanyUser, role: UserRole) => void
  onTransferOwnership: (user: CompanyUser) => void
  users: CompanyUser[]
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["Namn", "E-post", "Roll", "Status", "Åtgärd"].map((header) => (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId
            const isUpdating = disabledUserId === user.id
            const canShowRoleSelect = user.role !== "OWNER" && !isCurrentUser
            const controlsDisabled = isUpdating || isTransferPending || !user.isActive

            return (
              <tr key={user.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {user.name}
                  {isCurrentUser && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      Du
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {canShowRoleSelect ? (
                    <select
                      className={inputClassName}
                      disabled={controlsDisabled}
                      title={formatRoleDescription(user.role)}
                      value={user.role}
                      onChange={(event) =>
                        onRoleChange(user, event.target.value as UserRole)
                      }
                    >
                      <option value="ADMIN">{formatRoleLabel("ADMIN")}</option>
                      <option value="MEMBER">{formatRoleLabel("MEMBER")}</option>
                    </select>
                  ) : isCurrentUser ? (
                    <Badge variant="neutral" title={formatRoleDescription(user.role)}>
                      {formatRoleLabel(user.role)}
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-slate-950"
                        title={formatRoleDescription(user.role)}
                      >
                        {formatRoleLabel(user.role)}
                      </span>
                      <select
                        className={inputClassName}
                        disabled={controlsDisabled}
                        defaultValue=""
                        onChange={(event) => {
                          const nextRole = event.target.value
                          if (nextRole) onRoleChange(user, nextRole as UserRole)
                          event.target.value = ""
                        }}
                      >
                        <option value="">Ändra till...</option>
                        <option value="ADMIN">{formatRoleLabel("ADMIN")}</option>
                        <option value="MEMBER">{formatRoleLabel("MEMBER")}</option>
                      </select>
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {user.isActive ? "Aktiv" : "Inaktiv"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {!isCurrentUser && user.isActive && user.role !== "CONTRACTOR" && (
                    <button
                      className="mr-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={isUpdating || isTransferPending}
                      onClick={() => onTransferOwnership(user)}
                    >
                      Gör till ägare
                    </button>
                  )}
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={isCurrentUser || isUpdating || isTransferPending || !user.isActive}
                    onClick={() => onRemoveUser(user)}
                  >
                    Ta bort användare
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReadOnlyUsersTable({ users }: { users: CompanyUser[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["Namn", "E-post", "Roll", "Status"].map((header) => (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                {user.name}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                <Badge variant="neutral" title={formatRoleDescription(user.role)}>
                  {formatRoleLabel(user.role)}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                {user.isActive ? "Aktiv" : "Inaktiv"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    contactPhone: company.contactPhone || company.phone || "",
    address: company.address || "",
    postalCode: company.postalCode || "",
    city: company.city || "",
  }
}

function toBillingFormData(company: CompanyProfile): BillingFormData {
  return {
    billingEmail: company.billingEmail || "",
    invoiceReference: company.invoiceReference || "",
    billingAddress: company.billingAddress || "",
    vatNumber: company.vatNumber || "",
    eInvoiceId: company.eInvoiceId || "",
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}
