"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AuthShell } from "@/components/auth/auth-shell"
import RegisterForm from "@/components/auth/register-form"

function RegisterContent() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite") || undefined

  return (
    <AuthShell
      title={inviteToken ? "Acceptera inbjudan" : "Pilotregistrering"}
      subtitle={
        inviteToken
          ? "Skapa en användare för den inbjudna organisationen."
          : "Polar är för närvarande i pilotfas. Nya organisationer aktiveras via inbjudan eller efter dialog."
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
