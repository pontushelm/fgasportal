import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendFeedbackEmail } from "@/lib/email"

const createFeedbackSchema = z.object({
  type: z.enum(["BUG", "IMPROVEMENT", "QUESTION", "OTHER"]),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(4000),
  pageUrl: z.string().trim().url().max(1000).optional().nullable(),
})

const FEEDBACK_TYPE_LABELS = {
  BUG: "Bug",
  IMPROVEMENT: "Förbättringsförslag",
  QUESTION: "Fråga",
  OTHER: "Annat",
} as const

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const validatedData = createFeedbackSchema.parse(body)

    const feedback = await prisma.feedback.create({
      data: {
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        type: validatedData.type,
        title: validatedData.title,
        description: validatedData.description,
        pageUrl: validatedData.pageUrl || null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    try {
      await sendFeedbackEmail({
        type: FEEDBACK_TYPE_LABELS[feedback.type],
        title: feedback.title,
        description: feedback.description,
        pageUrl: feedback.pageUrl,
        createdAt: feedback.createdAt,
        user: {
          id: feedback.user?.id ?? auth.user.userId,
          name: feedback.user?.name ?? null,
          email: feedback.user?.email ?? null,
        },
        company: {
          id: feedback.company?.id ?? auth.user.companyId,
          name: feedback.company?.name ?? null,
        },
      })
    } catch (error) {
      console.error("Feedback email failed", {
        feedbackId: feedback.id,
        companyId: feedback.companyId,
        userId: feedback.userId,
        error,
      })
    }

    return NextResponse.json(
      {
        id: feedback.id,
        message: "Tack, din feedback har skickats.",
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create feedback error:", error)

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
