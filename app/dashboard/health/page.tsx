import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import HealthPageClient from "@/components/dashboard/health-page-client"
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HealthPage() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const user = token ? verifyToken(token) : null

  if (!user) redirect("/login")
  if (user.role !== "OWNER") redirect("/dashboard")

  return <HealthPageClient />
}
