import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import {
  DemoTenantGenerationError,
  generateDemoTenant,
  getDemoTenantTargets,
} from "@/lib/demo/demo-tenant"

const generateDemoTenantSchema = z.object({
  confirm: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const body = await request.json()
    const data = generateDemoTenantSchema.parse(body)
    const summary = await generateDemoTenant({
      companyId: auth.user.companyId,
      confirmed: data.confirm,
      ownerUserId: auth.user.userId,
    })

    return NextResponse.json(
      {
        summary,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    if (error instanceof DemoTenantGenerationError) {
      return NextResponse.json(
        {
          error: error.message,
          targets: getDemoTenantTargets(),
        },
        { status: 409 }
      )
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Bekräftelse krävs.", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Generate demo tenant error:", error)

    return NextResponse.json(
      { error: "Kunde inte skapa demo-data." },
      { status: 500 }
    )
  }
}
