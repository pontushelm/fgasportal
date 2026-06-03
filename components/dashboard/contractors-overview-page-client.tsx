"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState } from "react"
import {
  Badge,
  buttonClassName,
  Card,
  PageHeader,
  SectionHeader,
  Toast,
  type ToastMessage,
} from "@/components/ui"
import type { CertificationStatusResult } from "@/lib/certification-status"

type ContractorOverview = {
  id: string
  membershipId: string
  name: string
  email: string
  isActive: boolean
  isCertifiedCompany: boolean
  certificationNumber: string | null
  certificationOrganization: string | null
  certificationValidUntil: string | null
  certificationStatus: CertificationStatusResult
  assignedInstallationsCount: number
  overdueInspections: number
  dueSoonInspections: number
  highRiskInstallations: number
  leakageEventsCount: number
  latestActivityDate: string | null
  servicePartnerCompany: ServicePartnerCompany | null
}

type ServicePartnerCompany = {
  id: string
  name: string
  organizationNumber: string | null
  contactEmail: string | null
  phone: string | null
  certificateNumber: string | null
  notes: string | null
  createdAt?: string
  updatedAt?: string
}

type ServicePartnerCompanyForm = {
  name: string
  email: string
}

type ContractorsOverviewResponse = {
  permissions?: {
    canManageServicePartners: boolean
  }
  summary: {
    totalContractors: number
    assignedInstallations: number
    overdueInspections: number
    highRiskInstallations: number
    expiredCertifications: number
  }
  servicePartnerCompanies: ServicePartnerCompany[]
  servicePartnerCompanyMetrics: ServicePartnerCompanyMetrics[]
  contractors: ContractorOverview[]
}

type ServicePartnerCompanyMetrics = {
  id: string | null
  name: string
  organizationNumber: string | null
  contactEmail: string | null
  phone: string | null
  certificateNumber: string | null
  notes: string | null
  isUnlinked: boolean
  linkedContactsCount: number
  assignedInstallationsCount: number
  overdueInspections: number
  dueSoonInspections: number
  highRiskInstallations: number
  leakageEventsCount: number
  certificationWarnings: number
  latestActivityDate: string | null
  contractorIds: string[]
}

type ServicePartnerFeedback = ToastMessage & {
  inviteLink?: string | null
}

const emptyCompanyForm: ServicePartnerCompanyForm = {
  name: "",
  email: "",
}

const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"

export default function ContractorsOverviewPageClient() {
  const router = useRouter()
  const [data, setData] = useState<ContractorsOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [companyForm, setCompanyForm] = useState<ServicePartnerCompanyForm>(
    emptyCompanyForm
  )
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [isSavingCompany, setIsSavingCompany] = useState(false)
  const [feedback, setFeedback] = useState<ServicePartnerFeedback | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchOverview() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/contractors/overview", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (response.status === 403) {
        if (!isMounted) return
      setError("Du har inte behörighet att se servicepartneröversikten.")
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta servicepartners.")
        setIsLoading(false)
        return
      }

      const overview: ContractorsOverviewResponse = await response.json()
      if (!isMounted) return

      setData(overview)
      setIsLoading(false)
    }

    void fetchOverview()

    return () => {
      isMounted = false
    }
  }, [router])

  async function refreshOverview() {
    const response = await fetch("/api/contractors/overview", {
      credentials: "include",
    })

    if (response.ok) {
      const overview: ContractorsOverviewResponse = await response.json()
      setData(overview)
    }
  }

  function updateCompanyForm(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target
    setCompanyForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function startEditingCompany(company: ServicePartnerCompany) {
    setEditingCompanyId(company.id)
    setFeedback(null)
    setCompanyForm({
      name: company.name,
      email: company.contactEmail ?? "",
    })
  }

  function resetCompanyForm() {
    setEditingCompanyId(null)
    setCompanyForm(emptyCompanyForm)
  }

  function showFeedback(nextFeedback: ServicePartnerFeedback) {
    setFeedback(nextFeedback)
  }

  function dismissFeedback() {
    setFeedback(null)
  }

  async function handleCompanySubmit(event: React.FormEvent) {
    event.preventDefault()
    setFeedback(null)
    setIsSavingCompany(true)

    const response = await fetch(
      editingCompanyId
        ? `/api/service-partner-companies/${editingCompanyId}`
        : "/api/service-partner-companies",
      {
        method: editingCompanyId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(
          editingCompanyId
            ? {
                name: companyForm.name,
                contactEmail: companyForm.email,
              }
            : {
                name: companyForm.name,
                contactEmail: companyForm.email,
                responsibleContactEmail: companyForm.email,
              }
        ),
      }
    )
    const result: {
      error?: string
      responsibleInvitation?: { message?: string; inviteLink?: string | null }
    } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      showFeedback({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte lägga till servicepartner.",
      })
      setIsSavingCompany(false)
      return
    }

    const inviteLink = result.responsibleInvitation?.inviteLink ?? null
    showFeedback({
      type: inviteLink ? "info" : "success",
      title: inviteLink ? "Inbjudningslänk skapad" : "Klart",
      message: editingCompanyId
        ? "Servicepartnern har uppdaterats."
        : inviteLink
          ? "Servicepartnern har lagts till. E-post kunde inte skickas, men en inbjudningslänk har skapats."
          : result.responsibleInvitation?.message ||
            "Servicepartnern har lagts till och inbjudan har skickats.",
      inviteLink,
    })
    setIsSavingCompany(false)
    resetCompanyForm()
    await refreshOverview()
  }

  const visibleServicePartners = data?.servicePartnerCompanyMetrics ?? []
  const canManageServicePartners =
    data?.permissions?.canManageServicePartners ?? false

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        title="Servicepartners"
        subtitle="Bjud in servicepartner, följ certifiering och se operativ status för tilldelade aggregat."
      />

      {isLoading && (
        <ServicepartnersLoadingSkeleton />
      )}
      {error && <p className="mt-8 text-sm font-semibold text-red-700">{error}</p>}
      {feedback && (
        <Toast
          autoDismissMs={feedback.inviteLink ? 0 : undefined}
          onClose={dismissFeedback}
          toast={feedback}
        >
          {feedback.inviteLink && (
            <div className="mt-3 rounded-md bg-slate-50 p-2 dark:bg-slate-900">
              <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                Kopiera inbjudningslänken och skicka den manuellt.
              </p>
              <code className="block break-all text-xs text-slate-900 dark:text-slate-100">
                {feedback.inviteLink}
              </code>
              <div className="mt-2 flex justify-end">
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(feedback.inviteLink || "")}
                >
                  Kopiera länk
                </button>
              </div>
            </div>
          )}
        </Toast>
      )}

      {!isLoading && !error && data && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              description="Antal servicepartners som är kopplade till företaget."
              label="Kopplade servicepartners"
              value={data.servicePartnerCompanies.length}
            />
            <MetricCard
              description="Antal aggregat som är tilldelade kopplade servicepartners."
              label="Tilldelade aggregat"
              value={data.summary.assignedInstallations}
            />
            <MetricCard
              description="Tilldelade aggregat där senaste kontroll passerat deadline."
              label="Försenade kontroller"
              tone={data.summary.overdueInspections > 0 ? "danger" : "success"}
              value={data.summary.overdueInspections}
            />
            <MetricCard
              description="Tilldelade aggregat med hög riskklassning."
              label="Högriskaggregat"
              tone={data.summary.highRiskInstallations > 0 ? "warning" : "success"}
              value={data.summary.highRiskInstallations}
            />
            <MetricCard
              description="Servicepartners där företagscertifiering saknas eller har passerat giltighetsdatum."
              label="Utgången certifiering"
              tone={data.summary.expiredCertifications > 0 ? "danger" : "success"}
              value={data.summary.expiredCertifications}
            />
          </section>

          <Card className="mt-6 p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <div className="min-h-0">
                <SectionHeader
                  title="Kopplade servicepartners"
                />
                {data.servicePartnerCompanies.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Inga servicepartners har kopplats ännu.
                  </p>
                ) : (
                  <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1">
                    <div className="grid gap-2">
                      {data.servicePartnerCompanies.map((company) => (
                        <div
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
                          key={company.id}
                        >
                          <div>
                            <Link
                              className="font-semibold text-slate-950 underline-offset-4 hover:underline dark:text-slate-100"
                              href={`/dashboard/contractors/companies/${company.id}`}
                            >
                              {company.name}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {[
                                company.organizationNumber,
                                company.certificateNumber
                                  ? `Certifikat ${company.certificateNumber}`
                                  : null,
                                company.contactEmail,
                                company.phone,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Inga kontaktuppgifter angivna"}
                            </p>
                          </div>
                          {canManageServicePartners && (
                            <button
                              className={buttonClassName({ variant: "secondary" })}
                              type="button"
                              onClick={() => startEditingCompany(company)}
                            >
                              Redigera
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {canManageServicePartners && (
              <form className="grid gap-3" onSubmit={handleCompanySubmit}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {editingCompanyId ? "Redigera servicepartner" : "Bjud in servicepartner"}
                </h3>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Företag
                  <input
                    className={inputClassName}
                    name="name"
                    value={companyForm.name}
                    onChange={updateCompanyForm}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  E-post till serviceansvarig
                  <input
                    className={inputClassName}
                    name="email"
                    type="email"
                    value={companyForm.email}
                    onChange={updateCompanyForm}
                    required={!editingCompanyId}
                  />
                  {!editingCompanyId && (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      Den inbjudna personen blir serviceansvarig och kan komplettera företagsuppgifter senare.
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  {editingCompanyId && (
                    <button
                      className={buttonClassName({ variant: "secondary" })}
                      type="button"
                      onClick={resetCompanyForm}
                      disabled={isSavingCompany}
                    >
                      Avbryt
                    </button>
                  )}
                  <button
                    className={buttonClassName({ variant: "primary" })}
                    type="submit"
                    disabled={isSavingCompany}
                  >
                    {isSavingCompany
                      ? "Sparar..."
                      : editingCompanyId
                        ? "Spara ändringar"
                        : "Bjud in servicepartner"}
                  </button>
                </div>
              </form>
              )}
            </div>
          </Card>

          <Card className="mt-6 p-5">
            <SectionHeader
              title="Servicepartners - operativ översikt"
              subtitle="Relationer, certifiering och driftstatus per servicepartner."
            />
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {visibleServicePartners.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  Inga servicepartners har kopplats ännu.
                </p>
              ) : visibleServicePartners.map((company) => (
                <div
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                  key={company.id ?? "unlinked"}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {company.id ? (
                        <Link
                          className="font-semibold text-slate-950 underline-offset-4 hover:underline dark:text-slate-100"
                          href={`/dashboard/contractors/companies/${company.id}`}
                        >
                          {company.name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-slate-950 dark:text-slate-100">
                          {company.name}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {company.id
                          ? "Aggregat tilldelade servicepartnern"
                          : "Saknar servicepartnerrelation"}
                      </p>
                    </div>
                    {company.certificationWarnings > 0 ? (
                      <Badge variant="warning">
                        {company.certificationWarnings} certifieringsvarning
                      </Badge>
                    ) : (
                      <Badge variant="success">Certifiering OK</Badge>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <CompanyMetric
                      label="Aggregat"
                      value={company.assignedInstallationsCount}
                    />
                    <CompanyMetric
                      label="Försenade"
                      tone={company.overdueInspections > 0 ? "danger" : "neutral"}
                      value={company.overdueInspections}
                    />
                    <CompanyMetric
                      label="Inom 30 dagar"
                      tone={company.dueSoonInspections > 0 ? "warning" : "neutral"}
                      value={company.dueSoonInspections}
                    />
                    <CompanyMetric
                      label="Hög risk"
                      tone={company.highRiskInstallations > 0 ? "warning" : "neutral"}
                      value={company.highRiskInstallations}
                    />
                    <CompanyMetric
                      label="Läckage i år"
                      tone={company.leakageEventsCount > 0 ? "warning" : "neutral"}
                      value={company.leakageEventsCount}
                    />
                    <CompanyMetric
                      label="Senaste aktivitet"
                      value={formatOptionalDateTime(company.latestActivityDate)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/*
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Servicekontakter / tekniker"
                subtitle="Valfria kontakter som kan användas för operativ uppföljning inom ett servicepartnerföretag."
              />
            </div>

            {data.contractors.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga servicekontakter har lagts till ännu."
                  description="Bjud in en primär kontakt när servicepartnerföretaget ska kunna logga in och se sina tilldelade aggregat."
                  action={
                    <button
                      className={buttonClassName({ variant: "primary" })}
                      type="button"
                      onClick={openInviteModal}
                    >
                      Bjud in servicepartner
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <TableHeader>Kontakt/tekniker</TableHeader>
                      <TableHeader>Servicepartnerföretag</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Tilldelade aggregat</TableHeader>
                      <TableHeader>Försenade kontroller</TableHeader>
                      <TableHeader>Inom 30 dagar</TableHeader>
                      <TableHeader>Högriskaggregat</TableHeader>
                      <TableHeader>Certifiering</TableHeader>
                      <TableHeader>Läckage i år</TableHeader>
                      <TableHeader>Senaste aktivitet</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.servicePartnerCompanyMetrics.flatMap((company) =>
                      data.contractors
                        .filter((contractor) =>
                          company.id
                            ? contractor.servicePartnerCompany?.id === company.id
                            : !contractor.servicePartnerCompany
                        )
                        .map((contractor, contractorIndex) => (
                          <Fragment key={contractor.id}>
                            {contractorIndex === 0 && (
                              <tr className="bg-slate-50 dark:bg-slate-950">
                                <td
                                  className="px-4 py-3 text-sm font-semibold text-slate-950 dark:text-slate-100"
                                  colSpan={10}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>{company.name}</span>
                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                      {company.assignedInstallationsCount} aggregat via servicepartnerföretaget
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                      <tr
                        className="align-top hover:bg-slate-50 dark:hover:bg-slate-800"
                        key={contractor.id}
                      >
                        <TableCell>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline dark:text-slate-100"
                            href={`/dashboard/installations?contractorId=${contractor.id}`}
                          >
                            {contractor.name || contractor.email}
                          </Link>
                          {contractor.name && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {contractor.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <select
                            className="w-52 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={contractor.servicePartnerCompany?.id ?? ""}
                            onChange={(event) =>
                              void handleCompanyLink(contractor, event.target.value)
                            }
                            disabled={linkingContractorId === contractor.id}
                          >
                            <option value="">Ingen företagskoppling</option>
                            {data.servicePartnerCompanies.map((company) => (
                              <option key={company.id} value={company.id}>
                                {company.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <StatusBadge isActive={contractor.isActive} />
                        </TableCell>
                        <TableCell>{contractor.assignedInstallationsCount}</TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="danger"
                            count={contractor.overdueInspections}
                          />
                        </TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="warning"
                            count={contractor.dueSoonInspections}
                          />
                        </TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="warning"
                            count={contractor.highRiskInstallations}
                          />
                        </TableCell>
                        <TableCell>
                          <CertificationBadge status={contractor.certificationStatus} />
                        </TableCell>
                        <TableCell>{contractor.leakageEventsCount}</TableCell>
                        <TableCell>
                          {formatOptionalDateTime(contractor.latestActivityDate)}
                        </TableCell>
                      </tr>
                          </Fragment>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          */}
        </>
      )}

      {/*
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                  Bjud in servicepartnerföretag
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Ange e-post till företagets primära kontakt. Servicepartnern kan senare lägga till egna tekniker och servicekontakter.
                </p>
              </div>
              <button
                aria-label="Stäng"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                type="button"
                onClick={() => setIsInviteOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleInviteSubmit}>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Lägg gärna till servicepartnerföretaget i översikten först. Inbjudan skapar en primär kontakt med befintliga servicepartnerbehörigheter.
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Servicepartnerföretag
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={inviteServicePartnerCompanyId}
                  onChange={(event) =>
                    setInviteServicePartnerCompanyId(event.target.value)
                  }
                  required
                >
                  <option value="">Välj servicepartnerföretag</option>
                  {data?.servicePartnerCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                E-post till primär kontakt
                <input
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </label>

              {inviteError && (
                <p className="text-sm font-semibold text-red-700">{inviteError}</p>
              )}
              {inviteSuccess && (
                <p className="text-sm font-semibold text-green-700">{inviteSuccess}</p>
              )}
              {inviteLink && (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  Inbjudningslänk:{" "}
                  <code className="break-all text-slate-950 dark:text-slate-100">
                    {inviteLink}
                  </code>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={isSubmittingInvite}
                >
                  Stäng
                </button>
                <button
                  className={buttonClassName({ variant: "primary" })}
                  type="submit"
                  disabled={isSubmittingInvite || !inviteServicePartnerCompanyId}
                >
                  {isSubmittingInvite ? "Skickar..." : "Skicka inbjudan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      */}
    </main>
  )
}

function MetricCard({
  description,
  label,
  tone = "neutral",
  value,
}: {
  description: string
  label: string
  tone?: "danger" | "neutral" | "success" | "warning"
  value: number
}) {
  const accentClassName = {
    danger: "border-l-red-400",
    neutral: "border-l-blue-400",
    success: "border-l-emerald-400",
    warning: "border-l-amber-400",
  }[tone]
  const tooltipId = useId()

  return (
    <Card className={`relative border-l-4 p-5 ${accentClassName}`}>
      <div className="group absolute right-3 top-3">
        <button
          aria-describedby={tooltipId}
          aria-label={`Mer information om ${label}`}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          type="button"
        >
          i
        </button>
        <span
          className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          id={tooltipId}
          role="tooltip"
        >
          {description}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-100">
        {formatNumber(value)}
      </p>
    </Card>
  )
}

function ServicepartnersLoadingSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-live="polite" aria-busy="true">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card className="border-l-4 border-l-slate-200 p-5" key={index}>
            <div className="h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 h-8 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </Card>
        ))}
      </section>
      <Card className="p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  key={index}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 grid gap-3">
              <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-10 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <div className="h-5 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-36 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              key={index}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function CompanyMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string
  tone?: "danger" | "neutral" | "warning"
  value: number | string
}) {
  const valueClassName = {
    danger: "text-red-700 dark:text-red-300",
    neutral: "text-slate-950 dark:text-slate-100",
    warning: "text-amber-700 dark:text-amber-300",
  }[tone]

  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 font-semibold ${valueClassName}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  )
}

function formatOptionalDateTime(value: string | null) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value)
}
