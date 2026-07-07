"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AuthShell } from "@/components/auth/auth-shell"
import RegisterForm from "@/components/auth/register-form"
import { DemoRequestButton } from "@/components/demo-request-button"

function RegisterContent() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite") || undefined
  const isInternalRegistration = searchParams.get("internal") === "1"

  if (!inviteToken && !isInternalRegistration) {
    return (
      <AuthShell
        title="Polar är för närvarande i pilotfas"
        subtitle="Registrering sker via personlig inbjudan eller efter godkänd pilotansökan."
      >
        <div className="grid gap-4">
          <p className="text-sm leading-6 text-slate-600">
            Nya organisationer aktiveras under pilotfasen efter dialog med Helm
            Systems. Har du fått en inbjudan använder du länken i mejlet.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <DemoRequestButton className={primaryLinkClassName}>
              Ansök om pilotplats
            </DemoRequestButton>
            <Link className={secondaryLinkClassName} href="/">
              Till startsidan
            </Link>
          </div>
          <Link
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            href="/login"
          >
            Har du redan konto? Logga in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={inviteToken ? "Acceptera inbjudan" : "Intern registrering"}
      subtitle={
        inviteToken
          ? "Skapa en användare för den inbjudna organisationen."
          : "Endast för Helm Systems-administratörer."
      }
    >
      <RegisterForm inviteToken={inviteToken} />
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Pilotregistrering" subtitle="Polar är för närvarande i pilotfas.">
          <p className="text-sm text-slate-600">Laddar...</p>
        </AuthShell>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
