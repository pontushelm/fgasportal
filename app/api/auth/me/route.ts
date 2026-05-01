import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const user = await prisma.user.findUnique({
      where: {
        id: auth.user.userId,
      },
      select: {
        themePreference: true,
      },
    })

    return NextResponse.json(
      {
        ...auth.user,
        themePreference: user?.themePreference ?? "system",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get current user error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
