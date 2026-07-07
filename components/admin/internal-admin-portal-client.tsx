"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Card } from "@/components/ui"
import { formatRoleLabel } from "@/lib/roles"

export type InternalAdminCompany = {
  id: string
  name: string
  createdAt: string
  userCount: number
  installationCount: number
  status: "Active" | "Inactive"
}

export type InternalAdminUserRow = {
  id: string
  membershipId: string
  name: string
  email: string
  companyName: string
  role: string
  lastLogin: string | null
  status: "Active" | "Inactive"
}

export function InternalAdminPortalClient({
  companies,
  users,
}: {
  companies: InternalAdminCompany[]
  users: InternalAdminUserRow[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [sendInvitationEmail, setSendInvitationEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState<{
    companyName: string
    contactEmail: string
    emailSent: boolean
    existingUserReused: boolean
    inviteLink: string | null
    invitationCreated: boolean
  } | null>(null)
  const [selectedCompany, setSelectedCompany] =
    useState<InternalAdminCompany | null>(null)
  const [selectedUser, setSelectedUser] = useState<InternalAdminUserRow | null>(
    null
  )
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCompanies = useMemo(
    () =>
      companies.filter((company) =>
        company.name.toLowerCase().includes(normalizedQuery)
      ),
    [companies, normalizedQuery]
  )
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        [user.name, user.email, user.companyName].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      ),
    [normalizedQuery, users]
  )

  async function handleCreatePilotOrganization(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setFormError("")
    setFormSuccess(null)
    setIsSubmitting(true)

    const response = await fetch("/api/admin/pilot-organizations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        organizationName,
        contactName,
        contactEmail,
        sendInvitationEmail,
      }),
    })
    const result: {
      company?: { name: string }
      contactEmail?: string
      emailSent?: boolean
      error?: string
      existingUserReused?: boolean
      invitationCreated?: boolean
      inviteLink?: string | null
    } = await response.json()

    if (!response.ok) {
      setFormError(result.error || "Kunde inte skapa pilotorganisationen.")
      setIsSubmitting(false)
      return
    }

    setFormSuccess({
      companyName: result.company?.name ?? organizationName,
      contactEmail: result.contactEmail ?? contactEmail,
      emailSent: Boolean(result.emailSent),
      existingUserReused: Boolean(result.existingUserReused),
      inviteLink: result.inviteLink ?? null,
      invitationCreated: Boolean(result.invitationCreated),
    })
    setOrganizationName("")
    setContactName("")
    setContactEmail("")
    setSendInvitationEmail(true)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <div className="grid gap-6">
      <Card className="border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Ny pilotorganisation
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Skapa en organisation och bjud in första ägaren.
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleCreatePilotOrganization}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Organisation
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    maxLength={160}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Exempel: Polar Fastigheter AB"
                    required
                    value={organizationName}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Kontaktperson
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    maxLength={160}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Namn på första ägaren"
                    required
                    value={contactName}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Kontaktens e-post
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  maxLength={240}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="namn@organisation.se"
                  required
                  type="email"
                  value={contactEmail}
                />
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  checked={sendInvitationEmail}
                  className="mt-1"
                  onChange={(event) =>
                    setSendInvitationEmail(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">
                    Skicka inbjudan direkt
                  </span>
                  <span className="text-slate-600">
                    Om e-post inte skickas visas en inbjudningslänk efter skapande.
                  </span>
                </span>
              </label>
              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {formError}
                </p>
              ) : null}
              <div>
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Skapar..." : "Skapa pilotorganisation"}
                </button>
              </div>
            </form>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {formSuccess ? (
              <div>
                <p className="font-semibold text-emerald-700">
                  Pilotorganisation skapad.
                </p>
                <dl className="mt-3 grid gap-2">
                  <div>
                    <dt className="font-semibold text-slate-900">Organisation</dt>
                    <dd>{formSuccess.companyName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Ägare</dt>
                    <dd>{formSuccess.contactEmail}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Inbjudan</dt>
                    <dd>
                      {formSuccess.existingUserReused
                        ? "Befintlig användare kopplades som ägare."
                        : formSuccess.emailSent
                          ? "E-post skickades."
                          : formSuccess.invitationCreated
                            ? "Inbjudningslänk skapades."
                            : "Ingen inbjudan skapades."}
                    </dd>
                  </div>
                </dl>
                {formSuccess.inviteLink ? (
                  <p className="mt-3 break-all rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {formSuccess.inviteLink}
                  </p>
                ) : null}
              </div>
            ) : (
              <p>
                Organisationen får plan <span className="font-semibold">pilot</span>.
                För nya användare skapas en vanlig inbjudan till registreringsflödet.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="block text-sm font-semibold text-slate-800">
          Sök pilotorganisation eller användare
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök på organisation, namn eller e-post"
            type="search"
            value={query}
          />
        </label>
      </Card>

      <section className="grid gap-4">
        <SectionTitle
          count={filteredCompanies.length}
          description="Pilotorganisationer i Polar."
          title="Pilotorganisationer"
        />
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Skapad</th>
                  <th className="px-4 py-3 text-right">Användare</th>
                  <th className="px-4 py-3 text-right">Aggregat</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {company.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {company.userCount}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {company.installationCount}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={company.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setSelectedCompany(company)
                          setSelectedUser(null)
                        }}
                        type="button"
                      >
                        Visa
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCompanies.length === 0 ? (
                  <EmptyTableRow colSpan={6} text="Inga organisationer matchar sökningen." />
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid gap-4">
        <SectionTitle
          count={filteredUsers.length}
          description="Användare visas per företagskoppling."
          title="Användare"
        />
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Namn</th>
                  <th className="px-4 py-3">E-post</th>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Senaste inloggning</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.membershipId}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{user.email}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {user.companyName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatRoleLabel(user.role)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.lastLogin ? formatDate(user.lastLogin) : "Ej tillgängligt"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setSelectedUser(user)
                          setSelectedCompany(null)
                        }}
                        type="button"
                      >
                        Visa
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <EmptyTableRow colSpan={7} text="Inga användare matchar sökningen." />
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {(selectedCompany || selectedUser) && (
        <Card className="border-blue-100 bg-blue-50/70 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Läsdetaljer
              </p>
              {selectedCompany ? (
                <div className="mt-2 text-sm text-slate-700">
                  <h3 className="text-base font-semibold text-slate-950">
                    {selectedCompany.name}
                  </h3>
                  <p className="mt-1">
                    Skapad {formatDate(selectedCompany.createdAt)}.{" "}
                    {selectedCompany.userCount} användare och{" "}
                    {selectedCompany.installationCount} aggregat.
                  </p>
                </div>
              ) : null}
              {selectedUser ? (
                <div className="mt-2 text-sm text-slate-700">
                  <h3 className="text-base font-semibold text-slate-950">
                    {selectedUser.name}
                  </h3>
                  <p className="mt-1">
                    {selectedUser.email} · {formatRoleLabel(selectedUser.role)} i{" "}
                    {selectedUser.companyName}.
                  </p>
                </div>
              ) : null}
            </div>
            <button
              className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSelectedCompany(null)
                setSelectedUser(null)
              }}
              type="button"
            >
              Stäng
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

function SectionTitle({
  count,
  description,
  title,
}: {
  count: number
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <span className="text-sm font-semibold text-slate-500">{count} visas</span>
    </div>
  )
}

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <Badge variant={status === "Active" ? "success" : "neutral"}>
      {status === "Active" ? "Aktiv" : "Inaktiv"}
    </Badge>
  )
}

function EmptyTableRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}
