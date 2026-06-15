export type PropertyListFilterKey =
  | "name"
  | "propertyDesignation"
  | "address"
  | "municipality"
  | "city"

export type PropertyListFilters = Record<PropertyListFilterKey, string>

export type PropertyListFilterable = {
  address?: string | null
  city?: string | null
  municipality?: string | null
  name?: string | null
  propertyDesignation?: string | null
}

export const EMPTY_PROPERTY_LIST_FILTERS: PropertyListFilters = {
  address: "",
  city: "",
  municipality: "",
  name: "",
  propertyDesignation: "",
}

export function buildPropertyFilterOptions(
  properties: PropertyListFilterable[]
): Record<PropertyListFilterKey, string[]> {
  return {
    address: uniqueSortedValues(properties.map((property) => property.address)),
    city: uniqueSortedValues(properties.map((property) => property.city)),
    municipality: uniqueSortedValues(
      properties.map((property) => property.municipality)
    ),
    name: uniqueSortedValues(properties.map((property) => property.name)),
    propertyDesignation: uniqueSortedValues(
      properties.map((property) => property.propertyDesignation)
    ),
  }
}

export function matchesPropertyListFilters(
  property: PropertyListFilterable,
  filters: PropertyListFilters
) {
  return (
    matchesFilterValue(property.name, filters.name) &&
    matchesFilterValue(
      property.propertyDesignation,
      filters.propertyDesignation
    ) &&
    matchesFilterValue(property.address, filters.address) &&
    matchesFilterValue(property.municipality, filters.municipality) &&
    matchesFilterValue(property.city, filters.city)
  )
}

export function hasActivePropertyListFilters(filters: PropertyListFilters) {
  return Object.values(filters).some(Boolean)
}

function matchesFilterValue(value: string | null | undefined, filter: string) {
  if (!filter) return true

  return normalizeFilterValue(value).includes(normalizeFilterValue(filter))
}

function uniqueSortedValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((first, second) =>
    first.localeCompare(second, "sv", {
      numeric: true,
      sensitivity: "base",
    })
  )
}

function normalizeFilterValue(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("sv-SE")
}
