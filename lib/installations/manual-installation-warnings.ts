import { calculateCO2e } from "@/lib/fgas-calculations"

export const MUNICIPALITY_PRE_COMMISSIONING_WARNING =
  "Aggregat över 14 ton CO₂e behöver normalt anmälas till kommunens miljökontor i god tid innan det tas i drift, ofta 4–6 veckor i förväg. Kontrollera vad som gäller i aktuell kommun."

export function getManualInstallationCo2eWarning(
  refrigerantType: string,
  refrigerantAmount: string | number
) {
  const amount =
    typeof refrigerantAmount === "number"
      ? refrigerantAmount
      : Number.parseFloat(refrigerantAmount.replace(",", "."))

  if (!refrigerantType || !Number.isFinite(amount)) return null

  const { co2eTon } = calculateCO2e(refrigerantType, amount)
  if (co2eTon === null || co2eTon <= 14) return null

  return {
    co2eTon,
    message: MUNICIPALITY_PRE_COMMISSIONING_WARNING,
  }
}
