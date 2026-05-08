export function summarizeAnnualFgasCo2e(
  rows: Array<{ co2eKg: number | null }>
) {
  const unknownCo2eEquipmentCount = rows.filter((row) => row.co2eKg === null).length
  const knownCo2eKg = rows.reduce((sum, row) => sum + (row.co2eKg ?? 0), 0)

  return {
    hasUnknownCo2e: unknownCo2eEquipmentCount > 0,
    knownCo2eKg,
    totalCo2eKg: unknownCo2eEquipmentCount > 0 ? null : knownCo2eKg,
    unknownCo2eEquipmentCount,
  }
}
