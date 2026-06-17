import { Resend } from "resend"
import type { NotificationDigest } from "@/lib/notifications/build-notification-digest"

type SendInspectionReminderEmailInput = {
  to: string
  installationName: string
  location: string | null
  nextInspection: Date
  status: "DUE_SOON" | "OVERDUE"
  installationUrl: string
  actionQueueUrl: string
  servicePartnerCompanyName?: string | null
  servicePartnerCompanySummary?: {
    overdueCount: number
    dueSoonCount: number
  } | null
}

type SendContractorAssignmentEmailInput = {
  to: string
  contractorPortalUrl: string
  actionQueueUrl: string
  servicePartnerCompanyName?: string | null
}

type SendLeakNotificationEmailInput = {
  to: string
  installationName: string
  equipmentId: string | null
  propertyName: string | null
  eventDate: Date
  leakageAmountKg: number | null
  installationUrl: string
  actionQueueUrl: string
}

type OperationalDigestInspectionItem = {
  installationName: string
  location: string | null
  nextInspection: Date
  status: "DUE_SOON" | "OVERDUE"
  installationUrl: string
  servicePartnerCompanyName?: string | null
}

type OperationalDigestLeakItem = {
  installationName: string
  equipmentId: string | null
  propertyName: string | null
  eventDate: Date
  leakageAmountKg: number | null
  installationUrl: string
}

type SendOperationalDigestEmailInput = {
  to: string
  actionQueueUrl: string
  inspectionReminders?: OperationalDigestInspectionItem[]
  leakEvents?: OperationalDigestLeakItem[]
}

type SendNotificationDigestEmailInput = {
  to: string
  actionsUrl: string
  companyName: string
  digest: NotificationDigest
  notificationsUrl: string
}

type SendPasswordResetEmailInput = {
  to: string
  resetUrl: string
}

type SendInvitationEmailInput = {
  to: string
  inviteUrl: string
  companyName: string
  role?: "OWNER" | "ADMIN" | "MEMBER" | "CONTRACTOR"
}

type SendFeedbackEmailInput = {
  type: string
  title: string
  description: string
  pageUrl: string | null
  createdAt: Date
  user: {
    id: string | null
    name: string | null
    email: string | null
  }
  company: {
    id: string | null
    name: string | null
  }
}

type SendDemoRequestEmailInput = {
  name: string
  organization: string
  email: string
  phone: string | null
  message: string | null
  createdAt: Date
}

let resend: Resend | null = null

export async function sendInspectionReminderEmail({
  to,
  ...input
}: SendInspectionReminderEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const subjectStatus =
    input.status === "OVERDUE" ? "försenad kontroll" : "kontroll inom 30 dagar"
  const text = buildInspectionReminderEmailText(input)

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `Helm Polar: ${subjectStatus} - ${input.installationName}`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendOperationalDigestEmail({
  to,
  ...input
}: SendOperationalDigestEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const inspectionReminders = input.inspectionReminders ?? []
  const leakEvents = input.leakEvents ?? []
  const totalItems = inspectionReminders.length + leakEvents.length
  const text = buildOperationalDigestEmailText({
    ...input,
    inspectionReminders,
    leakEvents,
  })

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `Helm Polar – ${totalItems} aggregat kräver uppföljning`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendNotificationDigestEmail({
  to,
  ...input
}: SendNotificationDigestEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = buildNotificationDigestEmailText(input)

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: "Helm Polar: daglig sammanställning",
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export function buildNotificationDigestEmailText({
  actionsUrl,
  companyName,
  digest,
  notificationsUrl,
}: Omit<SendNotificationDigestEmailInput, "to">) {
  return [
    "Hej,",
    "",
    `Här kommer dagens sammanställning för ${companyName}.`,
    "",
    `Totalt att följa upp: ${digest.totalItems}`,
    "",
    formatDigestGroupForEmail("Kontroller", digest.inspections),
    "",
    formatDigestGroupForEmail("Certifikat", digest.certificates),
    "",
    formatDigestGroupForEmail("Årsrapporter", digest.reports),
    "",
    "Öppna notifieringar:",
    notificationsUrl,
    "",
    "Öppna åtgärder:",
    actionsUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")
}

export function buildOperationalDigestEmailText({
  actionQueueUrl,
  inspectionReminders = [],
  leakEvents = [],
}: Omit<SendOperationalDigestEmailInput, "to">) {
  const overdueCount = inspectionReminders.filter(
    (item) => item.status === "OVERDUE"
  ).length
  const dueSoonCount = inspectionReminders.filter(
    (item) => item.status === "DUE_SOON"
  ).length
  const summaryRows = [
    overdueCount > 0
      ? `• ${overdueCount} aggregat har försenad kontroll`
      : null,
    dueSoonCount > 0
      ? `• ${dueSoonCount} aggregat behöver kontroll inom 30 dagar`
      : null,
    leakEvents.length > 0
      ? `• ${leakEvents.length} nytt läckage har registrerats`
      : null,
  ].filter(Boolean)
  const inspectionRows = inspectionReminders.slice(0, 10).map((item) =>
    [
      `• ${item.installationName}`,
      item.location ? `Placering: ${item.location}` : null,
      `Status: ${item.status === "OVERDUE" ? "Försenad" : "Inom 30 dagar"}`,
      `Nästa kontroll: ${formatDate(item.nextInspection)}`,
      item.servicePartnerCompanyName
        ? `Servicepartner: ${item.servicePartnerCompanyName}`
        : null,
      item.installationUrl,
    ]
      .filter(Boolean)
      .join(" | ")
  )
  const leakRows = leakEvents.slice(0, 10).map((item) =>
    [
      `• ${item.installationName}`,
      item.equipmentId ? `Aggregat-ID: ${item.equipmentId}` : null,
      item.propertyName ? `Fastighet: ${item.propertyName}` : null,
      `Händelsedatum: ${formatDate(item.eventDate)}`,
      item.leakageAmountKg != null
        ? `Läckagemängd: ${formatNumber(item.leakageAmountKg)} kg`
        : "Läckagemängd: Ej angiven",
      item.installationUrl,
    ]
      .filter(Boolean)
      .join(" | ")
  )

  return [
    "Hej,",
    "",
    "Följande kräver uppföljning:",
    "",
    ...summaryRows,
    "",
    inspectionRows.length > 0 ? "Kontroller:" : null,
    ...inspectionRows,
    inspectionReminders.length > inspectionRows.length
      ? `Ytterligare ${inspectionReminders.length - inspectionRows.length} kontrollpunkter finns i Helm Polar.`
      : null,
    "",
    leakRows.length > 0 ? "Läckage:" : null,
    ...leakRows,
    leakEvents.length > leakRows.length
      ? `Ytterligare ${leakEvents.length - leakRows.length} läckage finns i Helm Polar.`
      : null,
    "",
    "Öppna Helm Polar för att se detaljer och åtgärder:",
    actionQueueUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildInspectionReminderEmailText({
  installationName,
  location,
  nextInspection,
  status,
  installationUrl,
  actionQueueUrl,
  servicePartnerCompanyName,
  servicePartnerCompanySummary,
}: Omit<SendInspectionReminderEmailInput, "to">) {
  const subjectStatus =
    status === "OVERDUE" ? "försenad kontroll" : "kontroll inom 30 dagar"
  const actionLinkLabel =
    status === "OVERDUE"
      ? "Visa försenade kontroller i åtgärdskön:"
      : "Visa kommande kontroller i åtgärdskön:"
  const servicePartnerSummaryText =
    servicePartnerCompanyName && servicePartnerCompanySummary
      ? `För ${servicePartnerCompanyName} finns ${servicePartnerCompanySummary.overdueCount} försenade kontroller och ${servicePartnerCompanySummary.dueSoonCount} kommande kontroller kopplade till era servicekontakter.`
      : null

  return [
    `Kontrollpåminnelse: ${installationName}`,
    "",
    `Ett aggregat har ${subjectStatus} i Helm Polar.`,
    servicePartnerCompanyName
      ? `Påminnelsen gäller aggregat som är tilldelade dig som servicekontakt hos ${servicePartnerCompanyName}.`
      : null,
    servicePartnerSummaryText,
    "",
    `Aggregat: ${installationName}`,
    location ? `Placering: ${location}` : null,
    `Nästa kontroll: ${formatDate(nextInspection)}`,
    `Status: ${status === "OVERDUE" ? "Försenad" : "Inom 30 dagar"}`,
    "",
    actionLinkLabel,
    actionQueueUrl,
    "",
    "Öppna aggregatet för mer information:",
    installationUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function sendContractorAssignmentEmail({
  to,
  ...input
}: SendContractorAssignmentEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = buildContractorAssignmentEmailText(input)

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: "Helm Polar: nya tilldelade aggregat",
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export function buildContractorAssignmentEmailText({
  contractorPortalUrl,
  actionQueueUrl,
  servicePartnerCompanyName,
}: Omit<SendContractorAssignmentEmailInput, "to">) {
  return [
    "Hej,",
    "",
    servicePartnerCompanyName
      ? `Ett eller flera aggregat har tilldelats dig som servicekontakt hos ${servicePartnerCompanyName}.`
      : "Du har tilldelats ett eller flera aggregat i Helm Polar.",
    "",
    "Logga in för att se tilldelade aggregat, kontrollstatus och eventuella kommande åtgärder.",
    "",
    "Gå till åtgärdskön:",
    actionQueueUrl,
    "",
    "Öppna servicevyn:",
    contractorPortalUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")
}

export async function sendLeakNotificationEmail({
  to,
  installationName,
  equipmentId,
  propertyName,
  eventDate,
  leakageAmountKg,
  installationUrl,
  actionQueueUrl,
}: SendLeakNotificationEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = [
    `Läckage registrerat: ${installationName}`,
    "",
    "Ett läckage har registrerats i Helm Polar och bör följas upp i compliancearbetet.",
    "",
    `Aggregat: ${installationName}`,
    equipmentId ? `Aggregat-ID / märkning: ${equipmentId}` : null,
    propertyName ? `Fastighet: ${propertyName}` : null,
    `Händelsedatum: ${formatDate(eventDate)}`,
    leakageAmountKg != null
      ? `Läckagemängd: ${formatNumber(leakageAmountKg)} kg`
      : "Läckagemängd: Ej angiven",
    "",
    "Se läckageuppföljning i åtgärdskön:",
    actionQueueUrl,
    "",
    "Öppna aggregatet för att granska händelsen:",
    installationUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ]
    .filter(Boolean)
    .join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `Helm Polar: läckage registrerat - ${installationName}`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = [
    "Hej,",
    "",
    "Vi har tagit emot en begäran om att återställa lösenordet till ditt Helm Polar-konto.",
    "",
    "Återställ lösenordet via länken nedan. Länken gäller i 1 timme och kan bara användas en gång.",
    "",
    resetUrl,
    "",
    "Om du inte begärde detta kan du bortse från meddelandet.",
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: "Återställ ditt lösenord i Helm Polar",
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendInvitationEmail({
  to,
  inviteUrl,
  companyName,
  role,
}: SendInvitationEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const isServicePartnerInvite = role === "CONTRACTOR"
  const text = [
    "Hej,",
    "",
    isServicePartnerInvite
      ? `${companyName} har bjudit in ert servicepartnerföretag till Helm Polar.`
      : `Du har blivit inbjuden till ${companyName} i Helm Polar.`,
    ...(isServicePartnerInvite
      ? [
          "",
          "Skapa ett konto som primär kontakt. Tekniker och servicekontakter kan hanteras mer detaljerat senare.",
        ]
      : []),
    "",
    "Skapa ditt konto via länken nedan:",
    "",
    inviteUrl,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: isServicePartnerInvite
      ? `Inbjudan som servicepartner till ${companyName}`
      : `Inbjudan till ${companyName} i Helm Polar`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendFeedbackEmail(input: SendFeedbackEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const to = getOptionalEnv("FEEDBACK_TO_EMAIL") ?? getOptionalEnv("SUPPORT_EMAIL")

  if (!to) {
    throw new Error("FEEDBACK_TO_EMAIL or SUPPORT_EMAIL is required")
  }

  const text = [
    "Ny feedback i Helm Polar",
    "",
    `Typ: ${input.type}`,
    `Rubrik: ${input.title}`,
    `Tidpunkt: ${input.createdAt.toISOString()}`,
    "",
    "Beskrivning:",
    input.description,
    "",
    input.pageUrl ? `Sida: ${input.pageUrl}` : "Sida: Saknas",
    "",
    "Användare:",
    `ID: ${input.user.id ?? "Saknas"}`,
    `Namn: ${input.user.name ?? "Saknas"}`,
    `E-post: ${input.user.email ?? "Saknas"}`,
    "",
    "Företag:",
    `ID: ${input.company.id ?? "Saknas"}`,
    `Namn: ${input.company.name ?? "Saknas"}`,
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `Helm Polar feedback: ${input.title}`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendDemoRequestEmail(input: SendDemoRequestEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const to = requireEnv("DEMO_REQUEST_TO_EMAIL")

  const text = [
    "Ny demo-förfrågan i Helm Polar",
    "",
    `Namn: ${input.name}`,
    `Organisation: ${input.organization}`,
    `E-post: ${input.email}`,
    `Telefon: ${input.phone ?? "Ej angivet"}`,
    `Tidpunkt: ${input.createdAt.toISOString()}`,
    "",
    "Meddelande:",
    input.message ?? "Ej angivet",
    "",
    "Vänliga hälsningar,",
    "Helm Polar",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    replyTo: input.email,
    subject: `Helm Polar demo-förfrågan: ${input.organization}`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function getOptionalEnv(name: string) {
  const value = process.env[name]
  return value?.trim() || null
}

function formatDigestGroupForEmail(
  title: string,
  group: NotificationDigest[keyof NotificationDigest]
) {
  if (typeof group === "number") return ""

  if (group.items.length === 0) {
    return `${title}: Inga aktuella poster`
  }

  return [
    `${title}: ${group.count} poster`,
    ...group.items.map((item) => `- ${item.label}: ${item.count}`),
  ].join("\n")
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
