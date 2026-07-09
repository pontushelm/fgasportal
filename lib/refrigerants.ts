export type RefrigerantCategory =
  | "CFC"
  | "HCFC"
  | "HFC"
  | "HFO"
  | "HC"
  | "Natural"
  | "HFC blend"
  | "HCFC blend"
  | "HFO blend"
  | "HC blend"

export type RefrigerantLegalClassification =
  | "ANNEX_I"
  | "ANNEX_II_SECTION_1"
  | "OUT_OF_SCOPE"
  | "UNKNOWN"

export type RefrigerantCatalogEntry = {
  code: string
  displayName: string
  gwp: number
  aliases: string[]
  category: RefrigerantCategory
  legalClassification: RefrigerantLegalClassification
  notes?: string
}

type RefrigerantCatalogSeed = Omit<
  RefrigerantCatalogEntry,
  "aliases" | "displayName"
> & {
  aliases?: string[]
  displayName?: string
}

const REFRIGERANT_CATALOG_SEEDS: RefrigerantCatalogSeed[] = [
  unknownLegal({ code: "R11", gwp: 4750, category: "CFC" }),
  unknownLegal({ code: "R12", gwp: 10900, category: "CFC" }),
  unknownLegal({ code: "R13", gwp: 14400, category: "CFC" }),
  unknownLegal({ code: "R22", gwp: 1810, category: "HCFC" }),
  annexI({ code: "R23", gwp: 14800, category: "HFC" }),
  annexI({ code: "R32", gwp: 675, category: "HFC" }),
  annexI({ code: "R125", gwp: 3500, category: "HFC" }),
  annexI({ code: "R134a", gwp: 1430, category: "HFC" }),
  annexI({ code: "R143a", gwp: 4470, category: "HFC" }),
  annexI({ code: "R152a", gwp: 124, category: "HFC" }),

  unknownLegal({ code: "R401A", gwp: 1182, category: "HCFC blend" }),
  unknownLegal({ code: "R401B", gwp: 1288, category: "HCFC blend" }),
  unknownLegal({ code: "R401C", gwp: 933, category: "HCFC blend" }),
  unknownLegal({ code: "R402A", gwp: 2788, category: "HCFC blend" }),
  unknownLegal({ code: "R402B", gwp: 2416, category: "HCFC blend" }),
  unknownLegal({ code: "R403A", gwp: 3124, category: "HCFC blend" }),
  unknownLegal({ code: "R403B", gwp: 4461, category: "HCFC blend" }),
  annexI({ code: "R404A", gwp: 3922, category: "HFC blend" }),
  annexI({ code: "R407A", gwp: 2107, category: "HFC blend" }),
  annexI({ code: "R407B", gwp: 2804, category: "HFC blend" }),
  annexI({ code: "R407C", gwp: 1774, category: "HFC blend" }),
  annexI({ code: "R407F", gwp: 1825, category: "HFC blend" }),
  unknownLegal({ code: "R408A", gwp: 3152, category: "HCFC blend" }),
  unknownLegal({ code: "R409A", gwp: 1585, category: "HCFC blend" }),
  annexI({ code: "R410A", gwp: 2088, category: "HFC blend" }),
  annexI({ code: "R417A", gwp: 2346, category: "HFC blend" }),
  annexI({ code: "R422A", gwp: 3143, category: "HFC blend" }),
  annexI({ code: "R422D", gwp: 2729, category: "HFC blend" }),
  annexI({ code: "R424A", gwp: 2440, category: "HFC blend" }),
  annexI({ code: "R427A", gwp: 2138, category: "HFC blend" }),
  annexI({ code: "R434A", gwp: 3245, category: "HFC blend" }),
  annexI({ code: "R437A", gwp: 1805, category: "HFC blend" }),
  annexI({ code: "R438A", gwp: 2264, category: "HFC blend" }),
  annexI({ code: "R442A", gwp: 1888, category: "HFC blend" }),
  annexIiSection1({ code: "R448A", gwp: 1386, category: "HFO blend" }),
  annexIiSection1({ code: "R449A", gwp: 1396, category: "HFO blend" }),
  annexIiSection1({ code: "R450A", gwp: 601, category: "HFO blend" }),
  annexIiSection1({ code: "R452A", gwp: 2139, category: "HFO blend" }),
  annexIiSection1({ code: "R452B", gwp: 697, category: "HFO blend" }),
  annexIiSection1({ code: "R454A", gwp: 239, category: "HFO blend" }),
  annexIiSection1({ code: "R454B", gwp: 466, category: "HFO blend" }),
  annexIiSection1({ code: "R454C", gwp: 148, category: "HFO blend" }),
  annexIiSection1({ code: "R455A", gwp: 146, category: "HFO blend" }),
  annexI({ code: "R507A", gwp: 3985, category: "HFC blend" }),
  annexI({ code: "R508B", gwp: 13396, category: "HFC blend" }),
  annexIiSection1({ code: "R513A", gwp: 631, category: "HFO blend" }),
  annexIiSection1({ code: "R515B", gwp: 293, category: "HFO blend" }),

  annexIiSection1({ code: "R1234yf", gwp: 4, category: "HFO" }),
  annexIiSection1({
    code: "R1234ze",
    gwp: 7,
    category: "HFO",
    aliases: ["R1234ze(E)", "R-1234ze(E)"],
  }),

  outOfScope({ code: "R290", gwp: 3, category: "HC", aliases: ["propan", "propane"] }),
  outOfScope({
    code: "R600a",
    gwp: 3,
    category: "HC",
    aliases: ["isobutan", "isobutane"],
  }),
  outOfScope({
    code: "R717",
    gwp: 0,
    category: "Natural",
    aliases: ["ammoniak", "ammonia", "NH3"],
  }),
  outOfScope({
    code: "R718",
    gwp: 0,
    category: "Natural",
    aliases: ["vatten", "water", "H2O"],
  }),
  outOfScope({ code: "R729", gwp: 0, category: "Natural", aliases: ["luft", "air"] }),
  outOfScope({
    code: "R744",
    gwp: 1,
    category: "Natural",
    aliases: ["CO2", "CO₂", "koldioxid", "carbon dioxide"],
  }),
  outOfScope({
    code: "R1270",
    gwp: 3,
    category: "HC",
    aliases: ["propen", "propylene", "propene"],
  }),
]

export const REFRIGERANT_CATALOG: RefrigerantCatalogEntry[] =
  REFRIGERANT_CATALOG_SEEDS.map((refrigerant) => ({
    ...refrigerant,
    displayName: refrigerant.displayName ?? refrigerant.code,
    aliases: createAliases(refrigerant.code, refrigerant.aliases),
  }))

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

export function getRefrigerantLegalClassification(value: string | null | undefined) {
  return getRefrigerant(value)?.legalClassification ?? "UNKNOWN"
}

function annexI(
  seed: Omit<RefrigerantCatalogSeed, "legalClassification">
): RefrigerantCatalogSeed {
  return { ...seed, legalClassification: "ANNEX_I" }
}

function annexIiSection1(
  seed: Omit<RefrigerantCatalogSeed, "legalClassification">
): RefrigerantCatalogSeed {
  return { ...seed, legalClassification: "ANNEX_II_SECTION_1" }
}

function outOfScope(
  seed: Omit<RefrigerantCatalogSeed, "legalClassification">
): RefrigerantCatalogSeed {
  return { ...seed, legalClassification: "OUT_OF_SCOPE" }
}

function unknownLegal(
  seed: Omit<RefrigerantCatalogSeed, "legalClassification" | "notes"> & {
    notes?: string
  }
): RefrigerantCatalogSeed {
  return {
    ...seed,
    legalClassification: "UNKNOWN",
    notes:
      seed.notes ??
      "Legacy refrigerant; review applicable legal classification before using for F-gas leak-check decisions.",
  }
}

function createAliases(code: string, aliases: string[] = []) {
  const codeWithoutPrefix = code.slice(1)
  const spacedSuffix = codeWithoutPrefix.split("").join(" ")
  const dashedBeforeLetter = codeWithoutPrefix.replace(/(\d)([a-z])/i, "$1-$2")

  return Array.from(
    new Set([
      code,
      code.toLowerCase(),
      `R-${codeWithoutPrefix}`,
      `R ${codeWithoutPrefix}`,
      `R ${spacedSuffix}`,
      `R${dashedBeforeLetter}`,
      `R-${dashedBeforeLetter}`,
      ...aliases,
    ])
  )
}

function normalizeRefrigerantLookupKey(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/₂/g, "2")
    .replace(/â‚‚/g, "2")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim()
}
