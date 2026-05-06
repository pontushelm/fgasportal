export type CertificationStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "MISSING"

export type CertificationStatusResult = {
  status: CertificationStatus
  label: string
  variant: "success" | "warning" | "danger" | "neutral"
}

export function getCertificationStatus({
  isCertifiedCompany,
  validUntil,
  today = new Date(),
}: {
  isCertifiedCompany: boolean
  validUntil?: Date | string | null
  today?: Date
}): CertificationStatusResult {
  if (!isCertifiedCompany || !validUntil) {
    return {
      status: "MISSING",
      label: "Saknas",
      variant: "neutral",
    }
  }

  const validUntilDate = validUntil instanceof Date ? validUntil : new Date(validUntil)

  if (!Number.isFinite(validUntilDate.getTime())) {
    return {
      status: "MISSING",
      label: "Saknas",
      variant: "neutral",
    }
  }

  const todayStart = startOfDay(today)
  const validUntilStart = startOfDay(validUntilDate)

  if (validUntilStart < todayStart) {
    return {
      status: "EXPIRED",
      label: "Utgången",
      variant: "danger",
    }
  }

  const warningDate = new Date(todayStart)
  warningDate.setDate(warningDate.getDate() + 30)

  if (validUntilStart <= warningDate) {
    return {
      status: "EXPIRING_SOON",
      label: "Löper snart ut",
      variant: "warning",
    }
  }

  return {
    status: "VALID",
    label: "Giltig",
    variant: "success",
  }
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}
