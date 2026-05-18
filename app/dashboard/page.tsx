import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardPageClient from "@/components/dashboard/dashboard-page-client"
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardPage() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null

  if (user?.role === "CONTRACTOR") {
    redirect("/dashboard/service")
  }

  return <DashboardPageClient />
}
