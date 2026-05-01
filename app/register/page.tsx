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
      title={inviteToken ? "Acceptera inbjudan" : "Skapa konto"}
      subtitle={
        inviteToken
          ? "Skapa en användare för den inbjudna organisationen."
          : "Kom igång med FgasPortal."
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
        <AuthShell title="Skapa konto" subtitle="Kom igång med FgasPortal.">
          <p className="text-sm text-slate-600">Laddar...</p>
        </AuthShell>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}
