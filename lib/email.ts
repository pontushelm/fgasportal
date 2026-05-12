import { Resend } from "resend"

type SendInspectionReminderEmailInput = {
  to: string
  installationName: string
  location: string | null
  nextInspection: Date
  status: "DUE_SOON" | "OVERDUE"
  installationUrl: string
  actionQueueUrl: string
}

type SendContractorAssignmentEmailInput = {
  to: string
  contractorPortalUrl: string
  actionQueueUrl: string
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

type SendPasswordResetEmailInput = {
  to: string
  resetUrl: string
}

type SendInvitationEmailInput = {
  to: string
  inviteUrl: string
  companyName: string
}

let resend: Resend | null = null

export async function sendInspectionReminderEmail({
  to,
  installationName,
  location,
  nextInspection,
  status,
  installationUrl,
  actionQueueUrl,
}: SendInspectionReminderEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const subjectStatus =
    status === "OVERDUE" ? "försenad kontroll" : "kontroll inom 30 dagar"
  const actionLinkLabel =
    status === "OVERDUE"
      ? "Visa försenade kontroller i åtgärdskön:"
      : "Visa kommande kontroller i åtgärdskön:"
  const text = [
    `Kontrollpåminnelse: ${installationName}`,
    "",
    `Ett aggregat har ${subjectStatus} i FgasPortal.`,
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
    "FgasPortal",
  ]
    .filter(Boolean)
    .join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `FgasPortal: ${subjectStatus} - ${installationName}`,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

export async function sendContractorAssignmentEmail({
  to,
  contractorPortalUrl,
  actionQueueUrl,
}: SendContractorAssignmentEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = [
    "Hej,",
    "",
    "Du har tilldelats ett eller flera aggregat i FgasPortal.",
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
    "FgasPortal",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: "FgasPortal: nya tilldelade aggregat",
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
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
    "Ett läckage har registrerats i FgasPortal och bör följas upp i compliancearbetet.",
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
    "FgasPortal",
  ]
    .filter(Boolean)
    .join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `FgasPortal: läckage registrerat - ${installationName}`,
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
    "Vi har tagit emot en begäran om att återställa lösenordet till ditt FgasPortal-konto.",
    "",
    "Återställ lösenordet via länken nedan. Länken gäller i 1 timme och kan bara användas en gång.",
    "",
    resetUrl,
    "",
    "Om du inte begärde detta kan du bortse från meddelandet.",
    "",
    "Vänliga hälsningar,",
    "FgasPortal",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: "Återställ ditt lösenord i FgasPortal",
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
}: SendInvitationEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const text = [
    "Hej,",
    "",
    `Du har blivit inbjuden till ${companyName} i FgasPortal.`,
    "",
    "Skapa ditt konto via länken nedan:",
    "",
    inviteUrl,
    "",
    "Vänliga hälsningar,",
    "FgasPortal",
  ].join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `Inbjudan till ${companyName} i FgasPortal`,
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
