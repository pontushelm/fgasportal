export type ImportGuideType = "properties" | "installations" | "events"

type ImportGuide = {
  id: string
  title: string
  description: string
  steps: Array<{
    title: string
    description: string
    selector?: string
  }>
}

export const IMPORT_GUIDE_VERSION = "v2"
export const IMPORT_GUIDE_MAPPING_START_INDEX = 2
export const IMPORT_GUIDE_PRE_MAPPING_LAST_INDEX = 1

const IMPORT_GUIDE_STORAGE_PREFIX = "helmpolar_import_guide_seen"

type ImportGuideStorageKeyInput = {
  companyId: string
  guideVersion?: string
  importType: ImportGuideType
  userId: string
}

export function getImportGuideSeenStorageKey({
  companyId,
  guideVersion = IMPORT_GUIDE_VERSION,
  importType,
  userId,
}: ImportGuideStorageKeyInput) {
  return [
    IMPORT_GUIDE_STORAGE_PREFIX,
    companyId,
    userId,
    importType,
    guideVersion,
  ].join(":")
}

export function shouldShowImportGuide({
  isManualOpen = false,
  storedValue,
}: {
  isManualOpen?: boolean
  storedValue: string | null
}) {
  return isManualOpen || storedValue !== "1"
}

export function getImportGuideOffer(importType: ImportGuideType) {
  const subject =
    importType === "properties"
      ? "ert befintliga fastighetsregister"
      : importType === "installations"
        ? "ert befintliga aggregatregister"
        : "historiska kontroller och andra händelser från ett befintligt Excel-register"

  return {
    title: "Vill du ha en genomgång?",
    description: `Vi kan visa hur ni importerar ${subject} eller använder Polars importmall.`,
  }
}

export function getImportGuide(importType: ImportGuideType): ImportGuide {
  if (importType === "properties") {
    return {
      id: "import-properties",
      title: "Guide till fastighetsimport",
      description: "En kort introduktion till hur fastighetsimporten fungerar.",
      steps: [
        {
          title: "Importera ert befintliga register",
          description:
            "Ni kan importera ert befintliga fastighetsregister direkt från Excel. Polar läser in filen och låter er koppla kolumnerna i registret till rätt fält i systemet.",
          selector: '[data-import-guide="properties-upload"]',
        },
        {
          title: "Importmallen kan vara enklare",
          description:
            "Befintliga register kan ibland ha komplicerad struktur, flera rubrikrader eller information i olika format. Då kan det vara enklare att använda Polars importmall och föra över de uppgifter ni vill importera.",
          selector: '[data-import-guide="properties-template"]',
        },
        {
          title: "Koppla filens kolumner till Polar",
          description:
            "Mappning innebär att ni talar om vilket fält i Polar som motsvarar varje kolumn i Excel-filen. Till exempel kan en kolumn med rubriken Fastighetsnamn kopplas till fältet för fastighetens namn.",
          selector: '[data-import-guide="properties-mapping"]',
        },
        {
          title: "Kontrollera de viktigaste fälten",
          description:
            "Fastighetsbeteckning är obligatorisk. Namn, kommun, ort och adress är viktiga för att identifiera fastigheten. Polar kan föreslå mappningar, men ni bör kontrollera dem. Kolumner som inte ska importeras kan lämnas utan mappning.",
          selector: '[data-import-guide="properties-mapping"]',
        },
        {
          title: "Granska och genomför importen",
          description:
            "Kontrollera varningar, fel och förhandsgranskningen innan ni genomför importen. Inga fastigheter sparas förrän ni bekräftar importen.",
          selector: '[data-import-guide="properties-review"]',
        },
      ],
    }
  }

  if (importType === "installations") {
    return {
      id: "import-installations",
      title: "Guide till aggregatimport",
      description: "En kort introduktion till hur aggregatimporten fungerar.",
      steps: [
        {
          title: "Importera ert befintliga aggregatregister",
          description:
            "Ni kan importera ert befintliga aggregatregister direkt från Excel. Polar läser in filen och låter er koppla kolumnerna till rätt aggregatfält. Fastigheterna bör finnas i Polar innan aggregaten importeras.",
        },
        {
          title: "Importmallen kan vara enklare",
          description:
            "Aggregatregister kan innehålla många olika benämningar, sammanslagna kolumner och varierande format. Då kan Polars importmall göra det enklare att strukturera uppgifterna före import.",
          selector: '[data-import-guide="installations-template"]',
        },
        {
          title: "Koppla kolumnerna till aggregatfält",
          description:
            "Mappning innebär att varje kolumn i Excel-filen kopplas till motsvarande fält i Polar, exempelvis aggregatbeteckning, fastighet, köldmedium eller fyllnadsmängd.",
          selector: '[data-import-guide="installations-mapping"]',
        },
        {
          title: "Kontrollera viktiga aggregatuppgifter",
          description:
            "Kontrollera fält som identifierar aggregatet, kopplar det till rätt fastighet eller placering och anger köldmedium och fyllnadsmängd. De uppgifterna behövs för klassificering och beräkningar. Granska alltid automatiska förslag.",
          selector: '[data-import-guide="installations-mapping"]',
        },
        {
          title: "Granska och genomför importen",
          description:
            "Kontrollera mappningar, varningar och förhandsgranskning innan aggregaten importeras. Händelser och historiska kontroller importeras separat efter att aggregaten finns i registret.",
          selector: '[data-import-guide="installations-review"]',
        },
      ],
    }
  }

  return {
    id: "import-events",
    title: "Guide till händelseimport",
    description: "En kort introduktion till hur händelseimporten fungerar.",
    steps: [
      {
        title: "Importera era befintliga händelser",
        description:
          "Ni kan importera historiska kontroller och andra händelser direkt från ett befintligt Excel-register. Polar läser in filen och låter er koppla kolumnerna till rätt händelsefält. Aggregaten måste finnas i Polar för att händelserna ska kunna kopplas rätt.",
      },
      {
        title: "Importmallen kan vara enklare",
        description:
          "Historiska händelseregister kan innehålla flera händelsetyper, varierande datumformat och olika sätt att identifiera aggregat. Då kan Polars importmall förenkla importen.",
        selector: '[data-import-guide="events-template"]',
      },
      {
        title: "Koppla kolumnerna till händelsefält",
        description:
          "Mappning innebär att varje kolumn i Excel-filen kopplas till motsvarande fält i Polar, exempelvis aggregat, datum, händelsetyp och registrerade uppgifter.",
        selector: '[data-import-guide="events-mapping"]',
      },
      {
        title: "Kontrollera händelsernas kopplingar",
        description:
          "Kontrollera hur aggregatet identifieras, datum, händelsetyp och uppgifter som krävs för respektive händelse. Granska särskilt matchningar som Polar inte kunnat göra säkert.",
        selector: '[data-import-guide="events-mapping"]',
      },
      {
        title: "Granska och genomför importen",
        description:
          "Kontrollera särskilt händelser som inte kunnat kopplas säkert till ett aggregat, samt eventuella fel och varningar, innan importen genomförs.",
        selector: '[data-import-guide="events-review"]',
      },
    ],
  }
}
