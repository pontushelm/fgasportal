import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getActiveMembership } from "@/lib/memberships"

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
      },
    })
    const membership = await getActiveMembership(
      auth.user.userId,
      auth.user.companyId
    )

    return NextResponse.json(
      {
        ...auth.user,
        companyId: membership?.companyId ?? user?.companyId ?? auth.user.companyId,
        role: membership?.role ?? user?.role ?? auth.user.role,
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
