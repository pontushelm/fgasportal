"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge, Card } from "@/components/ui"

type TargetRect = {
  top: number
  left: number
  width: number
  height: number
}

export type GuidedTourGuide = {
  id: string
  title: string
  description: string
  steps: Array<{
    title: string
    description: string
    selector?: string
  }>
}

export function GuidedPageTour({
  blockedNext,
  finishLabel = "Avsluta guide",
  guide,
  initialStepIndex = 0,
  onFinish,
  onSkip,
}: {
  blockedNext?: {
    atIndex: number
    onBlocked: () => void
  }
  finishLabel?: string
  guide: GuidedTourGuide
  initialStepIndex?: number
  onFinish: () => void
  onSkip: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(initialStepIndex)
  const activeStep = guide.steps[activeIndex]
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const scrolledTargetKeyRef = useRef("")

  useEffect(() => {
    let frameId = 0

    function updateTargetRect() {
      const target = activeStep.selector
        ? document.querySelector(activeStep.selector)
        : null
      const rect = target?.getBoundingClientRect()

      setTargetRect(
        rect
          ? {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }
          : null
      )
    }

    frameId = window.requestAnimationFrame(updateTargetRect)
    window.addEventListener("resize", updateTargetRect)
    window.addEventListener("scroll", updateTargetRect, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", updateTargetRect)
      window.removeEventListener("scroll", updateTargetRect, true)
    }
  }, [activeStep.selector])

  useEffect(() => {
    const selector = activeStep.selector
    if (!selector) return
    const targetSelector = selector

    const scrollKey = `${guide.id}:${activeIndex}:${targetSelector}`
    if (
      !shouldScrollTourTarget({
        scrollKey,
        scrolledTargetKey: scrolledTargetKeyRef.current,
        selector,
      })
    ) {
      return
    }

    let frameId = 0
    let attempts = 0

    function scrollWhenReady() {
      const target = document.querySelector(targetSelector)
      if (target) {
        scrolledTargetKeyRef.current = scrollKey
        target.scrollIntoView({
          behavior: getTourTargetScrollBehavior(
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ),
          block: "center",
          inline: "nearest",
        })
        return
      }

      attempts += 1
      if (attempts < 12) {
        frameId = window.requestAnimationFrame(scrollWhenReady)
      }
    }

    frameId = window.requestAnimationFrame(scrollWhenReady)
    return () => window.cancelAnimationFrame(frameId)
  }, [activeIndex, activeStep.selector, guide.id])

  const position = useMemo(() => getTourCardPosition(targetRect), [targetRect])
  const isLastStep = activeIndex === guide.steps.length - 1

  return (
    <div
      aria-labelledby="guided-page-tour-title"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/35 p-4"
      role="dialog"
    >
      {targetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl border-2 border-blue-500 bg-white/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
          style={{
            height: Math.max(targetRect.height, 44),
            left: Math.max(targetRect.left - 6, 8),
            top: Math.max(targetRect.top - 6, 8),
            width: Math.max(targetRect.width, 44),
          }}
        />
      ) : null}

      <Card
        className="fixed w-[calc(100vw-2rem)] max-w-md border-blue-100 bg-white p-4 shadow-2xl sm:p-5"
        style={position}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="info">
              Steg {activeIndex + 1} av {guide.steps.length}
            </Badge>
            <h2
              className="mt-3 text-lg font-semibold text-slate-950"
              id="guided-page-tour-title"
            >
              {activeStep.title}
            </h2>
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={onSkip}
            type="button"
          >
            Stäng guide
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700">
          {activeStep.description}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
            type="button"
          >
            Föregående
          </button>
          <button
            autoFocus
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => {
              if (isLastStep) {
                onFinish()
                return
              }

              if (blockedNext?.atIndex === activeIndex) {
                blockedNext.onBlocked()
                return
              }

              setActiveIndex((index) =>
                Math.min(index + 1, guide.steps.length - 1)
              )
            }}
            type="button"
          >
            {isLastStep ? finishLabel : "Nästa"}
          </button>
        </div>
      </Card>
    </div>
  )
}

export function getTourCardPosition(targetRect: TargetRect | null) {
  if (typeof window === "undefined" || !targetRect) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    }
  }

  const margin = 16
  const cardWidth = Math.min(448, window.innerWidth - margin * 2)
  const availableBelow = window.innerHeight - targetRect.top - targetRect.height
  const top =
    availableBelow > 260
      ? targetRect.top + targetRect.height + 14
      : Math.max(margin, targetRect.top - 260)
  const left = Math.min(
    Math.max(margin, targetRect.left),
    window.innerWidth - cardWidth - margin
  )

  return {
    left,
    top,
  }
}

export function getTourTargetScrollBehavior(
  prefersReducedMotion: boolean
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth"
}

export function shouldScrollTourTarget({
  scrolledTargetKey,
  scrollKey,
  selector,
}: {
  scrolledTargetKey: string
  scrollKey: string
  selector?: string
}) {
  return Boolean(selector && scrollKey && scrolledTargetKey !== scrollKey)
}
