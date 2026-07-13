import InstallationEventImportPageClient from "@/components/dashboard/installation-event-import-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function InstallationEventImportPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { sessionId } = await searchParams
  return (
    <InstallationEventImportPageClient initialImportSessionId={sessionId ?? null} />
  )
}
