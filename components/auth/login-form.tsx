"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PasswordInput } from "@/components/ui"
import { loginSchema, type LoginFormData } from "@/lib/validations"

export default function LoginForm() {
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const registrationSuccess = searchParams.get("registered") === "1"

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setError("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error || "Inloggning misslyckades")
      return
    }

    router.push("/dashboard")
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
          placeholder="din@epost.se"
          {...register("email")}
        />
        {errors.email?.message && (
          <p className={errorClassName}>{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className={labelClassName} htmlFor="password">
          Lösenord
        </label>
        <PasswordInput
          id="password"
          className={inputClassName}
          placeholder="Lösenord"
          {...register("password")}
        />
        {errors.password?.message && (
          <p className={errorClassName}>{errors.password.message}</p>
        )}
        <Link
          className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
          href="/forgot-password"
        >
          Glömt lösenord?
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {registrationSuccess && !error && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Konto skapat. Du kan nu logga in.
        </p>
      )}

      <button className={submitButtonClassName} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Loggar in..." : "Logga in"}
      </button>
      <p className={trustLineClassName}>
        Utformat för fastighetsägare, kommuner och verksamheter
      </p>

      <div className="grid gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          Saknar konto?{" "}
          <Link className="font-semibold text-blue-700 hover:text-blue-800" href="/register">
            Skapa organisationskonto
          </Link>
        </p>
        <Link className="font-semibold text-slate-700 hover:text-slate-950" href="/">
          Tillbaka till startsidan
        </Link>
      </div>
    </form>
  )
}

const labelClassName = "mb-1 block text-sm font-semibold text-slate-700"
const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const errorClassName = "mt-1 text-sm font-medium text-red-700"
const submitButtonClassName =
  "mt-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
const trustLineClassName = "-mt-1 text-center text-xs text-slate-500"
