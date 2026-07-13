import PropertiesImportPageClient from "@/components/dashboard/properties-import-page-client"

export default async function PropertiesImportPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { sessionId } = await searchParams
  return <PropertiesImportPageClient initialImportSessionId={sessionId ?? null} />
}
