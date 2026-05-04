import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getActiveMembership,
  getMembershipById,
  getUserMemberships,
} from "@/lib/memberships"

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const user = await prisma.user.findUnique({
      where: {
        id: auth.user.userId,
      },
      select: {
        email: true,
        name: true,
        role: true,
        companyId: true,
        themePreference: true,
        notifyAssignmentEmails: true,
        notifyInspectionReminderEmails: true,
        notifyDocumentEmails: true,
        notifyAnnualReportDeadlineEmails: true,
        notifyLeakEmails: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    })
    const [membership, memberships] = await Promise.all([
      auth.user.membershipId
        ? getMembershipById(auth.user.userId, auth.user.membershipId)
        : getActiveMembership(auth.user.userId, auth.user.companyId),
      getUserMemberships(auth.user.userId),
    ])
    const activeCompanyId =
      membership?.companyId ?? user?.companyId ?? auth.user.companyId
    const activeRole = membership?.role ?? user?.role ?? auth.user.role
    const normalizedMemberships = memberships.map((item) => ({
      id: item.id,
      companyId: item.companyId,
      companyName: item.company.name,
      role: item.role,
    }))

    return NextResponse.json(
      {
        ...auth.user,
        membershipId: membership?.id ?? auth.user.membershipId,
        companyId: activeCompanyId,
        companyName: membership?.company.name ?? user?.company.name ?? null,
        role: activeRole,
        memberships: normalizedMemberships,
        activeMembershipId: membership?.id ?? null,
        email: user?.email ?? null,
        name: user?.name ?? null,
        themePreference: normalizeThemePreference(user?.themePreference),
        notifyAssignmentEmails: user?.notifyAssignmentEmails ?? true,
        notifyInspectionReminderEmails:
          user?.notifyInspectionReminderEmails ?? true,
        notifyDocumentEmails: user?.notifyDocumentEmails ?? true,
        notifyAnnualReportDeadlineEmails:
          user?.notifyAnnualReportDeadlineEmails ?? true,
        notifyLeakEmails: user?.notifyLeakEmails ?? true,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get current user error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function normalizeThemePreference(themePreference?: string | null) {
  return themePreference === "dark" ? "dark" : "light"
}
