import { Suspense } from "react"
import ActionsPageClient from "@/components/dashboard/actions-page-client"

export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsPageClient />
    </Suspense>
  )
}
