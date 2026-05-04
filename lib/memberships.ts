import { prisma } from "@/lib/db"

export async function getMembershipById(userId: string, membershipId: string) {
  return await prisma.companyMembership.findFirst({
    where: {
      id: membershipId,
      userId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      role: true,
      isActive: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  })
}

export async function getActiveMembership(userId: string, companyId: string) {
  return await prisma.companyMembership.findFirst({
    where: {
      userId,
      companyId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      role: true,
      isActive: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  })
}

export async function getUserMemberships(userId: string) {
  return await prisma.companyMembership.findMany({
    where: {
      userId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      companyId: true,
      role: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  })
}
