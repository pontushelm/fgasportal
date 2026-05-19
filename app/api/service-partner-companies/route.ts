import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { toServiceOrganizationBackedCompany } from "@/lib/service-organizations"

const servicePartnerCompanySchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(160),
  organizationNumber: optionalText(40),
  contactEmail: z.string().trim().email("Ogiltig e-postadress").optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  certificateNumber: optionalText(120),
  notes: optionalText(1000),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const servicePartnerCompanies = await prisma.servicePartnerCompany.findMany({
      where: {
        companyId: auth.user.companyId,
      },
      orderBy: {
        name: "asc",
      },
      select: servicePartnerCompanySelect,
    })

    return NextResponse.json(
      servicePartnerCompanies.map(toServiceOrganizationBackedCompany),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get service partner companies error:", error)

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
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const data = servicePartnerCompanySchema.parse(body)

    const existingServiceOrganization = data.organizationNumber
      ? await prisma.serviceOrganization.findFirst({
          where: {
            organizationNumber: data.organizationNumber,
          },
          select: {
            id: true,
          },
        })
      : null
    const serviceOrganization =
      existingServiceOrganization ??
      (await prisma.serviceOrganization.create({
        data: {
          name: data.name,
          organizationNumber: data.organizationNumber,
          contactEmail: data.contactEmail,
          phone: data.phone,
          certificateNumber: data.certificateNumber,
        },
        select: {
          id: true,
        },
      }))

    const servicePartnerCompany = await prisma.servicePartnerCompany.create({
      data: {
        ...data,
        companyId: auth.user.companyId,
        serviceOrganizationId: serviceOrganization.id,
      },
      select: servicePartnerCompanySelect,
    })

    await prisma.companyServiceOrganization.upsert({
      where: {
        companyId_serviceOrganizationId: {
          companyId: auth.user.companyId,
          serviceOrganizationId: servicePartnerCompany.serviceOrganizationId!,
        },
      },
      create: {
        companyId: auth.user.companyId,
        serviceOrganizationId: servicePartnerCompany.serviceOrganizationId!,
        displayName: data.name,
      },
      update: {
        isActive: true,
        displayName: data.name,
      },
    })

    return NextResponse.json(
      toServiceOrganizationBackedCompany(servicePartnerCompany),
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create service partner company error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Det finns redan ett serviceföretag med samma namn." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function optionalText(maxLength: number) {
  return z.string().trim().max(maxLength).optional().or(z.literal("")).transform((value) => value || null)
}

const servicePartnerCompanySelect = {
  id: true,
  companyId: true,
  serviceOrganizationId: true,
  name: true,
  organizationNumber: true,
  contactEmail: true,
  phone: true,
  certificateNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  serviceOrganization: {
    select: {
      id: true,
      name: true,
      organizationNumber: true,
      contactEmail: true,
      phone: true,
      certificateNumber: true,
    },
  },
} satisfies Prisma.ServicePartnerCompanySelect
