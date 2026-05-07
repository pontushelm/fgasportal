export type RefrigerantCategory = "HFC" | "HFO" | "HC" | "Natural" | "Blend"

export type RefrigerantCatalogEntry = {
  code: string
  gwp: number
  aliases: string[]
  category: RefrigerantCategory
}

export const REFRIGERANT_CATALOG: RefrigerantCatalogEntry[] = [
  { code: "R404A", gwp: 3922, category: "HFC", aliases: ["R-404A", "R 404A", "r404a"] },
  { code: "R410A", gwp: 2088, category: "HFC", aliases: ["R-410A", "R 410A", "r410a"] },
  { code: "R407C", gwp: 1774, category: "HFC", aliases: ["R-407C", "R 407C", "r407c"] },
  { code: "R134a", gwp: 1430, category: "HFC", aliases: ["R-134a", "R 134a", "R134A"] },
  { code: "R32", gwp: 675, category: "HFC", aliases: ["R-32", "R 32", "r32"] },
  { code: "R448A", gwp: 1387, category: "Blend", aliases: ["R-448A", "R 448A", "r448a"] },
  { code: "R449A", gwp: 1397, category: "Blend", aliases: ["R-449A", "R 449A", "r449a"] },
  { code: "R452A", gwp: 2141, category: "Blend", aliases: ["R-452A", "R 452A", "r452a"] },
  { code: "R454C", gwp: 148, category: "Blend", aliases: ["R-454C", "R 454C", "r454c"] },
  { code: "R455A", gwp: 146, category: "Blend", aliases: ["R-455A", "R 455A", "r455a"] },
  { code: "R513A", gwp: 631, category: "Blend", aliases: ["R-513A", "R 513A", "r513a"] },
  { code: "R507A", gwp: 3985, category: "HFC", aliases: ["R-507A", "R 507A", "r507a"] },
  { code: "R1234yf", gwp: 4, category: "HFO", aliases: ["R-1234yf", "R 1234yf", "R1234YF"] },
  { code: "R1234ze", gwp: 7, category: "HFO", aliases: ["R-1234ze", "R 1234ze", "R1234ZE"] },
  { code: "R290", gwp: 3, category: "HC", aliases: ["R-290", "R 290", "propan", "propane"] },
  { code: "R600a", gwp: 3, category: "HC", aliases: ["R-600a", "R 600a", "isobutan", "isobutane"] },
  { code: "R744", gwp: 1, category: "Natural", aliases: ["R-744", "R 744", "CO2", "CO₂"] },
  { code: "R717", gwp: 0, category: "Natural", aliases: ["R-717", "R 717", "ammoniak", "ammonia", "NH3"] },
]

export const REFRIGERANT_GWP: Record<string, number> = Object.fromEntries(
  REFRIGERANT_CATALOG.map((refrigerant) => [refrigerant.code, refrigerant.gwp])
)

export function normalizeRefrigerantCode(value: string | null | undefined) {
  const lookupKey = normalizeRefrigerantLookupKey(value)
  if (!lookupKey) return null

  return (
    REFRIGERANT_CATALOG.find((refrigerant) =>
      [refrigerant.code, ...refrigerant.aliases].some(
        (alias) => normalizeRefrigerantLookupKey(alias) === lookupKey
      )
    )?.code ?? null
  )
}

export function getRefrigerant(value: string | null | undefined) {
  const code = normalizeRefrigerantCode(value)
  if (!code) return null

  return REFRIGERANT_CATALOG.find((refrigerant) => refrigerant.code === code) ?? null
}

export function getRefrigerantGwp(value: string | null | undefined) {
  return getRefrigerant(value)?.gwp ?? null
}

function normalizeRefrigerantLookupKey(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/₂/g, "2")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim()
}
