"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PasswordInput } from "@/components/ui"
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "@/lib/validations"

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [error, setError] = useState(token ? "" : "Länken saknar återställningstoken")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
    },
  })

  async function onSubmit(data: ResetPasswordFormData) {
    setMessage("")
    setError("")

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    const result: { message?: string; error?: string } = await response.json()

    if (!response.ok) {
      setError(result.error || "Kunde inte återställa lösenordet")
      return
    }

    setMessage(result.message || "Lösenordet har uppdaterats")
    router.refresh()
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("token")} />

      <div>
        <label className={labelClassName} htmlFor="password">
          Nytt lösenord
        </label>
        <PasswordInput
          id="password"
          className={inputClassName}
          autoComplete="new-password"
          placeholder="Nytt lösenord"
          {...register("password")}
        />
        {errors.password?.message && (
          <p className={errorClassName}>{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className={labelClassName} htmlFor="confirmPassword">
          Bekräfta lösenord
        </label>
        <PasswordInput
          id="confirmPassword"
          className={inputClassName}
          autoComplete="new-password"
          placeholder="Bekräfta lösenord"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword?.message && (
          <p className={errorClassName}>{errors.confirmPassword.message}</p>
        )}
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        className={submitButtonClassName}
        type="submit"
        disabled={isSubmitting || Boolean(message) || !token}
      >
        {isSubmitting ? "Sparar..." : "Spara nytt lösenord"}
      </button>

      <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href="/login">
        Tillbaka till inloggning
      </Link>
    </form>
  )
}

const labelClassName = "mb-1 block text-sm font-semibold text-slate-700"
const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const errorClassName = "mt-1 text-sm font-medium text-red-700"
const submitButtonClassName =
  "mt-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
