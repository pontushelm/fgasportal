import ServicePageClient from "@/components/dashboard/service-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function ServicePage() {
  return <ServicePageClient />
}
