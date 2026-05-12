import { describe, expect, it } from "vitest"
import { buildServicePartnerCompanyMetrics } from "@/lib/service-partner-company-metrics"

describe("service partner company metrics", () => {
  it("groups service contacts by service partner company and aggregates operational metrics", () => {
    const metrics = buildServicePartnerCompanyMetrics({
      companies: [
        {
          id: "company-a",
          name: "Kylservice AB",
          organizationNumber: "556000-0000",
        },
      ],
      contractors: [
        {
          id: "contractor-a",
          servicePartnerCompany: {
            id: "company-a",
            name: "Kylservice AB",
            organizationNumber: "556000-0000",
          },
          certificationStatus: { status: "VALID" },
          assignedInstallationsCount: 4,
          overdueInspections: 1,
          dueSoonInspections: 2,
          highRiskInstallations: 1,
          leakageEventsCount: 3,
          latestActivityDate: "2026-05-10T10:00:00.000Z",
        },
        {
          id: "contractor-b",
          servicePartnerCompany: {
            id: "company-a",
            name: "Kylservice AB",
            organizationNumber: "556000-0000",
          },
          certificationStatus: { status: "EXPIRED" },
          assignedInstallationsCount: 2,
          overdueInspections: 0,
          dueSoonInspections: 1,
          highRiskInstallations: 0,
          leakageEventsCount: 1,
          latestActivityDate: "2026-05-11T10:00:00.000Z",
        },
      ],
    })

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      id: "company-a",
      linkedContactsCount: 2,
      assignedInstallationsCount: 6,
      overdueInspections: 1,
      dueSoonInspections: 3,
      highRiskInstallations: 1,
      leakageEventsCount: 4,
      certificationWarnings: 1,
      contractorIds: ["contractor-a", "contractor-b"],
    })
    expect(metrics[0].latestActivityDate).toBe("2026-05-11T10:00:00.000Z")
  })

  it("creates a separate group for contacts without service partner company", () => {
    const metrics = buildServicePartnerCompanyMetrics({
      companies: [],
      contractors: [
        {
          id: "contractor-a",
          servicePartnerCompany: null,
          certificationStatus: { status: "MISSING" },
          assignedInstallationsCount: 1,
          overdueInspections: 0,
          dueSoonInspections: 0,
          highRiskInstallations: 0,
          leakageEventsCount: 0,
          latestActivityDate: null,
        },
      ],
    })

    expect(metrics).toEqual([
      expect.objectContaining({
        id: null,
        name: "Saknar företagskoppling",
        isUnlinked: true,
        linkedContactsCount: 1,
        certificationWarnings: 1,
      }),
    ])
  })
})
