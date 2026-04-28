"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginFormData } from "@/lib/validations"

export default function LoginForm() {
  const [error, setError] = useState("")
  const router = useRouter()

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
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input
          type="email"
          placeholder="E-post"
          {...register("email")}
        />
        <p>{errors.email?.message}</p>
      </div>

      <div>
        <input
          type="password"
          placeholder="Lösenord"
          {...register("password")}
        />
        <p>{errors.password?.message}</p>
      </div>

      {error && <p>{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Loggar in..." : "Logga in"}
      </button>
    </form>
  )
}