import ServicePartnerCompanyDetailPageClient from "@/components/dashboard/service-partner-company-detail-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ServicePartnerCompanyDetailPage({
  params,
}: PageProps) {
  const { id } = await params

  return <ServicePartnerCompanyDetailPageClient companyId={id} />
}
