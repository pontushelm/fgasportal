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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 sm:text-sm sm:tracking-[0.18em]">
            Produktvy
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Se Polar i praktiken
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Från aggregatregister till färdig årsrapport - Polar samlar
            F-gasarbetet i ett tydligt och spårbart arbetsflöde.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:mt-9 lg:grid-cols-[0.9fr_1.45fr] lg:items-start lg:gap-6">
          <div className="order-2 grid gap-3 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
            {showcaseItems.map((item, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  aria-current={isActive ? "true" : undefined}
                  className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:p-4 ${
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
                  <span className="mt-1.5 block text-sm leading-6 text-slate-600 sm:mt-2">
                    {item.description}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="order-1 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-lg shadow-slate-200/70 sm:rounded-[1.35rem] sm:p-4 sm:shadow-xl lg:order-2">
            <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:rounded-2xl sm:p-2">
              <Image
                alt={activeItem.alt}
                className="h-auto max-h-[62vh] w-full rounded-lg border border-slate-100 object-contain sm:max-h-none sm:rounded-xl"
                height={activeItem.height}
                priority={activeIndex === 0}
                sizes="(max-width: 1024px) 100vw, 760px"
                src={activeItem.image}
                width={activeItem.width}
              />
            </div>
            <div className="flex flex-col gap-3 px-1 pb-1 pt-3 sm:flex-row sm:items-start sm:justify-between sm:pt-4">
              <div>
                <h3 className="text-base font-bold text-slate-950 sm:text-lg">
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
