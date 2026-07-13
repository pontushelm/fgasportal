import InstallationsImportPageClient from "@/components/dashboard/installations-import-page-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function InstallationsImportPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { sessionId } = await searchParams
  return <InstallationsImportPageClient initialImportSessionId={sessionId ?? null} />
}
