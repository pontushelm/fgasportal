export function calculateNextInspectionDate(
  lastInspection?: Date | string | null,
  inspectionIntervalMonths?: number | null
) {
  if (!lastInspection || !inspectionIntervalMonths) return null

  return addMonths(new Date(lastInspection), inspectionIntervalMonths)
}

export function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setMonth(nextDate.getMonth() + months)
  return nextDate
}
