import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type LogActivityInput = {
  companyId: string
  installationId?: string | null
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
}

export async function logActivity({
  companyId,
  installationId,
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: LogActivityInput) {
  try {
    await prisma.activityLog.create({
      data: {
        companyId,
        installationId: installationId ?? null,
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ?? Prisma.JsonNull,
      },
    })
  } catch (error) {
    console.error("Activity log failed:", error)
  }
}

export function getEventActivityAction(type: string) {
  if (type === "INSPECTION") return "inspection_added"
  if (type === "LEAK") return "leak_registered"
  if (type === "REFILL") return "refill_registered"
  if (type === "SERVICE") return "service_added"

  return "event_added"
}
