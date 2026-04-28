import { Resend } from "resend"

type SendInspectionReminderEmailInput = {
  to: string
  installationName: string
  location: string | null
  nextInspection: Date
  status: "DUE_SOON" | "OVERDUE"
  installationUrl: string
}

let resend: Resend | null = null

export async function sendInspectionReminderEmail({
  to,
  installationName,
  location,
  nextInspection,
  status,
  installationUrl,
}: SendInspectionReminderEmailInput) {
  const apiKey = requireEnv("RESEND_API_KEY")
  const from = requireEnv("REMINDER_FROM_EMAIL")
  const subjectStatus = status === "OVERDUE" ? "overdue" : "due soon"
  const locationLine = location ? `Location: ${location}\n` : ""
  const text = [
    `Inspection reminder: ${installationName}`,
    "",
    `The next inspection is ${subjectStatus}.`,
    "",
    `Installation: ${installationName}`,
    locationLine.trimEnd(),
    `Next inspection: ${formatDate(nextInspection)}`,
    `Status: ${status}`,
    "",
    "Open the installation and review the inspection schedule:",
    installationUrl,
  ]
    .filter(Boolean)
    .join("\n")

  resend ??= new Resend(apiKey)

  const result = await resend.emails.send({
    from,
    to,
    subject: `FgasPortal inspection ${subjectStatus}: ${installationName}`,
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
