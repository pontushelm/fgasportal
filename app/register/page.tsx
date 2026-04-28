"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import RegisterForm from "@/components/auth/register-form"

function RegisterContent() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite") || undefined

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      <h1>{inviteToken ? "Acceptera inbjudan" : "Registrera företag"}</h1>
      <RegisterForm inviteToken={inviteToken} />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 500, margin: "40px auto" }}>
          <h1>Registrera företag</h1>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}
