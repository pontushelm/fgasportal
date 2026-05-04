"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/validations"

export default function ForgotPasswordForm() {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordFormData) {
    setMessage("")
    setError("")

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    const result: { message?: string; error?: string } = await response.json()

    if (!response.ok) {
      setError(result.error || "Kunde inte skicka instruktioner")
      return
    }

    setMessage(result.message || "Om e-postadressen finns registrerad har vi skickat instruktioner.")
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className={labelClassName} htmlFor="email">
          E-post
        </label>
        <input
          id="email"
          className={inputClassName}
          type="email"
          placeholder="namn@example.se"
          {...register("email")}
        />
        {errors.email?.message && (
          <p className={errorClassName}>{errors.email.message}</p>
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

      <button className={submitButtonClassName} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Skickar..." : "Skicka instruktioner"}
      </button>

      <Link className="text-sm font-semibold text-slate-700 hover:text-slate-950" href="/login">
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
