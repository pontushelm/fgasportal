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
      title={inviteToken ? "Acceptera inbjudan" : "Skapa organisationskonto"}
      subtitle={
        inviteToken
          ? "Skapa en användare för den inbjudna organisationen."
          : "Skapa ett konto för organisationens F-gasregister."
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
        <AuthShell title="Skapa organisationskonto" subtitle="Skapa ett konto för organisationens F-gasregister.">
          <p className="text-sm text-slate-600">Laddar...</p>
        </AuthShell>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}
