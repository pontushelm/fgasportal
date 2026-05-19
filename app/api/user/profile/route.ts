import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Namn måste vara minst 2 tecken").max(80),
  phone: z
    .string()
    .trim()
    .max(40, "Telefonnummer får vara högst 40 tecken")
    .regex(/^[0-9+\-\s().]*$/, "Ange ett giltigt telefonnummer")
    .optional()
    .transform((value) => (value ? value : null)),
  certificationNumber: z
    .string()
    .trim()
    .max(120, "Certifikatnummer får vara högst 120 tecken")
    .optional(),
  certificationIssuer: z
    .string()
    .trim()
    .max(120, "Certifieringsorgan får vara högst 120 tecken")
    .optional(),
  certificationValidUntil: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Ange ett giltigt datum",
    }),
  certificationCategory: z
    .string()
    .trim()
    .max(120, "Certifikatstyp får vara högst 120 tecken")
    .optional(),
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
        phone: validation.data.phone,
        ...(validation.data.certificationNumber !== undefined
          ? { certificationNumber: validation.data.certificationNumber || null }
          : {}),
        ...(validation.data.certificationIssuer !== undefined
          ? { certificationIssuer: validation.data.certificationIssuer || null }
          : {}),
        ...(validation.data.certificationValidUntil !== undefined
          ? {
              certificationValidUntil: validation.data.certificationValidUntil
                ? new Date(validation.data.certificationValidUntil)
                : null,
            }
          : {}),
        ...(validation.data.certificationCategory !== undefined
          ? { certificationCategory: validation.data.certificationCategory || null }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        certificationNumber: true,
        certificationIssuer: true,
        certificationValidUntil: true,
        certificationCategory: true,
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
