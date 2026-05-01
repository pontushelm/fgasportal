"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type ThemePreference = "light" | "dark"

type ThemeContextValue = {
  themePreference: ThemePreference
  setThemePreference: (themePreference: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const storageKey = "fgasportal-theme"

export function ThemeProvider({
  children,
  initialThemePreference = "light",
}: {
  children: ReactNode
  initialThemePreference?: ThemePreference
}) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    () => readStoredTheme() ?? initialThemePreference
  )

  useEffect(() => {
    let isMounted = true

    async function fetchThemePreference() {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (!response.ok || !isMounted) return

      const user: { themePreference?: string } = await response.json()
      const nextTheme = normalizeThemePreference(user.themePreference)

      setThemePreferenceState(nextTheme)
      storeTheme(nextTheme)
      applyTheme(nextTheme)
    }

    void fetchThemePreference()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dark")
      document.documentElement.style.colorScheme = "light"
    }
  }, [])

  useEffect(() => {
    applyTheme(themePreference)
  }, [themePreference])

  const setThemePreference = useCallback(async (nextTheme: ThemePreference) => {
    const normalizedTheme = normalizeThemePreference(nextTheme)

    setThemePreferenceState(normalizedTheme)
    storeTheme(normalizedTheme)
    applyTheme(normalizedTheme)

    const response = await fetch("/api/user/theme", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        themePreference: normalizedTheme,
      }),
    })

    if (!response.ok) {
      throw new Error("Kunde inte spara temainställningen")
    }
  }, [])

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
    }),
    [setThemePreference, themePreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}

function applyTheme(themePreference: ThemePreference) {
  const shouldUseDark = themePreference === "dark"

  document.documentElement.classList.toggle("dark", shouldUseDark)
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light"
}

function normalizeThemePreference(
  themePreference: ThemePreference | string | undefined
): ThemePreference {
  return themePreference === "dark" ? "dark" : "light"
}

function readStoredTheme() {
  if (typeof window === "undefined") return null

  const storedTheme = window.localStorage.getItem(storageKey)
  if (!storedTheme) return null

  return normalizeThemePreference(storedTheme)
}

function storeTheme(themePreference: ThemePreference) {
  window.localStorage.setItem(storageKey, themePreference)
}
