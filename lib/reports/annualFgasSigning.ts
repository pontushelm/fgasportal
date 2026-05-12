import type { AnnualFgasSigningMetadata } from "@/lib/reports/annualFgasReportTypes"

export const ANNUAL_FGAS_SIGNING_ATTESTATION =
  "Jag intygar att uppgifterna i rapporten är granskade utifrån tillgängliga underlag."

const MAX_SIGNING_COMMENT_LENGTH = 1000

export type AnnualFgasSigningValidationResult =
  | { ok: true; metadata: AnnualFgasSigningMetadata | null }
  | { ok: false; errors: string[] }

export function parseAnnualFgasSigningMetadata(
  searchParams: URLSearchParams
): AnnualFgasSigningValidationResult {
  const signed = searchParams.get("signed")

  if (signed !== "1" && signed !== "true") {
    return { ok: true, metadata: null }
  }

  const signerName = searchParams.get("signerName")?.trim() ?? ""
  const signerRole = searchParams.get("signerRole")?.trim() ?? ""
  const signingDateValue = searchParams.get("signingDate")?.trim() ?? ""
  const comment = searchParams.get("signingComment")?.trim() ?? ""
  const errors: string[] = []

  if (!signerName) errors.push("Signeras av måste anges.")
  if (!signerRole) errors.push("Roll/titel måste anges.")
  if (!signingDateValue) errors.push("Signeringsdatum måste anges.")
  if (comment.length > MAX_SIGNING_COMMENT_LENGTH) {
    errors.push(`Kommentar får vara högst ${MAX_SIGNING_COMMENT_LENGTH} tecken.`)
  }

  const signingDate = parseSigningDate(signingDateValue)
  if (signingDateValue && !signingDate) {
    errors.push("Signeringsdatum måste vara ett giltigt datum.")
  }

  if (errors.length > 0 || !signingDate) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    metadata: {
      signerName,
      signerRole,
      signingDate,
      comment: comment || null,
      attestationText: ANNUAL_FGAS_SIGNING_ATTESTATION,
    },
  }
}

function parseSigningDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null

  const [year, month, day] = value.split("-").map(Number)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}
