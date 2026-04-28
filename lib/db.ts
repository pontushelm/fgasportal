import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
