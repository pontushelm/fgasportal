"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, type RegisterFormData } from "@/lib/validations"
import { formatRoleLabel } from "@/lib/roles"

type RegisterFormFields = RegisterFormData & {
  companyName?: string
  orgNumber?: string
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
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
        {inviteError}
      </p>
    )
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      {isInviteMode && inviteContext && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <h3 className="font-semibold">Inbjudan till {inviteContext.companyName}</h3>
          <p className="mt-1">
            Du registreras som {formatRoleLabel(inviteContext.role)}.
          </p>
        </div>
      )}

      {!isInviteMode && (
        <>
          <h3 className={sectionTitleClassName}>Företag</h3>

          <Field label="Företagsnamn" error={errors.companyName?.message as string}>
            <input className={inputClassName} placeholder="Företagsnamn" {...register("companyName")} />
          </Field>

          <Field label="Organisationsnummer" error={errors.orgNumber?.message as string}>
            <input className={inputClassName} placeholder="Organisationsnummer" {...register("orgNumber")} />
          </Field>

        </>
      )}

      <h3 className={sectionTitleClassName}>Användare</h3>

      <Field label="Namn" error={errors.userName?.message as string}>
        <input className={inputClassName} placeholder="Namn" {...register("userName")} />
      </Field>

      <Field label="E-post" error={errors.userEmail?.message as string}>
        <input
          className={`${inputClassName} ${isInviteMode ? "bg-slate-100" : ""}`}
          placeholder="namn@example.se"
          readOnly={isInviteMode}
          {...register("userEmail")}
        />
      </Field>

      <Field label="Lösenord" error={errors.password?.message as string}>
        <input className={inputClassName} type="password" placeholder="Lösenord" {...register("password")} />
      </Field>

      <Field label="Bekräfta lösenord" error={errors.confirmPassword?.message as string}>
        <input className={inputClassName} type="password" placeholder="Bekräfta lösenord" {...register("confirmPassword")} />
      </Field>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {submitError}
        </p>
      )}
      {submitMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {submitMessage}
        </p>
      )}

      <button
        className={submitButtonClassName}
        type="submit"
        disabled={isSubmitting || Boolean(inviteToken && !inviteContext)}
      >
        {isSubmitting ? "Registrerar..." : isInviteMode ? "Skapa användare" : "Skapa konto"}
      </button>

      <div className="grid gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          Har du redan konto?{" "}
          <Link className="font-semibold text-blue-700 hover:text-blue-800" href="/login">
            Logga in
          </Link>
        </p>
        <Link className="font-semibold text-slate-700 hover:text-slate-950" href="/">
          Tillbaka till startsidan
        </Link>
      </div>
    </form>
  )
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode
  error?: string
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </label>
  )
}

const sectionTitleClassName =
  "border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500 first:border-t-0 first:pt-0"
const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const submitButtonClassName =
  "mt-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
