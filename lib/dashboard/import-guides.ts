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

export const IMPORT_GUIDE_VERSION = "v1"

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

export function getImportGuide(importType: ImportGuideType): ImportGuide {
  if (importType === "properties") {
    return {
      id: "import-properties",
      title: "Guide till fastighetsimport",
      description: "En kort introduktion till hur fastighetsimporten fungerar.",
      steps: [
        {
          title: "Börja med importmallen",
          description:
            "Ladda ner mallen och fyll i era fastigheter. Behåll kolumnrubrikerna så att Polar kan tolka filen korrekt.",
          selector: '[data-import-guide="properties-template"]',
        },
        {
          title: "Ladda upp Excel-filen",
          description:
            "När filen är klar laddar du upp den här. Polar granskar innehållet innan något sparas.",
          selector: '[data-import-guide="properties-upload"]',
        },
        {
          title: "Granska innan import",
          description:
            "Kontrollera mappning, varningar och eventuella fel innan du genomför importen.",
        },
        {
          title: "Fastigheter först",
          description:
            "Importera fastigheterna innan aggregaten, så att aggregaten kan kopplas till rätt plats.",
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
          title: "Kontrollera fastigheterna först",
          description:
            "Importera eller lägg till fastigheterna innan aggregaten, så att varje aggregat kan placeras rätt.",
        },
        {
          title: "Fyll i aggregatmallen",
          description:
            "Mallen innehåller grunddata om aggregat, köldmedium, fyllnadsmängd, placering och kontrolluppgifter.",
          selector: '[data-import-guide="installations-template"]',
        },
        {
          title: "Ladda upp och granska",
          description:
            "Polar kontrollerar filen och visar vad som behöver rättas innan importen genomförs.",
          selector: '[data-import-guide="installations-upload"]',
        },
        {
          title: "Importera händelser efteråt",
          description:
            "När aggregaten finns i registret kan ni importera historiska kontroller och andra händelser i händelseimporten.",
          selector: '[data-import-guide="installations-events-link"]',
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
        title: "Börja med aggregaten",
        description:
          "Händelser måste kopplas till befintliga aggregat. Importera därför aggregaten innan historiska händelser.",
      },
      {
        title: "Fyll i händelsemallen",
        description:
          "Ange rätt aggregatreferens, datum, händelsetyp och övriga uppgifter som behövs för registreringen.",
        selector: '[data-import-guide="events-template"]',
      },
      {
        title: "Ladda upp Excel-filen",
        description:
          "Polar matchar händelserna mot aggregaten och visar eventuella problem innan importen genomförs.",
        selector: '[data-import-guide="events-upload"]',
      },
      {
        title: "Kontrollera matchningen",
        description:
          "Kontrollera särskilt händelser som inte säkert kunnat kopplas till ett aggregat.",
      },
    ],
  }
}
