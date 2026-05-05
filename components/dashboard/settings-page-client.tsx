"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, Card, PageHeader, PasswordInput, SectionHeader } from "@/components/ui"
import { ThemeSelect } from "@/components/theme/theme-select"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
  email?: string | null
  name?: string | null
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

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  notifyAssignmentEmails: "Tilldelning av aggregat",
  notifyInspectionReminderEmails: "Kommande och försenade kontroller",
  notifyDocumentEmails: "Dokument kopplade till aggregat",
  notifyAnnualReportDeadlineEmails: "Kommande deadline för årsrapport",
  notifyLeakEmails: "Nya läckage",
}

const notificationDescriptions: Record<keyof NotificationPreferences, string> = {
  notifyAssignmentEmails:
    "E-post när du som servicepartner får nya tilldelade aggregat.",
  notifyInspectionReminderEmails:
    "E-post om kontroller som är försenade eller behöver göras inom 30 dagar.",
  notifyDocumentEmails:
    "Framtidsklar inställning för dokumentnotiser kopplade till aggregat.",
  notifyAnnualReportDeadlineEmails:
    "Framtidsklar inställning för påminnelser inför årsrapportering.",
  notifyLeakEmails:
    "Framtidsklar inställning för notiser om registrerade läckage.",
}

export default function SettingsPageClient() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [name, setName] = useState("")
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
  const [profileMessage, setProfileMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [notificationMessage, setNotificationMessage] = useState("")
  const [notificationError, setNotificationError] = useState("")

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
      setNotifications(extractNotificationPreferences(user))
      setIsLoading(false)
    }

    void fetchCurrentUser()

    return () => {
      isMounted = false
    }
  }, [router])

  const visibleNotificationKeys = useMemo(() => {
    if (!currentUser) return []

    if (currentUser.role === "CONTRACTOR") {
      return [
        "notifyAssignmentEmails",
        "notifyInspectionReminderEmails",
        "notifyDocumentEmails",
      ] satisfies Array<keyof NotificationPreferences>
    }

    return [
      "notifyInspectionReminderEmails",
      "notifyDocumentEmails",
      "notifyAnnualReportDeadlineEmails",
      "notifyLeakEmails",
    ] satisfies Array<keyof NotificationPreferences>
  }, [currentUser])

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault()
    setProfileMessage("")
    setError("")
    setIsSavingProfile(true)

    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ name }),
    })

    const result: { error?: string; name?: string } = await response.json()

    if (!response.ok) {
      setError(result.error || "Kunde inte spara profilen")
      setIsSavingProfile(false)
      return
    }

    setCurrentUser((user) => (user ? { ...user, name: result.name || name } : user))
    setProfileMessage("Profilen har sparats.")
    setIsSavingProfile(false)
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPasswordError("")
    setPasswordMessage("")

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
      setIsSavingPassword(false)
      return
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    })
    setPasswordMessage("Lösenordet har uppdaterats.")
    setIsSavingPassword(false)
  }

  async function handleNotificationSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!notifications) return

    setNotificationError("")
    setNotificationMessage("")
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
      setIsSavingNotifications(false)
      return
    }

    setNotifications(result as NotificationPreferences)
    setCurrentUser((user) =>
      user ? { ...user, ...(result as NotificationPreferences) } : user
    )
    setNotificationMessage("Notifieringar har sparats.")
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
        eyebrow="Personligt"
        title="Mina inställningar"
        subtitle="Hantera profil, säkerhet, utseende och notifieringar för ditt eget användarkonto."
      />

      {isLoading && (
        <p className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Laddar inställningar...
        </p>
      )}
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
                {profileMessage && (
                  <p className="text-sm font-semibold text-emerald-700">
                    {profileMessage}
                  </p>
                )}
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
                {passwordMessage && (
                  <p className="text-sm font-semibold text-emerald-700">
                    {passwordMessage}
                  </p>
                )}
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
              subtitle="Välj vilka e-postnotiser du vill få för din roll."
            />
            <form className="mt-5 grid gap-4" onSubmit={handleNotificationSubmit}>
              {visibleNotificationKeys.map((key) => (
                <NotificationToggle
                  checked={notifications[key]}
                  description={notificationDescriptions[key]}
                  key={key}
                  label={notificationLabels[key]}
                  onChange={(value) => updateNotificationPreference(key, value)}
                />
              ))}
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
                {notificationMessage && (
                  <p className="text-sm font-semibold text-emerald-700">
                    {notificationMessage}
                  </p>
                )}
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

const labelClassName =
  "grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
