import CompanyPageClient from "@/components/dashboard/company-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function CompanyPage() {
  return <CompanyPageClient />
}
