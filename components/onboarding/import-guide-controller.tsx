"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GuidedPageTour } from "@/components/onboarding/guided-page-tour"
import { API_CACHE_KEYS, useApiQuery } from "@/lib/client/api-cache"
import {
  getImportGuide,
  getImportGuideSeenStorageKey,
  shouldShowImportGuide,
  type ImportGuideType,
} from "@/lib/dashboard/import-guides"

type CurrentUserResponse = {
  companyId: string
  userId: string
}

export function ImportGuideController({
  importType,
}: {
  importType: ImportGuideType
}) {
  const [isOpen, setIsOpen] = useState(false)
  const checkedStorageKeyRef = useRef("")
  const { data: currentUser } = useApiQuery<CurrentUserResponse>(
    API_CACHE_KEYS.authMe
  )
  const guide = useMemo(() => getImportGuide(importType), [importType])
  const storageKey =
    currentUser?.companyId && currentUser.userId
      ? getImportGuideSeenStorageKey({
          companyId: currentUser.companyId,
          importType,
          userId: currentUser.userId,
        })
      : null

  useEffect(() => {
    if (!storageKey || checkedStorageKeyRef.current === storageKey) return

    checkedStorageKeyRef.current = storageKey
    const frameId = window.requestAnimationFrame(() => {
      setIsOpen(
        shouldShowImportGuide({
          storedValue: window.localStorage.getItem(storageKey),
        })
      )
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [storageKey])

  function markSeenAndClose() {
    if (storageKey) {
      window.localStorage.setItem(storageKey, "1")
    }
    setIsOpen(false)
  }

  return (
    <>
      {currentUser ? (
        <button
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          Visa importguiden
        </button>
      ) : null}

      {isOpen ? (
        <GuidedPageTour
          finishLabel="Klar"
          guide={guide}
          onFinish={markSeenAndClose}
          onSkip={markSeenAndClose}
        />
      ) : null}
    </>
  )
}
