export function isValidPermanentDeleteConfirmation(
  confirmation: unknown,
  installation: {
    name: string
    equipmentId?: string | null
  }
) {
  if (typeof confirmation !== "string") return false

  const normalizedConfirmation = normalizeConfirmationValue(confirmation)
  if (!normalizedConfirmation) return false

  return [installation.equipmentId, installation.name]
    .map(normalizeConfirmationValue)
    .some((value) => value === normalizedConfirmation)
}

function normalizeConfirmationValue(value?: string | null) {
  return value?.trim().toLocaleLowerCase("sv-SE") ?? ""
}
