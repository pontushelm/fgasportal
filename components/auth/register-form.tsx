"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, type RegisterFormData } from "@/lib/validations"

type RegisterFormFields = RegisterFormData & {
  companyName?: string
  orgNumber?: string
  companyEmail?: string
  companyAddress?: string
  companyPhone?: string
}

type InviteContext = {
  email: string
  role: string
  companyName: string
  expiresAt: string
}

export default function RegisterForm({ inviteToken }: { inviteToken?: string }) {
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null)
  const [inviteError, setInviteError] = useState("")
  const [submitMessage, setSubmitMessage] = useState("")
  const [submitError, setSubmitError] = useState("")
  const isInviteMode = Boolean(inviteToken)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormFields>({
    resolver: zodResolver(registerSchema)
  })

  useEffect(() => {
    if (!inviteToken) return

    let isMounted = true

    async function fetchInvite() {
      const res = await fetch(`/api/invitations/${inviteToken}`)
      const result = await res.json()

      if (!isMounted) return

      if (!res.ok) {
        setInviteError(result.error || "Inbjudan är ogiltig")
        return
      }

      setInviteContext(result)
      setValue("inviteToken", inviteToken)
      setValue("userEmail", result.email)
    }

    void fetchInvite()

    return () => {
      isMounted = false
    }
  }, [inviteToken, setValue])

  async function onSubmit(data: RegisterFormFields) {
    setSubmitMessage("")
    setSubmitError("")

    const payload = isInviteMode
      ? {
          inviteToken,
          userName: data.userName,
          userEmail: data.userEmail,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }
      : data

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const result = await res.json()

    if (!res.ok) {
      setSubmitError(result.error || "Registrering misslyckades")
      return
    }

    setSubmitMessage(result.message || "Registrering klar")
  }

  if (isInviteMode && inviteError) {
    return <p style={{ color: "#b91c1c" }}>{inviteError}</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {isInviteMode && inviteContext && (
        <div style={{ marginBottom: 20 }}>
          <h3>Inbjudan till {inviteContext.companyName}</h3>
          <p>Du registreras som {inviteContext.role}.</p>
        </div>
      )}

      {!isInviteMode && (
        <>
          <h3>Företag</h3>

          <input placeholder="Företagsnamn" {...register("companyName")} />
          <p>{errors.companyName?.message as string}</p>

          <input placeholder="Organisationsnummer" {...register("orgNumber")} />
          <p>{errors.orgNumber?.message as string}</p>

          <input placeholder="Företags-email" {...register("companyEmail")} />
          <p>{errors.companyEmail?.message as string}</p>
        </>
      )}

      <h3>Användare</h3>

      <input placeholder="Namn" {...register("userName")} />
      <p>{errors.userName?.message as string}</p>

      <input
        placeholder="Email"
        readOnly={isInviteMode}
        {...register("userEmail")}
      />
      <p>{errors.userEmail?.message as string}</p>

      <input type="password" placeholder="Lösenord" {...register("password")} />
      <p>{errors.password?.message as string}</p>

      <input type="password" placeholder="Bekräfta lösenord" {...register("confirmPassword")} />
      <p>{errors.confirmPassword?.message as string}</p>

      {submitError && <p style={{ color: "#b91c1c" }}>{submitError}</p>}
      {submitMessage && <p style={{ color: "#047857" }}>{submitMessage}</p>}

      <button type="submit" disabled={isSubmitting || Boolean(inviteToken && !inviteContext)}>
        {isSubmitting ? "Registrerar..." : "Registrera"}
      </button>
    </form>
  )
}
