import { prisma } from "@/lib/db"

export async function getActiveMembership(userId: string, companyId: string) {
  return await prisma.companyMembership.findFirst({
    where: {
      userId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      role: true,
      isActive: true,
    },
  })
}
