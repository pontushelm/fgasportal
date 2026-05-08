export type InstallationEventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"

const EVENT_AMOUNT_LABELS: Partial<Record<InstallationEventType, string>> = {
  LEAK: "Läckagemängd",
  REFILL: "Påfylld mängd",
  RECOVERY: "Omhändertagen mängd",
  REFRIGERANT_CHANGE: "Ny fyllnadsmängd",
}

export function getInstallationEventAmountLabel(
  type: InstallationEventType,
  options: { includeUnit?: boolean } = {}
) {
  const label = EVENT_AMOUNT_LABELS[type]
  if (!label) return null

  return options.includeUnit ? `${label} (kg)` : label
}

export function hasInstallationEventAmount(type: InstallationEventType) {
  return Boolean(EVENT_AMOUNT_LABELS[type])
}
