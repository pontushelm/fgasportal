import DashboardPageClient from "@/components/dashboard/dashboard-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function DashboardPage() {
  return <DashboardPageClient />
}
