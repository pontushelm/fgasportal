import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

const savedFilterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  page: z.string().trim().min(1).max(80),
  queryParams: z.record(z.string(), z.string()),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const page = request.nextUrl.searchParams.get("page")?.trim()
    const filters = await prisma.savedFilter.findMany({
      where: {
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        ...(page ? { page } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        page: true,
        queryParams: true,
        createdAt: true,
      },
    })

    return NextResponse.json(filters, { status: 200 })
  } catch (error: unknown) {
    console.error("Get saved filters error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const validatedData = savedFilterSchema.parse(body)
    const savedFilter = await prisma.savedFilter.create({
      data: {
        name: validatedData.name,
        page: validatedData.page,
        queryParams: validatedData.queryParams,
        userId: auth.user.userId,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        page: true,
        queryParams: true,
        createdAt: true,
      },
    })

    return NextResponse.json(savedFilter, { status: 201 })
  } catch (error: unknown) {
    console.error("Create saved filter error:", error)

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
