import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

const updateThemeSchema = z.object({
  themePreference: z.enum(["light", "dark"]),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const { themePreference } = updateThemeSchema.parse(body)

    const user = await prisma.user.update({
      where: {
        id: auth.user.userId,
      },
      data: {
        themePreference,
      },
      select: {
        themePreference: true,
      },
    })

    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error("Update theme preference error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltigt tema" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
