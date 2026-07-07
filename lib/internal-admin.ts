import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isInternalAdminEmail } from "@/lib/internal-admin-config"

export type InternalAdminUser = {
  id: string
  email: string
  name: string
}

export async function getCurrentInternalAdminUser(): Promise<InternalAdminUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const authenticatedUser = token ? verifyToken(token) : null

  if (!authenticatedUser) return null

  const user = await prisma.user.findUnique({
    where: {
      id: authenticatedUser.userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
    },
  })

  if (!user?.isActive || !isInternalAdminEmail(user.email)) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}
