"use client"

import { useId, useMemo, useState } from "react"
import { getRefrigerant, REFRIGERANT_CATALOG } from "@/lib/refrigerants"

type RefrigerantComboboxProps = {
  className: string
  helpText?: string
  label: string
  name?: string
  onChange: (value: string) => void
  required?: boolean
  value: string
}

export function RefrigerantCombobox({
  className,
  helpText,
  label,
  name,
  onChange,
  required = false,
  value,
}: RefrigerantComboboxProps) {
  const inputId = useId()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const selectedRefrigerant = getRefrigerant(value)

  const filteredOptions = useMemo(() => {
    const search = value.trim().toLowerCase()
    if (!search) return REFRIGERANT_CATALOG.slice(0, 12)

    return REFRIGERANT_CATALOG.filter((refrigerant) =>
      [refrigerant.code, ...refrigerant.aliases].some((option) =>
        option.toLowerCase().includes(search)
      )
    ).slice(0, 12)
  }, [value])

  const showUnknownWarning = Boolean(value.trim()) && !selectedRefrigerant

  function selectRefrigerant(code: string) {
    onChange(code)
    setIsOpen(false)
  }

  return (
    <label
      className="relative grid gap-1 text-sm font-medium text-slate-700"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false)
        }
      }}
    >
      <span>
        {label} {required ? <span aria-hidden="true" className="text-xs text-red-500">*</span> : null}
      </span>
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        autoComplete="off"
        className={className}
        id={inputId}
        name={name}
        placeholder="Köldmedium, t.ex. R410A"
        required={required}
        role="combobox"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false)
          if (event.key === "Enter" && filteredOptions.length === 1) {
            event.preventDefault()
            selectRefrigerant(filteredOptions[0].code)
          }
        }}
      />

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Inga kända träffar</p>
          ) : (
            filteredOptions.map((refrigerant) => (
              <button
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  selectedRefrigerant?.code === refrigerant.code
                    ? "bg-blue-50 font-semibold text-blue-800"
                    : "text-slate-700"
                }`}
                key={refrigerant.code}
                type="button"
                role="option"
                aria-selected={selectedRefrigerant?.code === refrigerant.code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectRefrigerant(refrigerant.code)}
              >
                <span className="font-semibold">{refrigerant.code}</span>
                <span className="ml-2 text-xs text-slate-500">
                  GWP {refrigerant.gwp}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedRefrigerant ? (
        <span className="text-xs font-normal text-slate-500">
          Känt köldmedium. GWP {selectedRefrigerant.gwp} används i beräkningar.
        </span>
      ) : null}
      {showUnknownWarning ? (
        <span className="text-xs font-normal text-amber-700">
          Okänt köldmedium. GWP och kontrollberäkningar kan bli osäkra.
        </span>
      ) : null}
      {helpText ? (
        <span className="text-xs font-normal text-slate-500">{helpText}</span>
      ) : null}
    </label>
  )
}
