"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, Card, PageHeader, PasswordInput, SectionHeader, Toast, type ToastMessage } from "@/components/ui"
import { ThemeSelect } from "@/components/theme/theme-select"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
  email?: string | null
  name?: string | null
  phone?: string | null
  certificationNumber?: string | null
  certificationIssuer?: string | null
  certificationValidUntil?: string | null
  certificationCategory?: string | null
  notifyAssignmentEmails: boolean
  notifyInspectionReminderEmails: boolean
  notifyDocumentEmails: boolean
  notifyAnnualReportDeadlineEmails: boolean
  notifyLeakEmails: boolean
}

type NotificationPreferences = Pick<
  CurrentUser,
  | "notifyAssignmentEmails"
  | "notifyInspectionReminderEmails"
  | "notifyDocumentEmails"
  | "notifyAnnualReportDeadlineEmails"
  | "notifyLeakEmails"
>

type NotificationPreferenceGroup = {
  title: string
  keys: Array<keyof NotificationPreferences>
}

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  notifyAssignmentEmails: "Nya tilldelningar",
  notifyInspectionReminderEmails: "Kommande och försenade kontroller",
  notifyDocumentEmails: "Dokument kopplade till aggregat",
  notifyAnnualReportDeadlineEmails: "Årsrapport redo för signering",
  notifyLeakEmails: "Nya läckage",
}

const notificationDescriptions: Record<keyof NotificationPreferences, string> = {
  notifyAssignmentEmails:
    "Samlad e-post när aggregat eller åtkomst tilldelas dig som servicepartner.",
  notifyInspectionReminderEmails:
    "Samlad e-post om kontroller som är försenade eller behöver göras inom 30 dagar.",
  notifyDocumentEmails:
    "E-post när nya dokument kopplas till aggregat.",
  notifyAnnualReportDeadlineEmails:
    "E-post inför årsrapportering och signering.",
  notifyLeakEmails:
    "Samlad e-post när nya läckage registreras.",
}

export default function SettingsPageClient() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [certificationNumber, setCertificationNumber] = useState("")
  const [certificationIssuer, setCertificationIssuer] = useState("")
  const [certificationValidUntil, setCertificationValidUntil] = useState("")
  const [certificationCategory, setCertificationCategory] = useState("")
  const [notifications, setNotifications] =
    useState<NotificationPreferences | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)
  const [error, setError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [notificationError, setNotificationError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchCurrentUser() {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta dina inställningar")
        setIsLoading(false)
        return
      }

      const user: CurrentUser = await response.json()

      if (!isMounted) return
      setCurrentUser(user)
      setName(user.name || "")
      setPhone(user.phone || "")
      setCertificationNumber(user.certificationNumber || "")
      setCertificationIssuer(user.certificationIssuer || "")
      setCertificationValidUntil(toDateInputValue(user.certificationValidUntil))
      setCertificationCategory(user.certificationCategory || "")
      setNotifications(extractNotificationPreferences(user))
      setIsLoading(false)
    }

    void fetchCurrentUser()

    return () => {
      isMounted = false
    }
  }, [router])

  const notificationGroups = useMemo(() => {
    if (!currentUser) return []

    if (currentUser.role === "CONTRACTOR") {
      return [
        {
          title: "Operativ uppföljning",
          keys: ["notifyInspectionReminderEmails"],
        },
        {
          title: "Servicepartner och samarbete",
          keys: ["notifyAssignmentEmails"],
        },
      ] satisfies Array<NotificationPreferenceGroup>
    }

    if (currentUser.role === "MEMBER") {
      return [
        {
          title: "Operativ uppföljning",
          keys: ["notifyInspectionReminderEmails"],
        },
      ] satisfies Array<NotificationPreferenceGroup>
    }

    return [
      {
        title: "Operativ uppföljning",
        keys: ["notifyInspectionReminderEmails", "notifyLeakEmails"],
      },
      {
        title: "Rapportering",
        keys: ["notifyAnnualReportDeadlineEmails"],
      },
    ] satisfies Array<NotificationPreferenceGroup>
  }, [currentUser])

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setIsSavingProfile(true)

    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name,
        phone,
        certificationNumber,
        certificationIssuer,
        certificationValidUntil,
        certificationCategory,
      }),
    })

    const result: {
      error?: string
      name?: string
      phone?: string | null
      certificationNumber?: string | null
      certificationIssuer?: string | null
      certificationValidUntil?: string | null
      certificationCategory?: string | null
    } = await response.json()

    if (!response.ok) {
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte spara profilen.",
      })
      setIsSavingProfile(false)
      return
    }

    setCurrentUser((user) =>
      user
        ? {
            ...user,
            name: result.name || name,
            phone: result.phone ?? phone,
            certificationNumber:
              result.certificationNumber ?? certificationNumber,
            certificationIssuer:
              result.certificationIssuer ?? certificationIssuer,
            certificationValidUntil:
              result.certificationValidUntil ?? certificationValidUntil,
            certificationCategory:
              result.certificationCategory ?? certificationCategory,
          }
        : user
    )
    setToast({
      type: "success",
      title: "Klart",
      message: "Profilen har sparats.",
    })
    setIsSavingProfile(false)
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPasswordError("")

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("Lösenorden matchar inte")
      return
    }

    setIsSavingPassword(true)

    const response = await fetch("/api/user/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(passwordForm),
    })

    const result: { error?: string } = await response.json()

    if (!response.ok) {
      setPasswordError(result.error || "Kunde inte byta lösenord")
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte byta lösenord.",
      })
      setIsSavingPassword(false)
      return
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    })
    setToast({
      type: "success",
      title: "Klart",
      message: "Lösenordet har uppdaterats.",
    })
    setIsSavingPassword(false)
  }

  async function handleNotificationSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!notifications) return

    setNotificationError("")
    setIsSavingNotifications(true)

    const response = await fetch("/api/user/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(notifications),
    })

    const result: Partial<NotificationPreferences> & { error?: string } =
      await response.json()

    if (!response.ok) {
      setNotificationError(
        result.error || "Kunde inte spara notifieringsinställningar"
      )
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte spara notifieringsinställningar.",
      })
      setIsSavingNotifications(false)
      return
    }

    setNotifications(result as NotificationPreferences)
    setCurrentUser((user) =>
      user ? { ...user, ...(result as NotificationPreferences) } : user
    )
    setToast({
      type: "success",
      title: "Klart",
      message: "Notifieringar har sparats.",
    })
    setIsSavingNotifications(false)
  }

  function updatePasswordField(name: string, value: string) {
    setPasswordForm((form) => ({
      ...form,
      [name]: value,
    }))
  }

  function updateNotificationPreference(
    key: keyof NotificationPreferences,
    value: boolean
  ) {
    setNotifications((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        title="Mina inställningar"
        subtitle="Hantera profil, säkerhet, utseende och notifieringar för ditt eget användarkonto."
      />

      {isLoading && <SettingsLoadingSkeleton />}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && currentUser && notifications && (
        <div className="mt-8 grid gap-6">
          <Card className="p-5">
            <SectionHeader
              title="Profil"
              subtitle="Uppdatera ditt namn. E-post och roll är låsta i den här versionen."
            />
            <form className="mt-5 grid gap-4" onSubmit={handleProfileSubmit}>
              <label className={labelClassName}>
                Namn
                <input
                  className={inputClassName}
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label className={labelClassName}>
                Telefon
                <input
                  className={inputClassName}
                  inputMode="tel"
                  name="phone"
                  placeholder="070-123 45 67"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Valfritt. Används som kontaktuppgift i årsrapporter.
                </span>
              </label>
              {currentUser.role === "CONTRACTOR" && (
                <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      Personlig certifiering
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Valfria uppgifter som används för att visa teknikerbehörighet vid händelser och rapportunderlag.
                    </p>
                  </div>
                  <label className={labelClassName}>
                    Personligt certifikat nr
                    <input
                      className={inputClassName}
                      name="certificationNumber"
                      value={certificationNumber}
                      onChange={(event) =>
                        setCertificationNumber(event.target.value)
                      }
                    />
                  </label>
                  <label className={labelClassName}>
                    Certifieringsorgan
                    <input
                      className={inputClassName}
                      name="certificationIssuer"
                      value={certificationIssuer}
                      onChange={(event) =>
                        setCertificationIssuer(event.target.value)
                      }
                    />
                  </label>
                  <label className={labelClassName}>
                    Giltigt till
                    <input
                      className={inputClassName}
                      name="certificationValidUntil"
                      type="date"
                      value={certificationValidUntil}
                      onChange={(event) =>
                        setCertificationValidUntil(event.target.value)
                      }
                    />
                  </label>
                  <label className={labelClassName}>
                    Certifikatstyp/kategori
                    <input
                      className={inputClassName}
                      name="certificationCategory"
                      value={certificationCategory}
                      onChange={(event) =>
                        setCertificationCategory(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyItem label="E-post" value={currentUser.email || "-"} />
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Roll
                  </dt>
                  <dd className="mt-2">
                    <Badge variant="neutral">
                      {formatRoleLabel(currentUser.role)}
                    </Badge>
                  </dd>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={isSavingProfile}
                  type="submit"
                  variant="primary"
                >
                  {isSavingProfile ? "Sparar..." : "Spara profil"}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="Säkerhet"
              subtitle="Byt lösenord genom att först ange ditt nuvarande lösenord."
            />
            <form
              className="mt-5 grid max-w-xl gap-4"
              onSubmit={handlePasswordSubmit}
            >
              <label className={labelClassName}>
                Nuvarande lösenord
                <PasswordInput
                  autoComplete="current-password"
                  className={inputClassName}
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    updatePasswordField(event.target.name, event.target.value)
                  }
                  required
                />
              </label>
              <label className={labelClassName}>
                Nytt lösenord
                <PasswordInput
                  autoComplete="new-password"
                  className={inputClassName}
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    updatePasswordField(event.target.name, event.target.value)
                  }
                  required
                />
              </label>
              <label className={labelClassName}>
                Bekräfta nytt lösenord
                <PasswordInput
                  autoComplete="new-password"
                  className={inputClassName}
                  name="confirmNewPassword"
                  value={passwordForm.confirmNewPassword}
                  onChange={(event) =>
                    updatePasswordField(event.target.name, event.target.value)
                  }
                  required
                />
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Minst 8 tecken med stor bokstav, liten bokstav och siffra.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={isSavingPassword}
                  type="submit"
                  variant="primary"
                >
                  {isSavingPassword ? "Sparar..." : "Byt lösenord"}
                </Button>
                {passwordError && (
                  <p className="text-sm font-semibold text-red-700">
                    {passwordError}
                  </p>
                )}
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="Utseende"
              subtitle="Välj om FgasPortal ska visas i ljust eller mörkt läge."
            />
            <div className="mt-5">
              <ThemeSelect />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="Notifieringar"
              subtitle="Välj vilka notifieringar du vill få via e-post."
            />
            <form className="mt-5 grid gap-4" onSubmit={handleNotificationSubmit}>
              {notificationGroups.length > 0 ? (
                notificationGroups.map((group) => (
                  <section
                    className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                    key={group.title}
                  >
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      {group.title}
                    </h3>
                    <div className="grid gap-3">
                      {group.keys.map((key) => (
                        <NotificationToggle
                          checked={notifications[key]}
                          description={notificationDescriptions[key]}
                          key={key}
                          label={notificationLabels[key]}
                          onChange={(value) =>
                            updateNotificationPreference(key, value)
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Det finns inga e-postnotiser att ställa in för din roll just nu.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={isSavingNotifications}
                  type="submit"
                  variant="primary"
                >
                  {isSavingNotifications
                    ? "Sparar..."
                    : "Spara notifieringar"}
                </Button>
                {notificationError && (
                  <p className="text-sm font-semibold text-red-700">
                    {notificationError}
                  </p>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
    </main>
  )
}

function NotificationToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-slate-950 dark:text-slate-100">
          {label}
        </span>
        <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
          {description}
        </span>
      </span>
    </label>
  )
}

function SettingsLoadingSkeleton() {
  return (
    <div className="mt-8 grid gap-6" aria-live="polite" aria-busy="true">
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <Card className="p-5" key={sectionIndex}>
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="mt-5 grid gap-4">
            {Array.from({ length: sectionIndex === 0 ? 4 : 3 }).map(
              (__, index) => (
                <div
                  className="h-14 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-900"
                  key={index}
                />
              )
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

function ReadOnlyItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </dd>
    </div>
  )
}

function extractNotificationPreferences(
  user: CurrentUser
): NotificationPreferences {
  return {
    notifyAssignmentEmails: user.notifyAssignmentEmails,
    notifyInspectionReminderEmails: user.notifyInspectionReminderEmails,
    notifyDocumentEmails: user.notifyDocumentEmails,
    notifyAnnualReportDeadlineEmails: user.notifyAnnualReportDeadlineEmails,
    notifyLeakEmails: user.notifyLeakEmails,
  }
}

function toDateInputValue(value?: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

const labelClassName =
  "grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
