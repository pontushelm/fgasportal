import { NextResponse } from "next/server"
import { sendDemoRequestEmail } from "@/lib/email"

type DemoRequestBody = {
  email?: unknown
  message?: unknown
  name?: unknown
  organization?: unknown
  phone?: unknown
}

export async function POST(request: Request) {
  let body: DemoRequestBody

  try {
    body = (await request.json()) as DemoRequestBody
  } catch {
    return NextResponse.json(
      { error: "Kunde inte läsa demo-förfrågan." },
      { status: 400 }
    )
  }

  const name = normalizeText(body.name)
  const organization = normalizeText(body.organization)
  const email = normalizeText(body.email)
  const phone = normalizeText(body.phone)
  const message = normalizeText(body.message)

  if (!name || !organization || !email) {
    return NextResponse.json(
      { error: "Namn, organisation och e-post krävs." },
      { status: 400 }
    )
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Ange en giltig e-postadress." },
      { status: 400 }
    )
  }

  try {
    await sendDemoRequestEmail({
      name,
      organization,
      email,
      phone,
      message,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("Failed to send demo request email", error)
    return NextResponse.json(
      { error: "Kunde inte skicka demo-förfrågan." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
