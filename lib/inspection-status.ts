export type InspectionStatus =
  | "OK"
  | "DUE_SOON"
  | "OVERDUE"
  | "NOT_REQUIRED"
  | "NOT_INSPECTED"

const DUE_SOON_DAYS = 30
const MS_PER_DAY = 1000 * 60 * 60 * 24

export function classifyInspectionStatus({
  inspectionRequired,
  lastInspection,
  nextInspection,
  today = new Date(),
}: {
  inspectionRequired: boolean
  lastInspection?: Date | string | null
  nextInspection?: Date | string | null
  today?: Date
}): { status: InspectionStatus; daysUntilDue: number | null } {
  if (!inspectionRequired) {
    return {
      status: "NOT_REQUIRED",
      daysUntilDue: null,
    }
  }

  if (nextInspection) {
    const dueDate = startOfDay(new Date(nextInspection))
    const currentDate = startOfDay(today)
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - currentDate.getTime()) / MS_PER_DAY
    )

    if (daysUntilDue < 0) {
      return {
        status: "OVERDUE",
        daysUntilDue,
      }
    }

    if (daysUntilDue <= DUE_SOON_DAYS) {
      return {
        status: "DUE_SOON",
        daysUntilDue,
      }
    }

    return {
      status: "OK",
      daysUntilDue,
    }
  }

  if (!lastInspection) {
    return {
      status: "NOT_INSPECTED",
      daysUntilDue: null,
    }
  }

  return {
    status: "OK",
    daysUntilDue: null,
  }
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}
