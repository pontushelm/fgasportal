import { calculateCO2e } from "@/lib/fgas-calculations"
import { getRefrigerant, normalizeRefrigerantCode } from "@/lib/refrigerants"

export type RefrigerantRegulatoryStatus =
  | "OK"
  | "REVIEW"
  | "RESTRICTED"
  | "PHASE_OUT_RISK"
  | "UNKNOWN"

export type RefrigerantRegulatoryStatusResult = {
  status: RefrigerantRegulatoryStatus
  code: string | null
  gwp: number | null
  label: string
  shortLabel: string
  description: string
  actionTitle?: string
  actionDescription?: string
}

type RefrigerantRegulatoryRule = {
  status: Exclude<RefrigerantRegulatoryStatus, "UNKNOWN">
  label: string
  shortLabel: string
  description: string
  actionTitle?: string
  actionDescription?: string
}

const REFRIGERANT_RULES: Record<string, RefrigerantRegulatoryRule> = {
  R404A: {
    status: "RESTRICTED",
    label: "Kan omfattas av påfyllnadsbegränsningar",
    shortLabel: "Påfyllnadsbegränsning",
    description:
      "R404A har mycket hög GWP. Kontrollera gällande krav och planera byte vid fortsatt drift.",
    actionTitle: "Kontrollera köldmedium med mycket hög GWP",
    actionDescription:
      "Aggregatet använder R404A. Kontrollera gällande krav och planera eventuell utfasning.",
  },
  R507A: {
    status: "RESTRICTED",
    label: "Kan omfattas av påfyllnadsbegränsningar",
    shortLabel: "Påfyllnadsbegränsning",
    description:
      "R507A har mycket hög GWP. Kontrollera gällande krav och planera byte vid fortsatt drift.",
    actionTitle: "Kontrollera köldmedium med mycket hög GWP",
    actionDescription:
      "Aggregatet använder R507A. Kontrollera gällande krav och planera eventuell utfasning.",
  },
  R410A: {
    status: "PHASE_OUT_RISK",
    label: "Bör planeras för framtida utfasning",
    shortLabel: "Utfasningsrisk",
    description:
      "R410A har hög GWP och bör följas upp inför framtida service, ombyggnad eller byte.",
  },
  R134A: {
    status: "REVIEW",
    label: "Kontrollera framtida F-gaskrav",
    shortLabel: "Bör granskas",
    description:
      "R134a är ett HFC-köldmedium. Kontrollera gällande och kommande krav vid service eller ombyggnad.",
  },
  R449A: {
    status: "REVIEW",
    label: "Kontrollera framtida F-gaskrav",
    shortLabel: "Bör granskas",
    description:
      "R449A används ofta som ersättningsköldmedium men bör följas upp i långsiktig planering.",
  },
  R448A: {
    status: "REVIEW",
    label: "Kontrollera framtida F-gaskrav",
    shortLabel: "Bör granskas",
    description:
      "R448A används ofta som ersättningsköldmedium men bör följas upp i långsiktig planering.",
  },
  R32: {
    status: "OK",
    label: "Inga särskilda varningssignaler i FgasPortal",
    shortLabel: "OK",
    description:
      "R32 har lägre GWP än flera äldre HFC-blandningar. Kontrollera alltid gällande krav vid åtgärd.",
  },
}

export function getRefrigerantRegulatoryStatus({
  refrigerantAmountKg,
  refrigerantType,
}: {
  refrigerantType: string | null | undefined
  refrigerantAmountKg?: number | null
}): RefrigerantRegulatoryStatusResult {
  const refrigerant = getRefrigerant(refrigerantType)
  const code = refrigerant?.code ?? normalizeRefrigerantCode(refrigerantType)
  const gwp = refrigerant?.gwp ?? null

  if (!code || !refrigerant || gwp === null) {
    return {
      status: "UNKNOWN",
      code,
      gwp,
      label: "Okänt köldmedium",
      shortLabel: "Okänt köldmedium",
      description:
        "Köldmediet saknar känt GWP-värde i FgasPortal. Kontrollera gällande krav innan rapportering eller service.",
      actionTitle: "Kontrollera okänt köldmedium",
      actionDescription:
        "Aggregatet saknar känt GWP-värde. Komplettera köldmedium för säkrare F-gasuppföljning.",
    }
  }

  const configuredRule = REFRIGERANT_RULES[code.toUpperCase()]
  if (configuredRule) {
    return {
      ...configuredRule,
      code,
      gwp,
    }
  }

  if (gwp >= 2500) {
    return {
      status: "RESTRICTED",
      code,
      gwp,
      label: "Kan omfattas av påfyllnadsbegränsningar",
      shortLabel: "Påfyllnadsbegränsning",
      description:
        "Köldmediet har mycket hög GWP. Kontrollera gällande krav och planera åtgärd vid fortsatt drift.",
      actionTitle: "Kontrollera köldmedium med mycket hög GWP",
      actionDescription:
        "Aggregatet använder köldmedium med mycket hög GWP. Kontrollera gällande krav och planera eventuell utfasning.",
    }
  }

  if (gwp >= 1500) {
    return {
      status: "PHASE_OUT_RISK",
      code,
      gwp,
      label: "Bör planeras för utfasning",
      shortLabel: "Utfasningsrisk",
      description:
        "Köldmediet har hög GWP och bör följas upp i långsiktig service- och utbytesplanering.",
    }
  }

  const co2eTon =
    refrigerantAmountKg == null
      ? null
      : calculateCO2e(code, refrigerantAmountKg).co2eTon
  if (co2eTon !== null && co2eTon >= 40) {
    return {
      status: "REVIEW",
      code,
      gwp,
      label: "Kontrollera framtida F-gaskrav",
      shortLabel: "Bör granskas",
      description:
        "Aggregatet har hög installerad CO₂e. Kontrollera framtida krav vid service och planerade åtgärder.",
    }
  }

  return {
    status: "OK",
    code,
    gwp,
    label: "Inga särskilda varningssignaler i FgasPortal",
    shortLabel: "OK",
    description:
      "FgasPortal visar ingen särskild köldmedievarning. Kontrollera alltid gällande krav vid större åtgärder.",
  }
}

export function isRefrigerantRegulatoryFollowUpStatus(
  status: RefrigerantRegulatoryStatus
) {
  return status === "RESTRICTED" || status === "PHASE_OUT_RISK" || status === "UNKNOWN"
}
