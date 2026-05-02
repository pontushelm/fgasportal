import ActivityPageClient from "@/components/dashboard/activity-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function ActivityPage() {
  return <ActivityPageClient />
}
