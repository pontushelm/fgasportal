import type { DocumentLinkEntityType, DocumentLinkRole } from "@prisma/client"
import type { AuthenticatedUser } from "@/lib/auth"
import {
  canAccessInstallation,
  getInstallationAccessWhereClause,
} from "@/lib/access/installation-access"
import { prisma as defaultPrisma } from "@/lib/db"

export type DocumentAccessLink = {
  entityType: DocumentLinkEntityType
  entityId: string
  role: DocumentLinkRole
}

export type DocumentAccessRecord = {
  companyId: string
  links: DocumentAccessLink[]
}

export type DocumentAccessGrant = {
  allowed: boolean
  grantedBy: DocumentAccessLink | null
}

type DocumentAccessPrismaClient = {
  installation: {
    findFirst(args: unknown): Promise<unknown>
  }
  installationEvent: {
    findFirst(args: unknown): Promise<unknown>
  }
  property: {
    findFirst(args: unknown): Promise<unknown>
  }
  serviceOrganizationMembership: {
    findFirst(args: unknown): Promise<unknown>
  }
  certificationRecord: {
    findFirst(args: unknown): Promise<unknown>
  }
}

type DocumentAccessInstallationRecord = {
  companyId: string
  assignedContractorId: string | null
  assignedServicePartnerCompanyId: string | null
}

type DocumentAccessInstallationEventRecord = {
  installation: DocumentAccessInstallationRecord
}

export async function resolveDocumentAccess(
  user: AuthenticatedUser,
  document: DocumentAccessRecord,
  prisma: DocumentAccessPrismaClient = defaultPrisma
): Promise<DocumentAccessGrant> {
  if (document.companyId !== user.companyId) {
    return { allowed: false, grantedBy: null }
  }

  for (const link of document.links) {
    if (await canAccessDocumentLink(user, link, prisma)) {
      return {
        allowed: true,
        grantedBy: link,
      }
    }
  }

  return { allowed: false, grantedBy: null }
}

async function canAccessDocumentLink(
  user: AuthenticatedUser,
  link: DocumentAccessLink,
  prisma: DocumentAccessPrismaClient
) {
  switch (link.entityType) {
    case "INSTALLATION":
      return canAccessInstallationLink(user, link.entityId, prisma)

    case "INSTALLATION_EVENT":
      return canAccessInstallationEventLink(user, link.entityId, prisma)

    case "PROPERTY":
      return canAccessPropertyLink(user, link.entityId, prisma)

    case "SERVICE_ORGANIZATION":
      return canAccessServiceOrganizationLink(user, link.entityId, prisma)

    case "CERTIFICATION_RECORD":
      return canAccessCertificationRecordLink(user, link.entityId, prisma)

    case "COMPANY":
      return link.entityId === user.companyId

    default:
      return false
  }
}

async function canAccessInstallationLink(
  user: AuthenticatedUser,
  installationId: string,
  prisma: DocumentAccessPrismaClient
) {
  const installation = (await prisma.installation.findFirst({
    where: {
      id: installationId,
      companyId: user.companyId,
    },
    select: {
      companyId: true,
      assignedContractorId: true,
      assignedServicePartnerCompanyId: true,
    },
  })) as DocumentAccessInstallationRecord | null

  return installation ? canAccessInstallation(user, installation) : false
}

async function canAccessInstallationEventLink(
  user: AuthenticatedUser,
  eventId: string,
  prisma: DocumentAccessPrismaClient
) {
  const event = (await prisma.installationEvent.findFirst({
    where: {
      id: eventId,
      installation: {
        companyId: user.companyId,
      },
    },
    select: {
      installation: {
        select: {
          companyId: true,
          assignedContractorId: true,
          assignedServicePartnerCompanyId: true,
        },
      },
    },
  })) as DocumentAccessInstallationEventRecord | null

  return event ? canAccessInstallation(user, event.installation) : false
}

async function canAccessPropertyLink(
  user: AuthenticatedUser,
  propertyId: string,
  prisma: DocumentAccessPrismaClient
) {
  if (user.role !== "CONTRACTOR") {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    })

    return Boolean(property)
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      companyId: user.companyId,
      installations: {
        some: getInstallationAccessWhereClause(user),
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(property)
}

async function canAccessServiceOrganizationLink(
  user: AuthenticatedUser,
  serviceOrganizationId: string,
  prisma: DocumentAccessPrismaClient
) {
  if (user.serviceOrganizationId === serviceOrganizationId) {
    return true
  }

  const membership = await prisma.serviceOrganizationMembership.findFirst({
    where: {
      serviceOrganizationId,
      userId: user.userId,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return Boolean(membership)
}

async function canAccessCertificationRecordLink(
  user: AuthenticatedUser,
  certificationRecordId: string,
  prisma: DocumentAccessPrismaClient
) {
  if (user.role !== "CONTRACTOR") return false

  const certificationRecord = (await prisma.certificationRecord.findFirst({
    where: {
      id: certificationRecordId,
      companyId: user.companyId,
      status: {
        notIn: ["DELETED", "REVOKED", "REPLACED"],
      },
    },
    select: {
      certificateType: true,
      serviceOrganizationId: true,
      subjectType: true,
      userId: true,
    },
  })) as {
    certificateType: string
    serviceOrganizationId: string | null
    subjectType: string
    userId: string | null
  } | null

  if (!certificationRecord?.serviceOrganizationId) return false

  if (
    certificationRecord.subjectType === "SERVICE_ORGANIZATION" &&
    certificationRecord.certificateType === "COMPANY_FGAS"
  ) {
    return canAccessServiceOrganizationCertificateLink(
      user,
      certificationRecord.serviceOrganizationId,
      prisma
    )
  }

  if (
    certificationRecord.subjectType !== "TECHNICIAN" ||
    certificationRecord.certificateType !== "PERSONAL_FGAS"
  ) {
    return false
  }

  if (certificationRecord.userId === user.userId) {
    return canAccessServiceOrganizationLink(
      user,
      certificationRecord.serviceOrganizationId,
      prisma
    )
  }

  if (
    !user.isServicePartnerAdmin ||
    user.serviceOrganizationId !== certificationRecord.serviceOrganizationId
  ) {
    return false
  }

  const membership = await prisma.serviceOrganizationMembership.findFirst({
    where: {
      serviceOrganizationId: certificationRecord.serviceOrganizationId,
      userId: user.userId,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return Boolean(membership)
}

async function canAccessServiceOrganizationCertificateLink(
  user: AuthenticatedUser,
  serviceOrganizationId: string,
  prisma: DocumentAccessPrismaClient
) {
  if (
    user.role !== "CONTRACTOR" ||
    !user.isServicePartnerAdmin ||
    user.serviceOrganizationId !== serviceOrganizationId
  ) {
    return false
  }

  const membership = await prisma.serviceOrganizationMembership.findFirst({
    where: {
      serviceOrganizationId,
      userId: user.userId,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return Boolean(membership)
}
