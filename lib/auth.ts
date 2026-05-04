import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAdminRole } from '@/lib/roles'

export const AUTH_COOKIE_NAME = 'auth-token'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONTRACTOR'

export type AuthenticatedUser = {
  userId: string
  membershipId?: string
  companyId: string
  role: UserRole
}

type AuthResult =
  | { user: AuthenticatedUser; response?: never }
  | { user?: never; response: NextResponse }

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function comparePassword(
  password: string, 
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function generateToken(
  userId: string,
  companyId: string,
  role: string,
  membershipId?: string
): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined')
  }
  
  return jwt.sign(
    { userId, membershipId, companyId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): AuthenticatedUser | null {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined')
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (!isAuthTokenPayload(payload)) {
      return null
    }

    return {
      userId: payload.userId,
      membershipId: payload.membershipId,
      companyId: payload.companyId,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)
  return cookie?.value || null
}

export async function authenticateApiRequest(request: NextRequest): Promise<AuthResult> {
  const token = getTokenFromRequest(request)

  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'Saknar autentisering' },
        { status: 401 }
      ),
    }
  }

  const user = verifyToken(token)

  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Ogiltig eller utgången session' },
        { status: 401 }
      ),
    }
  }

  if (!user.membershipId) {
    return { user }
  }

  const membership = await prisma.companyMembership.findFirst({
    where: {
      id: user.membershipId,
      userId: user.userId,
      isActive: true,
      user: {
        isActive: true,
      },
      company: {
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      role: true,
    },
  })

  if (!membership) {
    return {
      response: NextResponse.json(
        { error: 'Ogiltig eller inaktiv företagskoppling' },
        { status: 401 }
      ),
    }
  }

  return {
    user: {
      userId: user.userId,
      membershipId: membership.id,
      companyId: membership.companyId,
      role: membership.role,
    },
  }
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return isAdminRole(user.role)
}

export function isContractor(user: AuthenticatedUser): boolean {
  return user.role === 'CONTRACTOR'
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: 'Behörighet saknas' },
    { status: 403 }
  )
}

function isAuthTokenPayload(
  payload: string | JwtPayload
): payload is JwtPayload & AuthenticatedUser {
  return (
    typeof payload === 'object' &&
    typeof payload.userId === 'string' &&
    (payload.membershipId === undefined || typeof payload.membershipId === 'string') &&
    typeof payload.companyId === 'string' &&
    isUserRole(payload.role)
  )
}

function isUserRole(role: unknown): role is UserRole {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MEMBER' ||
    role === 'CONTRACTOR'
  )
}
