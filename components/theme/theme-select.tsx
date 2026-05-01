"use client"

import { useState } from "react"
import { useTheme, type ThemePreference } from "./theme-provider"

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "Systeminställning", value: "system" },
  { label: "Ljust tema", value: "light" },
  { label: "Mörkt tema", value: "dark" },
]

export function ThemeSelect() {
  const { setThemePreference, themePreference } = useTheme()
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleThemeChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const nextTheme = event.target.value as ThemePreference

    setError("")
    setIsSaving(true)

    try {
      await setThemePreference(nextTheme)
    } catch (themeError) {
      console.error("Theme preference update failed:", themeError)
      setError("Kunde inte spara temainställningen")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-2">
      <label
        className="text-sm font-medium text-slate-700 dark:text-slate-300"
        htmlFor="themePreference"
      >
        Utseende
      </label>
      <select
        className="max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        disabled={isSaving}
        id="themePreference"
        name="themePreference"
        onChange={handleThemeChange}
        value={themePreference}
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Välj ett tema för ditt eget konto. Systeminställning följer enhetens
        ljusa eller mörka läge.
      </p>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  )
}
