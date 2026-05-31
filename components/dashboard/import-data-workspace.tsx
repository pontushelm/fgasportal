"use client"

import { useEffect, useRef, useState } from "react"
import ImportInstallationsPage from "@/components/dashboard/installations-import-page-client"
import InstallationEventImportPageClient from "@/components/dashboard/installation-event-import-page-client"
import PropertiesImportPageClient from "@/components/dashboard/properties-import-page-client"
import { buttonClassName } from "@/components/ui"

type ImportType = "installations" | "properties" | "events"

type ImportDataWorkspaceProps = {
  onClose: () => void
  onEventsImported?: () => void
  onInstallationsImported?: () => void
  onPropertiesImported?: () => void
}

const importOptions: Array<{
  type: ImportType
  title: string
  description: string
  status?: string
  disabled?: boolean
}> = [
  {
    type: "installations",
    title: "Aggregatregister",
    description:
      "Importera grunddata för aggregat, köldmedium, fyllnadsmängder, placering och kontrolluppgifter.",
  },
  {
    type: "properties",
    title: "Fastigheter",
    description:
      "Importera fastighetsbeteckningar, adresser och grunduppgifter.",
  },
  {
    type: "events",
    title: "Händelser och historik",
    description:
      "Importera kontroller, läckage, service, påfyllningar och annan historik för befintliga aggregat.",
  },
]

export function ImportDataWorkspace({
  onClose,
  onEventsImported,
  onInstallationsImported,
  onPropertiesImported,
}: ImportDataWorkspaceProps) {
  const [activeImportType, setActiveImportType] = useState<ImportType | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const activeOption = importOptions.find((option) => option.type === activeImportType)

  return (
    <div
      aria-labelledby="import-workspace-title"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/45 p-0 sm:p-3"
      role="dialog"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-2xl sm:border sm:border-slate-200">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className="text-xl font-bold tracking-tight text-slate-950"
                id="import-workspace-title"
              >
                Importera data
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Välj vilken typ av registerdata du vill importera. Flödena använder
                samma validering och importlogik som tidigare.
              </p>
            </div>
            <button
              className={buttonClassName({ variant: "secondary" })}
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
            >
              Stäng
            </button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Importtyper">
            {importOptions.map((option) => {
              const isActive = activeImportType === option.type

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  disabled={option.disabled}
                  key={option.type}
                  type="button"
                  onClick={() => setActiveImportType(option.type)}
                >
                  <span>{option.title}</span>
                  {option.status && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      {option.status}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {activeImportType ? (
            <div className="mx-auto max-w-6xl">
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-semibold">{activeOption?.title}</p>
                <p className="mt-1 text-blue-900">{activeOption?.description}</p>
              </div>
              {activeImportType === "installations" ? (
                <ImportInstallationsPage
                  embedded
                  onImported={onInstallationsImported}
                />
              ) : activeImportType === "properties" ? (
                <PropertiesImportPageClient
                  embedded
                  onImported={onPropertiesImported}
                />
              ) : (
                <InstallationEventImportPageClient
                  embedded
                  onClose={onClose}
                  onImported={onEventsImported}
                />
              )}
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
              {importOptions.map((option) => (
                <button
                  className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
                    option.disabled
                      ? "cursor-not-allowed border-slate-200 opacity-75"
                      : "border-blue-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                  }`}
                  disabled={option.disabled}
                  key={option.type}
                  type="button"
                  onClick={() => setActiveImportType(option.type)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-950">
                      {option.title}
                    </h3>
                    {option.status && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        {option.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {option.description}
                  </p>
                  {!option.disabled && (
                    <span className="mt-5 inline-flex text-sm font-semibold text-blue-700">
                      Starta import
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
