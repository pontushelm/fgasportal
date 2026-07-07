import Link from "next/link"
import { notFound } from "next/navigation"
import {
  InternalAdminPortalClient,
  type InternalAdminCompany,
  type InternalAdminUserRow,
} from "@/components/admin/internal-admin-portal-client"
import { Card } from "@/components/ui"
import { getCurrentInternalAdminUser } from "@/lib/internal-admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function InternalAdminPage() {
  const internalAdmin = await getCurrentInternalAdminUser()

  if (!internalAdmin) notFound()

  const [companies, memberships] = await Promise.all([
    prisma.company.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        isActive: true,
        _count: {
          select: {
            installations: true,
            memberships: true,
          },
        },
      },
    }),
    prisma.companyMembership.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        company: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    }),
  ])
  const companyRows: InternalAdminCompany[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
    createdAt: company.createdAt.toISOString(),
    userCount: company._count.memberships,
    installationCount: company._count.installations,
    status: company.isActive ? "Active" : "Inactive",
  }))
  const userRows: InternalAdminUserRow[] = memberships.map((membership) => ({
    id: membership.user.id,
    membershipId: membership.id,
    name: membership.user.name,
    email: membership.user.email,
    companyName: membership.company.name,
    role: membership.role,
    lastLogin: null,
    status:
      membership.isActive && membership.user.isActive ? "Active" : "Inactive",
  }))

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Intern administration
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Helm Systems Admin
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Läsöversikt för pilotorganisationer och användare i Polar. Inga
              ändringar kan göras från den här vyn.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            href="/dashboard"
          >
            Till dashboard
          </Link>
        </div>

        <Card className="mb-6 border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm sm:p-5">
          Inloggad som intern administratör:{" "}
          <span className="font-semibold text-slate-950">
            {internalAdmin.name}
          </span>{" "}
          ({internalAdmin.email})
        </Card>

        <InternalAdminPortalClient companies={companyRows} users={userRows} />
      </div>
    </main>
  )
}
