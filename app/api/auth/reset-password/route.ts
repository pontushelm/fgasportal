import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { hashPassword } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hashPasswordResetToken } from "@/lib/password-reset"
import { resetPasswordSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = resetPasswordSchema.parse(body)
    const tokenHash = hashPasswordResetToken(validatedData.token)
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    })

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt < new Date() ||
      !resetToken.user.isActive
    ) {
      return NextResponse.json(
        { error: "Länken är ogiltig eller har gått ut" },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(validatedData.password)

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          password: hashedPassword,
        },
      }),
      prisma.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json(
      { message: "Lösenordet har uppdaterats" },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Reset password error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
