import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  authenticateApiRequest,
  generateToken,
} from "@/lib/auth"
import { getMembershipById } from "@/lib/memberships"

const switchCompanySchema = z.object({
  membershipId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const { membershipId } = switchCompanySchema.parse(body)
    const membership = await getMembershipById(auth.user.userId, membershipId)

    if (!membership) {
      return NextResponse.json(
        { error: "Företagskopplingen hittades inte" },
        { status: 404 }
      )
    }

    const response = NextResponse.json(
      {
        membership: {
          id: membership.id,
          companyId: membership.companyId,
          companyName: membership.company.name,
          role: membership.role,
        },
      },
      { status: 200 }
    )

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: generateToken(
        auth.user.userId,
        membership.companyId,
        membership.role,
        membership.id
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
    })

    return response
  } catch (error: unknown) {
    console.error("Switch company error:", error)

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
