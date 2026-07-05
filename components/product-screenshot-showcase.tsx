"use client"

import Image from "next/image"
import { useState } from "react"

const showcaseItems = [
  {
    title: "Samlad aggregatöversikt",
    description:
      "Se status, köldmedium, CO₂e, nästa kontroll och risker för hela beståndet på en skärm.",
    image: "/screenshots/aggregatlista.jpg",
    width: 1226,
    height: 794,
    alt: "Aggregatlista i Polar med status, köldmedium, CO₂e, kontrollintervall och nästa kontroll.",
  },
  {
    title: "Händelser och historik",
    description:
      "Följ kontroller, läckage, påfyllningar, service och reparationer med full spårbarhet.",
    image: "/screenshots/handelser-under-aret.jpg",
    width: 871,
    height: 838,
    alt: "Händelselista i Polar med kontroller, läckage, påfyllningar, service och reparationer.",
  },
  {
    title: "Servicepartnerhantering",
    description:
      "Låt servicepartner registrera kontroller och händelser direkt i ert register. Polar samlar historiken på ett ställe och ger full spårbarhet.",
    image: "/screenshots/servicepartner-oversikt.jpg",
    width: 736,
    height: 489,
    alt: "Servicepartneröversikt i Polar med livscykelstatus, certifikat och tilldelade aggregat.",
  },
  {
    title: "Snabb registrering",
    description:
      "Registrera läckage, service och andra händelser snabbt - utan att låsa användaren i ett tungt arbetsflöde.",
    image: "/screenshots/skapa-handelse.jpg",
    width: 674,
    height: 506,
    alt: "Formulär i Polar för att snabbt registrera en läckagehändelse.",
  },
  {
    title: "Årsrapportering",
    description:
      "Se om årsrapporten är redo, vilka uppgifter som saknas och vilka avvikelser som behöver granskas innan rapporten skickas.",
    image: "/screenshots/skapa-rapport.jpg",
    width: 1278,
    height: 845,
    alt: "Årsrapportsida i Polar med rapportberedskap, fastighetsval och exportflöde.",
  },
  {
    title: "Färdig rapport",
    description:
      "Förhandsgranska och exportera en årsrapport enligt F-gasförordningen, med tydliga markeringar av brister och kompletteringsbehov.",
    image: "/screenshots/arsrapport.jpg",
    width: 1077,
    height: 845,
    alt: "Förhandsgranskad årsrapport i Polar med operatör, anläggningsuppgifter och servicepartner.",
  },
] as const

export function ProductScreenshotShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeItem = showcaseItems[activeIndex] ?? showcaseItems[0]

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Produktvy
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Se Polar i praktiken
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Från aggregatregister till färdig årsrapport - Polar samlar
            F-gasarbetet i ett tydligt och spårbart arbetsflöde.
          </p>
        </div>

        <div className="mt-9 grid gap-6 lg:grid-cols-[0.9fr_1.45fr] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {showcaseItems.map((item, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  aria-current={isActive ? "true" : undefined}
                  className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                    isActive
                      ? "border-blue-200 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                  }`}
                  key={item.title}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  <span
                    className={`text-sm font-semibold ${
                      isActive ? "text-blue-800" : "text-slate-950"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    {item.description}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3 shadow-xl shadow-slate-200/70 sm:p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <Image
                alt={activeItem.alt}
                className="h-auto w-full rounded-xl border border-slate-100 object-contain"
                height={activeItem.height}
                priority={activeIndex === 0}
                sizes="(max-width: 1024px) 100vw, 760px"
                src={activeItem.image}
                width={activeItem.width}
              />
            </div>
            <div className="flex flex-col gap-3 px-1 pb-1 pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  {activeItem.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {activeItem.description}
                </p>
              </div>
              <p className="shrink-0 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                {activeIndex + 1} av {showcaseItems.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
