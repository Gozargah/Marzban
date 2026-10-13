import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      try {
        const stored = localStorage.getItem(storageKey)
        return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme
      } catch {
        return defaultTheme
      }
    }
  )
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  )
  const resolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    function updateSystemTheme() {
      setSystemTheme(media.matches ? "dark" : "light")
    }
    media.addEventListener("change", updateSystemTheme)
    updateSystemTheme()
    return () => media.removeEventListener("change", updateSystemTheme)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
    // Remove legacy body classes; shadcn's theme is controlled on the root.
    document.body.classList.remove("light", "dark")
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff"
    )
  }, [resolvedTheme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      try {
        localStorage.setItem(storageKey, theme)
      } catch {
        // Theme switching still works when browser storage is unavailable.
      }
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
