"use client"

import { useState } from "react"

type DemoRequestButtonProps = {
  children: React.ReactNode
  className: string
}

type DemoRequestForm = {
  email: string
  message: string
  name: string
  organization: string
  phone: string
}

const emptyForm: DemoRequestForm = {
  email: "",
  message: "",
  name: "",
  organization: "",
  phone: "",
}

export function DemoRequestButton({
  children,
  className,
}: DemoRequestButtonProps) {
  const [form, setForm] = useState<DemoRequestForm>(emptyForm)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  function closeModal() {
    if (isSubmitting) return

    setIsOpen(false)
    setError("")
    setIsSuccess(false)
  }

  function updateField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const response = await fetch("/api/demo-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    })
    const result: { error?: string } = await response.json()

    setIsSubmitting(false)

    if (!response.ok) {
      setError(result.error || "Kunde inte skicka demo-förfrågan.")
      return
    }

    setForm(emptyForm)
    setIsSuccess(true)
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>

      {isOpen && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Boka demo
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  Berätta kort om er organisation
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Skicka en förfrågan så återkommer vi med nästa steg.
                </p>
              </div>
              <button
                aria-label="Stäng"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                type="button"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {isSuccess ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-950">
                  Tack! Vi återkommer så snart vi kan.
                </p>
                <button
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  type="button"
                  onClick={closeModal}
                >
                  Stäng
                </button>
              </div>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Namn
                  <input
                    className={inputClassName}
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Organisation
                  <input
                    className={inputClassName}
                    name="organization"
                    value={form.organization}
                    onChange={updateField}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  E-post
                  <input
                    className={inputClassName}
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Telefonnummer
                  <input
                    className={inputClassName}
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField}
                  />
                  <span className="text-xs font-normal text-slate-500">
                    Valfritt
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Meddelande
                  <textarea
                    className={inputClassName}
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={updateField}
                  />
                  <span className="text-xs font-normal text-slate-500">
                    Valfritt
                  </span>
                </label>

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Avbryt
                  </button>
                  <button
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Skickar..." : "Skicka demo-förfrågan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
