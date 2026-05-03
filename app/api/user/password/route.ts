import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  authenticateApiRequest,
  comparePassword,
  hashPassword,
} from "@/lib/auth"
import { prisma } from "@/lib/db"

const passwordSchema = z
  .string()
  .min(8, "Lösenordet måste vara minst 8 tecken")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Lösenordet måste innehålla stor bokstav, liten bokstav och siffra"
  )

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Nuvarande lösenord krävs"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Bekräfta lösenordet"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Lösenorden matchar inte",
    path: ["confirmNewPassword"],
  })

export async function PATCH(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const validation = updatePasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ogiltigt lösenord" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        id: auth.user.userId,
      },
      select: {
        password: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Användaren kunde inte hittas" },
        { status: 404 }
      )
    }

    const isCurrentPasswordValid = await comparePassword(
      validation.data.currentPassword,
      user.password
    )

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "Nuvarande lösenord stämmer inte" },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(validation.data.newPassword)

    await prisma.user.update({
      where: {
        id: auth.user.userId,
      },
      data: {
        password: hashedPassword,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("Update password error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
