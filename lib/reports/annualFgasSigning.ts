import type { AnnualFgasSigningMetadata } from "@/lib/reports/annualFgasReportTypes"

export const ANNUAL_FGAS_SIGNING_ATTESTATION =
  "Rapporten har signerats elektroniskt av inloggad användare i FgasPortal. Signeringshändelsen loggas i systemets aktivitetslogg."

export type AnnualFgasSigningValidationResult =
  | { ok: true; metadata: AnnualFgasSigningMetadata | null }
  | { ok: false; errors: string[] }

export function buildAnnualFgasSigningMetadata({
  searchParams,
  signedAt = new Date(),
  user,
}: {
  searchParams: URLSearchParams
  signedAt?: Date
  user: {
    name: string | null
    email: string
  }
}): AnnualFgasSigningValidationResult {
  const signed = searchParams.get("signed")

  if (signed !== "1" && signed !== "true") {
    return { ok: true, metadata: null }
  }

  const signerName = user.name?.trim() || user.email
  const errors: string[] = []

  if (!user.email) {
    errors.push("Inloggad användare saknar e-postadress.")
  }

  if (Number.isNaN(signedAt.getTime())) {
    errors.push("Signeringstid kunde inte fastställas.")
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    metadata: {
      signerName,
      signerEmail: user.email,
      signerRole: "Operatör",
      signingDate: signedAt,
      comment: null,
      attestationText: ANNUAL_FGAS_SIGNING_ATTESTATION,
    },
  }
}
