"use client"

import { useId, useMemo, useState } from "react"

export type SearchableSelectOption = {
  label: string
  searchText?: string
  value: string
}

type SearchableSelectProps = {
  className?: string
  clearLabel?: string
  emptyLabel?: string
  helpText?: string
  label: string
  name?: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  required?: boolean
  value: string
}

export function SearchableSelect({
  className = "",
  clearLabel,
  emptyLabel = "Inga träffar",
  helpText,
  label,
  name,
  onChange,
  options,
  placeholder = "Sök eller välj",
  required = false,
  value,
}: SearchableSelectProps) {
  const inputId = useId()
  const listboxId = useId()
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const inputValue = isOpen ? query : selectedOption?.label ?? query

  const filteredOptions = useMemo(
    () => filterSearchableSelectOptions(options, query),
    [options, query]
  )

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value)
    setQuery("")
    setIsOpen(false)
  }

  function clearSelection() {
    onChange("")
    setQuery("")
    setIsOpen(false)
  }

  return (
    <label
      className={`relative grid gap-1 text-sm font-medium text-slate-700 ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false)
          setQuery("")
        }
      }}
    >
      <span>
        {label} {required ? <span aria-hidden="true" className="text-xs text-red-500">*</span> : null}
      </span>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          id={inputId}
          name={name}
          pattern={required && !value ? "^$a" : undefined}
          placeholder={placeholder}
          required={required && !value}
          role="combobox"
          value={inputValue}
          onChange={(event) => {
            setQuery(event.target.value)
            if (value) onChange("")
            setIsOpen(true)
          }}
          onFocus={() => {
            setQuery("")
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false)
              setQuery("")
            }
            if (event.key === "Enter" && filteredOptions.length === 1) {
              event.preventDefault()
              selectOption(filteredOptions[0])
            }
          }}
        />
        {value ? (
          <button
            aria-label={clearLabel ?? `Rensa ${label.toLowerCase()}`}
            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            type="button"
            onClick={clearSelection}
          >
            ×
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                aria-selected={value === option.value}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  value === option.value
                    ? "bg-blue-50 font-semibold text-blue-800"
                    : "text-slate-700"
                }`}
                key={option.value}
                role="option"
                type="button"
                onClick={() => selectOption(option)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}

      {helpText ? (
        <span className="text-xs font-normal text-slate-500">{helpText}</span>
      ) : null}
    </label>
  )
}

export function filterSearchableSelectOptions(
  options: SearchableSelectOption[],
  query: string,
  limit = 20
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("sv-SE")
  if (!normalizedQuery) return options.slice(0, limit)

  return options
    .filter((option) =>
      `${option.label} ${option.searchText ?? ""}`
        .toLocaleLowerCase("sv-SE")
        .includes(normalizedQuery)
    )
    .slice(0, limit)
}
