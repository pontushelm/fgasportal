import { Sidebar } from "@/components/layout/sidebar"
import { ThemeProvider } from "@/components/theme/theme-provider"
import type { ReactNode } from "react"

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ThemeProvider>
  )
}
