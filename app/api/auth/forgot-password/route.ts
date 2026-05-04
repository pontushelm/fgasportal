import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import {
  createPasswordResetExpiry,
  createPasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/password-reset"
import { forgotPasswordSchema } from "@/lib/validations"

const successMessage =
  "Om e-postadressen finns registrerad har vi skickat instruktioner."

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    })

    if (user?.isActive) {
      const token = createPasswordResetToken()
      const tokenHash = hashPasswordResetToken(token)
      const now = new Date()

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: createPasswordResetExpiry(now),
          },
        }),
      ])

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: `${request.nextUrl.origin}/reset-password?token=${token}`,
      })
    }

    return NextResponse.json({ message: successMessage }, { status: 200 })
  } catch (error: unknown) {
    console.error("Forgot password error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: successMessage }, { status: 200 })
  }
}
