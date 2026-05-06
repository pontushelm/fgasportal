import { randomUUID } from "crypto"
import { del, put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { prisma } from "@/lib/db"
import { logActivity } from "@/lib/activity-log"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
])

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Blob storage är inte konfigurerat" },
        { status: 500 }
      )
    }

    const { id } = await context.params
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        scrappedAt: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    if (installation.scrappedAt) {
      return NextResponse.json(
        { error: "Aggregatet är redan skrotat" },
        { status: 409 }
      )
    }

    const formData = await request.formData()
    const scrappedAt = parseRequiredDate(formData.get("scrappedAt"))
    const servicePartnerId = normalizeFormString(formData.get("servicePartnerId"))
    const scrapComment = normalizeFormString(formData.get("scrapComment"))
    const recoveredRefrigerantKg = parseOptionalNumber(
      formData.get("recoveredRefrigerantKg")
    )
    const certificate = formData.get("certificate")

    if (!scrappedAt) {
      return NextResponse.json(
        { error: "Skrotningsdatum krävs" },
        { status: 400 }
      )
    }

    if (!servicePartnerId) {
      return NextResponse.json(
        { error: "Servicepartner krävs" },
        { status: 400 }
      )
    }

    if (!(certificate instanceof File)) {
      return NextResponse.json(
        { error: "Skrotningsintyg krävs" },
        { status: 400 }
      )
    }

    if (certificate.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Filen får vara max 10 MB" },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.has(certificate.type)) {
      return NextResponse.json(
        { error: "Endast PDF och bildfiler stöds" },
        { status: 400 }
      )
    }

    if (recoveredRefrigerantKg === false) {
      return NextResponse.json(
        { error: "Återvunnen mängd måste vara 0 eller högre" },
        { status: 400 }
      )
    }

    const servicePartner = await prisma.companyMembership.findFirst({
      where: {
        OR: [{ id: servicePartnerId }, { userId: servicePartnerId }],
        companyId: auth.user.companyId,
        role: "CONTRACTOR",
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        userId: true,
        isCertifiedCompany: true,
        certificationValidUntil: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!servicePartner) {
      return NextResponse.json(
        { error: "Ogiltig servicepartner" },
        { status: 400 }
      )
    }

    const membershipId =
      auth.user.membershipId ??
      (await findCurrentMembershipId(auth.user.userId, auth.user.companyId))

    const documentId = randomUUID()
    const fileName = safeFileName(certificate.name)
    const path = `companies/${auth.user.companyId}/installations/${installation.id}/scrap/${documentId}-${fileName}`
    const blob = await put(path, certificate, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    try {
      const result = await prisma.$transaction(async (tx) => {
        const document = await tx.installationDocument.create({
          data: {
            id: documentId,
            installationId: installation.id,
            companyId: auth.user.companyId,
            uploadedById: auth.user.userId,
            fileName,
            originalFileName: certificate.name,
            fileUrl: blob.url,
            blobPath: blob.pathname,
            mimeType: certificate.type,
            sizeBytes: certificate.size,
            documentType: "OTHER",
            description: "Skrotningsintyg",
          },
        })

        const updatedInstallation = await tx.installation.update({
          where: {
            id: installation.id,
          },
          data: {
            scrappedAt,
            scrappedByCompanyMembershipId: membershipId,
            scrapComment,
            scrapCertificateUrl: blob.url,
            scrapCertificateFileName: certificate.name,
            scrapCertificateBlobPath: blob.pathname,
            scrapServicePartnerId: servicePartner.userId,
            recoveredRefrigerantKg:
              recoveredRefrigerantKg === null ? null : recoveredRefrigerantKg,
          },
        })

        return { document, updatedInstallation }
      })

      await logActivity({
        companyId: auth.user.companyId,
        installationId: installation.id,
        userId: auth.user.userId,
        action: "installation_scrapped",
        entityType: "installation",
        entityId: installation.id,
        metadata: {
          name: installation.name,
          scrappedAt: scrappedAt.toISOString(),
          servicePartnerId: servicePartner.userId,
          servicePartnerName:
            servicePartner.user.name || servicePartner.user.email,
          certificateDocumentId: result.document.id,
          recoveredRefrigerantKg:
            recoveredRefrigerantKg === null ? null : recoveredRefrigerantKg,
        },
      })

      return NextResponse.json(
        {
          ...result.updatedInstallation,
          scrapServicePartner: {
            id: servicePartner.userId,
            name: servicePartner.user.name,
            email: servicePartner.user.email,
            certificationStatus: getCertificationStatus({
              isCertifiedCompany: servicePartner.isCertifiedCompany,
              validUntil: servicePartner.certificationValidUntil,
            }),
          },
        },
        { status: 200 }
      )
    } catch (error) {
      await del(blob.pathname, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      throw error
    }
  } catch (error: unknown) {
    console.error("Scrap installation error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

async function findCurrentMembershipId(userId: string, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return membership?.id ?? null
}

function parseRequiredDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return false

  return parsed
}

function normalizeFormString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "skrotningsintyg"
  )
}
