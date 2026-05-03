import { prisma } from "@/lib/db"
import { sendContractorAssignmentEmail } from "@/lib/email"

export async function notifyContractorsAboutNewAssignments(
  companyId: string,
  contractorIds: Array<string | null | undefined>
) {
  const uniqueContractorIds = Array.from(
    new Set(contractorIds.filter((id): id is string => Boolean(id)))
  )

  if (uniqueContractorIds.length === 0) return

  try {
    const contractors = await prisma.user.findMany({
      where: {
        id: {
          in: uniqueContractorIds,
        },
        companyId,
        role: "CONTRACTOR",
        isActive: true,
        notifyAssignmentEmails: true,
        email: {
          not: "",
        },
      },
      select: {
        id: true,
        email: true,
      },
    })
    const contractorsByEmail = new Map(
      contractors.map((contractor) => [
        contractor.email.toLowerCase(),
        contractor,
      ])
    )
    const contractorPortalUrl = `${getAppUrl()}/dashboard/service`

    await Promise.all(
      Array.from(contractorsByEmail.values()).map(async (contractor) => {
        try {
          await sendContractorAssignmentEmail({
            to: contractor.email,
            contractorPortalUrl,
          })
        } catch (error) {
          console.error("Contractor assignment notification failed", {
            contractorId: contractor.id,
            email: contractor.email,
            error,
          })
        }
      })
    )
  } catch (error) {
    console.error("Contractor assignment notification lookup failed", {
      companyId,
      contractorIds: uniqueContractorIds,
      error,
    })
  }
}

function getAppUrl() {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error("APP_URL is required")
  }

  return appUrl.replace(/\/$/, "")
}
