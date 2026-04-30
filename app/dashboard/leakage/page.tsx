import LeakagePageClient from "@/components/dashboard/leakage-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function LeakagePage() {
  return <LeakagePageClient />
}
