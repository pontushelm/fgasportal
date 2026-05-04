import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Namn måste vara minst 2 tecken").max(80),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const validation = updateProfileSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ogiltig profil" },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: {
        id: auth.user.userId,
      },
      data: {
        name: validation.data.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error("Update profile error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
