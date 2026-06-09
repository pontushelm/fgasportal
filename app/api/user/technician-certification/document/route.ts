import { randomUUID } from "crypto"
import { del, put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"
import { buildGenericDocumentDownloadHref } from "@/lib/documents/documentHelpers"
import { hashBuffer } from "@/lib/reports/hash"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
])

type TechnicianCertificationDocument = {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: Date
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "CONTRACTOR") return forbiddenResponse()

    const context = await resolveActiveTechnicianCertificationContext(auth.user)
    if (!context) return forbiddenResponse()

    const certificationRecord = await findOwnTechnicianCertificationRecord({
      companyId: auth.user.companyId,
      serviceOrganizationId: context.serviceOrganizationId,
      userId: auth.user.userId,
    })

    if (!certificationRecord) {
      return NextResponse.json({ document: null }, { status: 200 })
    }

    const document = await findCurrentCertificationDocument({
      certificationRecordId: certificationRecord.id,
      companyId: auth.user.companyId,
      documentId: certificationRecord.documentId,
    })

    return NextResponse.json(
      { document: document ? toDocumentResponse(document) : null },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get technician certificate document error:", error)

    return NextResponse.json(
      { error: "Ett ovÃ¤ntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let uploadedBlobPath: string | null = null

  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "CONTRACTOR") return forbiddenResponse()

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Blob storage Ã¤r inte konfigurerat" },
        { status: 500 }
      )
    }

    const context = await resolveActiveTechnicianCertificationContext(auth.user)
    if (!context) return forbiddenResponse()

    const certificationRecord = await findOwnTechnicianCertificationRecord({
      companyId: auth.user.companyId,
      serviceOrganizationId: context.serviceOrganizationId,
      userId: auth.user.userId,
    })

    if (!certificationRecord) {
      return NextResponse.json(
        {
          error:
            "Spara personcertifikatet innan du laddar upp ett certifikatdokument.",
        },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fil saknas" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Filen fÃ¥r vara max 10 MB" },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Filtypen stÃ¶ds inte. Ladda upp PDF, JPG eller PNG." },
        { status: 400 }
      )
    }

    const documentId = randomUUID()
    const fileName = safeFileName(file.name)
    const fileBytes = Buffer.from(await file.arrayBuffer())
    const storageKey = `companies/${auth.user.companyId}/certifications/technicians/${certificationRecord.id}/${documentId}-${fileName}`
    const blob = await put(storageKey, fileBytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    uploadedBlobPath = blob.pathname

    const document = await prisma.$transaction(async (tx) => {
      const previousDocument = await findCurrentCertificationDocument({
        certificationRecordId: certificationRecord.id,
        companyId: auth.user.companyId,
        documentId: certificationRecord.documentId,
        prismaClient: tx,
      })

      const createdDocument = await tx.document.create({
        data: {
          id: documentId,
          companyId: auth.user.companyId,
          uploadedByUserId: auth.user.userId,
          originalFileName: file.name,
          fileName,
          contentType: file.type,
          sizeBytes: file.size,
          sha256: hashBuffer(fileBytes),
          storageProvider: "VERCEL_BLOB",
          storageKey: blob.pathname,
          category: "PERSONAL_FGAS_CERTIFICATE",
          source: "USER_UPLOAD",
          status: "ACTIVE",
          visibility: "SERVICE_PARTNER_VISIBLE",
          retentionPolicy: "RETAINED",
          description: "Personligt F-gascertifikat",
          metadata: {
            certificationRecordId: certificationRecord.id,
            certificateType: "PERSONAL_FGAS",
          },
        },
      })

      await tx.documentLink.create({
        data: {
          companyId: auth.user.companyId,
          documentId: createdDocument.id,
          entityType: "CERTIFICATION_RECORD",
          entityId: certificationRecord.id,
          role: "CERTIFICATE",
          linkedByUserId: auth.user.userId,
        },
      })

      if (previousDocument) {
        await tx.document.update({
          where: {
            id: previousDocument.id,
          },
          data: {
            status: "REPLACED",
            replacedAt: new Date(),
            replacedByDocumentId: createdDocument.id,
          },
        })
      }

      await tx.certificationRecord.update({
        where: {
          id: certificationRecord.id,
        },
        data: {
          documentId: createdDocument.id,
          updatedByUserId: auth.user.userId,
        },
      })

      return createdDocument
    })

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "certificate_document_uploaded",
      entityType: "document",
      entityId: document.id,
      metadata: {
        documentId: document.id,
        certificationRecordId: certificationRecord.id,
        category: document.category,
        fileName: document.originalFileName,
      },
    })

    return NextResponse.json(
      { document: toDocumentResponse(document) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Upload technician certificate document error:", error)

    if (uploadedBlobPath && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(uploadedBlobPath, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }).catch((deleteError) => {
        console.error("Certificate document Blob rollback failed:", deleteError)
      })
    }

    return NextResponse.json(
      { error: "Ett ovÃ¤ntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "CONTRACTOR") return forbiddenResponse()

    const context = await resolveActiveTechnicianCertificationContext(auth.user)
    if (!context) return forbiddenResponse()

    const certificationRecord = await findOwnTechnicianCertificationRecord({
      companyId: auth.user.companyId,
      serviceOrganizationId: context.serviceOrganizationId,
      userId: auth.user.userId,
    })

    if (!certificationRecord) {
      return NextResponse.json({ document: null }, { status: 200 })
    }

    const document = await findCurrentCertificationDocument({
      certificationRecordId: certificationRecord.id,
      companyId: auth.user.companyId,
      documentId: certificationRecord.documentId,
    })

    if (!document) {
      return NextResponse.json({ document: null }, { status: 200 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          deletedByUserId: auth.user.userId,
          deletionReason: "Teknikern tog bort certifikatdokumentet.",
        },
      })

      await tx.certificationRecord.update({
        where: {
          id: certificationRecord.id,
        },
        data: {
          documentId: null,
          updatedByUserId: auth.user.userId,
        },
      })
    })

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "certificate_document_deleted",
      entityType: "document",
      entityId: document.id,
      metadata: {
        documentId: document.id,
        certificationRecordId: certificationRecord.id,
        category: "PERSONAL_FGAS_CERTIFICATE",
        fileName: document.fileName,
      },
    })

    return NextResponse.json({ document: null }, { status: 200 })
  } catch (error) {
    console.error("Delete technician certificate document error:", error)

    return NextResponse.json(
      { error: "Ett ovÃ¤ntat fel uppstod" },
      { status: 500 }
    )
  }
}

async function resolveActiveTechnicianCertificationContext(user: {
  companyId: string
  membershipId?: string
  serviceOrganizationId?: string | null
  servicePartnerCompanyId?: string | null
  userId: string
}) {
  if (!user.membershipId || !user.servicePartnerCompanyId) return null

  const bridge = await ensureServiceOrganizationForLegacyCompany({
    companyId: user.companyId,
    servicePartnerCompanyId: user.servicePartnerCompanyId,
  })
  const serviceOrganizationId =
    bridge?.serviceOrganizationId ?? user.serviceOrganizationId ?? null
  if (!serviceOrganizationId) return null

  return {
    membershipId: user.membershipId,
    serviceOrganizationId,
  }
}

async function findOwnTechnicianCertificationRecord({
  companyId,
  serviceOrganizationId,
  userId,
}: {
  companyId: string
  serviceOrganizationId: string
  userId: string
}) {
  return prisma.certificationRecord.findFirst({
    where: {
      companyId,
      serviceOrganizationId,
      userId,
      subjectType: "TECHNICIAN",
      certificateType: "PERSONAL_FGAS",
      certificateNumber: {
        not: "",
      },
      status: {
        notIn: ["DELETED", "REVOKED", "REPLACED"],
      },
    },
    select: {
      id: true,
      documentId: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

async function findCurrentCertificationDocument({
  certificationRecordId,
  companyId,
  documentId,
  prismaClient = prisma,
}: {
  certificationRecordId: string
  companyId: string
  documentId?: string | null
  prismaClient?: Pick<typeof prisma, "document">
}) {
  const where = {
    companyId,
    category: "PERSONAL_FGAS_CERTIFICATE" as const,
    status: "ACTIVE" as const,
    links: {
      some: {
        entityType: "CERTIFICATION_RECORD" as const,
        entityId: certificationRecordId,
        role: "CERTIFICATE" as const,
      },
    },
  }

  if (documentId) {
    const document = await prismaClient.document.findFirst({
      where: {
        ...where,
        id: documentId,
      },
      select: certificationDocumentSelect,
    })

    if (document) return document
  }

  return prismaClient.document.findFirst({
    where,
    select: certificationDocumentSelect,
    orderBy: {
      createdAt: "desc",
    },
  })
}

function toDocumentResponse(document: TechnicianCertificationDocument) {
  return {
    id: document.id,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    downloadHref: buildGenericDocumentDownloadHref(document.id),
    uploadedAt: document.createdAt,
  }
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "certifikat"
  )
}

const certificationDocumentSelect = {
  id: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
}
