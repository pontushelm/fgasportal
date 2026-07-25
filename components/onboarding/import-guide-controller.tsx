"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GuidedPageTour } from "@/components/onboarding/guided-page-tour"
import { Badge, Card } from "@/components/ui"
import { API_CACHE_KEYS, useApiQuery } from "@/lib/client/api-cache"
import {
  IMPORT_GUIDE_PRE_MAPPING_LAST_INDEX,
  IMPORT_GUIDE_MAPPING_START_INDEX,
  getImportGuide,
  getImportGuideOffer,
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
  isMappingReady,
}: {
  importType: ImportGuideType
  isMappingReady: boolean
}) {
  const [phase, setPhase] = useState<
    "idle" | "offer" | "tour" | "waiting-for-file"
  >("idle")
  const [initialStepIndex, setInitialStepIndex] = useState(0)
  const [tourRunId, setTourRunId] = useState(0)
  const offerButtonRef = useRef<HTMLButtonElement | null>(null)
  const checkedStorageKeyRef = useRef("")
  const { data: currentUser } = useApiQuery<CurrentUserResponse>(
    API_CACHE_KEYS.authMe
  )
  const guide = useMemo(() => getImportGuide(importType), [importType])
  const offer = useMemo(() => getImportGuideOffer(importType), [importType])
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
      if (
        shouldShowImportGuide({
          storedValue: window.localStorage.getItem(storageKey),
        })
      ) {
        setPhase("offer")
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [storageKey])

  useEffect(() => {
    if (phase !== "offer") return
    offerButtonRef.current?.focus()
  }, [phase])

  useEffect(() => {
    if (phase !== "waiting-for-file" || !isMappingReady) return

    const frameId = window.requestAnimationFrame(() => {
      setInitialStepIndex(IMPORT_GUIDE_MAPPING_START_INDEX)
      setTourRunId((current) => current + 1)
      setPhase("tour")
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isMappingReady, phase])

  useEffect(() => {
    if (phase !== "offer" && phase !== "waiting-for-file") return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (storageKey) {
        window.localStorage.setItem(storageKey, "1")
      }
      setPhase("idle")
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, storageKey])

  function markSeen() {
    if (storageKey) {
      window.localStorage.setItem(storageKey, "1")
    }
  }

  function markSeenAndClose() {
    markSeen()
    setPhase("idle")
  }

  function dismissOffer() {
    markSeen()
    setPhase("idle")
  }

  function startGuide(startIndex = 0) {
    setInitialStepIndex(startIndex)
    setTourRunId((current) => current + 1)
    setPhase("tour")
  }

  function showWaitingForFile() {
    setPhase("waiting-for-file")
  }

  return (
    <>
      {currentUser ? (
        <button
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
          type="button"
          onClick={() => startGuide(0)}
        >
          Visa importguiden
        </button>
      ) : null}

      {phase === "offer" ? (
        <div
          aria-labelledby="import-guide-offer-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4"
          role="dialog"
        >
          <Card className="w-full max-w-md border-blue-100 bg-white p-5 shadow-2xl">
            <Badge variant="info">Importguide</Badge>
            <h2
              className="mt-3 text-lg font-semibold text-slate-950"
              id="import-guide-offer-title"
            >
              {offer.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {offer.description}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                type="button"
                onClick={dismissOffer}
              >
                Inte nu
              </button>
              <button
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                ref={offerButtonRef}
                type="button"
                onClick={() => startGuide(0)}
              >
                Visa genomgång
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {phase === "waiting-for-file" ? (
        <div
          className="fixed bottom-4 right-4 z-[55] w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-700 shadow-2xl"
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">
                Ladda upp en Excel-fil för att fortsätta genomgången
              </p>
              <p className="mt-1 leading-6">
                När filen har lästs in fortsätter genomgången och visar hur
                kolumnerna ska mappas.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              type="button"
              onClick={markSeenAndClose}
            >
              Stäng
            </button>
          </div>
        </div>
      ) : null}

      {phase === "tour" ? (
        <GuidedPageTour
          blockedNext={
            isMappingReady
              ? undefined
              : {
                  atIndex: IMPORT_GUIDE_PRE_MAPPING_LAST_INDEX,
                  onBlocked: showWaitingForFile,
                }
          }
          finishLabel="Klar"
          guide={guide}
          initialStepIndex={initialStepIndex}
          key={`${guide.id}:${initialStepIndex}:${tourRunId}`}
          onFinish={markSeenAndClose}
          onSkip={markSeenAndClose}
        />
      ) : null}
    </>
  )
}
