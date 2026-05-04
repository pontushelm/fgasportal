import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  comparePassword,
  generateToken
} from '@/lib/auth'
import { getActiveMembership } from '@/lib/memberships'
import { loginSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validera input
    const validatedData = loginSchema.parse(body)
    
    // Hitta användare
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: { company: true }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Felaktig email eller lösenord' },
        { status: 401 }
      )
    }
    
    // Kontrollera att användaren är aktiv
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Kontot är inaktiverat' },
        { status: 401 }
      )
    }
    
    // Kontrollera att företaget är aktivt
    if (!user.company.isActive) {
      return NextResponse.json(
        { error: 'Företagskontot är inaktiverat' },
        { status: 401 }
      )
    }
    
    // Verifiera lösenord
    const isValidPassword = await comparePassword(
      validatedData.password, 
      user.password
    )
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Felaktig email eller lösenord' },
        { status: 401 }
      )
    }
    
    const membership = await getActiveMembership(user.id, user.companyId)
    const activeCompanyId = membership?.companyId ?? user.companyId
    const activeRole = membership?.role ?? user.role
    const activeCompanyName = membership?.company.name ?? user.company.name

    // Generera JWT token
    const token = generateToken(
      user.id,
      activeCompanyId,
      activeRole,
      membership?.id
    )
    
    // Skapa response med cookie
    const response = NextResponse.json(
      {
        message: 'Inloggning lyckades',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: activeRole,
          companyId: activeCompanyId,
          companyName: activeCompanyName
        }
      },
      { status: 200 }
    )
    
    // Sätt auth-token cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/',
    })
    
    return response
    
  } catch (error: unknown) {
    console.error('Login error:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Ogiltiga indata', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}
