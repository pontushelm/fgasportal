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

export type ThemePreference = "system" | "light" | "dark"

type ThemeContextValue = {
  themePreference: ThemePreference
  setThemePreference: (themePreference: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const storageKey = "fgasportal-theme"

export function ThemeProvider({
  children,
  initialThemePreference = "system",
}: {
  children: ReactNode
  initialThemePreference?: ThemePreference
}) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readStoredTheme() ?? initialThemePreference
  )

  useEffect(() => {
    let isMounted = true

    async function fetchThemePreference() {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (!response.ok || !isMounted) return

      const user: { themePreference?: ThemePreference } = await response.json()
      const nextTheme = normalizeThemePreference(user.themePreference)

      setThemePreferenceState(nextTheme)
      storeTheme(nextTheme)
      applyTheme(nextTheme)
    }

    void fetchThemePreference()

    return () => {
      isMounted = false
    }
  }, [initialThemePreference])

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dark")
      document.documentElement.style.colorScheme = "light"
    }
  }, [])

  useEffect(() => {
    applyTheme(themePreference)

    if (themePreference !== "system") return
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
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
  const prefersDark =
    themePreference === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  const shouldUseDark = themePreference === "dark" || prefersDark

  document.documentElement.classList.toggle("dark", shouldUseDark)
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light"
}

function normalizeThemePreference(
  themePreference: ThemePreference | string | undefined
): ThemePreference {
  if (
    themePreference === "system" ||
    themePreference === "light" ||
    themePreference === "dark"
  ) {
    return themePreference
  }

  return "system"
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
