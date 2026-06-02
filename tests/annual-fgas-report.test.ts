import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AnnualReportTemplate } from "@/components/reports/AnnualFgasReportTemplate"

vi.mock("@/lib/db", () => ({
  prisma: {},
}))

import {
  buildAnnualFgasReportPropertyOverviewFromLoadedData,
} from "@/lib/fgas-report"
import {
  buildAnnualFgasReportQualitySummary,
  buildAnnualFgasReportWarnings,
  buildRefrigerantHandlingRow,
} from "@/lib/reports/annualFgasReportValidation"
import { buildAnnualFgasSigningMetadata } from "@/lib/reports/annualFgasSigning"
import {
  buildSignedAnnualReportCreateData,
  buildSignedAnnualReportHistoryWhere,
  mapSignedAnnualReportHistoryItem,
} from "@/lib/reports/signedAnnualFgasReports"
import type { AnnualFgasReportData } from "@/lib/reports/annualFgasReportTypes"
import { buildAnnualFgasReportFilename } from "@/lib/reports/annualFgasReportFilename"
import { summarizeAnnualFgasCo2e } from "@/lib/reports/annualFgasReportSummary"
import { selectPrimaryAnnualReportServicePartnerCompany } from "@/lib/reports/annualFgasServicePartner"

type AnnualOverviewInput = Parameters<
  typeof buildAnnualFgasReportPropertyOverviewFromLoadedData
>[0]
type AnnualOverviewInstallation = AnnualOverviewInput["installations"][number]

const overviewStartDate = new Date("2026-01-01T00:00:00.000Z")
const overviewEndDate = new Date("2027-01-01T00:00:00.000Z")

function buildOverviewInstallation(
  overrides: Partial<AnnualOverviewInstallation>
): AnnualOverviewInstallation {
  return {
    id: "installation-1",
    name: "Aggregat 1",
    equipmentId: "AGG-1",
    location: "Teknikrum",
    propertyName: null,
    equipmentType: "Kyl",
    refrigerantType: "R134a",
    refrigerantAmount: 10,
    hasLeakDetectionSystem: false,
    installationDate: new Date("2024-01-10T00:00:00.000Z"),
    lastInspection: new Date("2026-03-01T00:00:00.000Z"),
    nextInspection: new Date("2027-03-01T00:00:00.000Z"),
    isActive: true,
    archivedAt: null,
    scrappedAt: null,
    recoveredRefrigerantKg: null,
    scrapCertificateFileName: null,
    scrapComment: null,
    assignedContractorId: "user-technician-1",
    assignedServicePartnerCompanyId: "servicepartner-1",
    property: {
      id: "property-a",
      name: "Fastighet A",
      municipality: "Stockholm",
      propertyDesignation: "A:1",
    },
    assignedServicePartnerCompany: {
      name: "Kylservice AB",
      certificateNumber: "FC-123",
      serviceOrganization: null,
    },
    assignedContractor: {
      id: "user-technician-1",
      name: "Tekniker Ett",
      certificationNumber: "PC-123",
      company: {
        name: "Kylservice AB",
      },
      memberships: [
        {
          certificationNumber: "PC-123",
          certificationOrganization: null,
          certificationValidUntil: null,
          servicePartnerCompany: null,
        },
      ],
    },
    events: [],
    ...overrides,
  } as AnnualOverviewInstallation
}

describe("annual F-gas report summary", () => {
  it("returns a full CO2e total when all rows have known GWP values", () => {
    const summary = summarizeAnnualFgasCo2e([
      { co2eKg: 39220 },
      { co2eKg: 20880 },
    ])

    expect(summary.totalCo2eKg).toBe(60100)
    expect(summary.knownCo2eKg).toBe(60100)
    expect(summary.hasUnknownCo2e).toBe(false)
    expect(summary.unknownCo2eEquipmentCount).toBe(0)
  })

  it("does not present unknown CO2e rows as zero in the total", () => {
    const summary = summarizeAnnualFgasCo2e([
      { co2eKg: 39220 },
      { co2eKg: null },
    ])

    expect(summary.totalCo2eKg).toBeNull()
    expect(summary.knownCo2eKg).toBe(39220)
    expect(summary.hasUnknownCo2e).toBe(true)
    expect(summary.unknownCo2eEquipmentCount).toBe(1)
  })
})

describe("annual F-gas property overview", () => {
  it("builds the same overview-critical status from loaded company data", () => {
    const overview = buildAnnualFgasReportPropertyOverviewFromLoadedData({
      startDate: overviewStartDate,
      endDate: overviewEndDate,
      year: 2026,
      signedReportRecords: [
        {
          propertyId: "property-a",
          createdAt: new Date("2026-03-31T10:00:00.000Z"),
        },
      ],
      installations: [
        buildOverviewInstallation({
          id: "valid-control-required",
          name: "Kylrum A",
          equipmentId: "A-1",
          property: {
            id: "property-a",
            name: "Fastighet A",
            municipality: "Stockholm",
            propertyDesignation: "A:1",
          },
        }),
        buildOverviewInstallation({
          id: "unknown-refrigerant",
          name: "Kylrum B",
          equipmentId: "B-1",
          property: {
            id: "property-b",
            name: "Fastighet B",
            municipality: null,
            propertyDesignation: null,
          },
          refrigerantType: "",
          refrigerantAmount: 0,
          lastInspection: null,
          nextInspection: null,
          assignedContractorId: null,
          assignedServicePartnerCompanyId: null,
          assignedContractor: null,
          assignedServicePartnerCompany: null,
          events: [
            {
              id: "leak-current-year",
              type: "LEAK",
              refrigerantAddedKg: null,
              previousRefrigerantType: null,
              newRefrigerantType: null,
              previousAmountKg: null,
              newAmountKg: null,
              recoveredAmountKg: null,
              notes: null,
            },
            {
              id: "recovery-current-year",
              type: "RECOVERY",
              refrigerantAddedKg: null,
              previousRefrigerantType: null,
              newRefrigerantType: null,
              previousAmountKg: null,
              newAmountKg: null,
              recoveredAmountKg: null,
              notes: null,
            },
          ],
        }),
        buildOverviewInstallation({
          id: "scrapped-during-year",
          name: "Kylrum C",
          equipmentId: "C-1",
          property: {
            id: "property-c",
            name: "Fastighet C",
            municipality: "Uppsala",
            propertyDesignation: "C:1",
          },
          isActive: false,
          scrappedAt: new Date("2026-06-15T00:00:00.000Z"),
          recoveredRefrigerantKg: null,
          scrapCertificateFileName: null,
        }),
      ],
    })

    expect(overview.year).toBe(2026)
    expect(overview.properties.map((property) => property.id)).toEqual([
      "property-a",
      "property-b",
      "property-c",
    ])

    const signedProperty = overview.properties.find(
      (property) => property.id === "property-a"
    )
    expect(signedProperty).toMatchObject({
      annualReportRequirement: "REQUIRED",
      signedStatus: "SIGNED",
      blockingIssueCount: 0,
    })
    expect(signedProperty?.installedCo2eTon).toBeCloseTo(14.3)
    expect(signedProperty?.signedAt?.toISOString()).toBe(
      "2026-03-31T10:00:00.000Z"
    )

    const missingDataProperty = overview.properties.find(
      (property) => property.id === "property-b"
    )
    expect(missingDataProperty?.annualReportRequirement).toBe("UNCERTAIN")
    expect(missingDataProperty?.installedCo2eTon).toBeNull()
    expect(missingDataProperty?.blockingIssueCount).toBeGreaterThan(0)
    expect(missingDataProperty?.reviewWarningCount).toBeGreaterThan(0)

    const scrappedProperty = overview.properties.find(
      (property) => property.id === "property-c"
    )
    expect(scrappedProperty).toMatchObject({
      annualReportRequirement: "REQUIRED",
      signedStatus: "NOT_SIGNED",
      blockingIssueCount: 0,
    })
    expect(scrappedProperty?.reviewWarningCount).toBeGreaterThan(0)
  })
})

describe("annual F-gas report signing metadata", () => {
  it("allows unsigned exports without signing metadata", () => {
    const result = buildAnnualFgasSigningMetadata({
      searchParams: new URLSearchParams("year=2026"),
      user: { name: "Anna Andersson", email: "anna@example.com" },
    })

    expect(result).toEqual({ ok: true, metadata: null })
  })

  it("builds signed export metadata from the authenticated user", () => {
    const result = buildAnnualFgasSigningMetadata({
      searchParams: new URLSearchParams({
        signed: "1",
      }),
      signedAt: new Date("2026-03-31T10:15:00.000Z"),
      user: { name: "Anna Andersson", email: "anna@example.com" },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.metadata).toMatchObject({
      signerName: "Anna Andersson",
      signerEmail: "anna@example.com",
      signerRole: "Operatör",
      comment: null,
    })
    expect(result.metadata?.signingDate.toISOString()).toBe(
      "2026-03-31T10:15:00.000Z"
    )
  })

  it("rejects signed export when authenticated user metadata is incomplete", () => {
    const result = buildAnnualFgasSigningMetadata({
      searchParams: new URLSearchParams({
        signed: "1",
      }),
      user: { name: null, email: "" },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain("Inloggad användare saknar e-postadress.")
  })
})

describe("annual F-gas refrigerant handling", () => {
  it("treats recovery event amount as recovered refrigerant", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R404A",
      event: {
        id: "event-recovery",
        date: new Date("2026-02-01"),
        type: "RECOVERY",
        refrigerantAddedKg: 4.5,
        notes: null,
      },
    })

    expect(row.addedKg).toBeNull()
    expect(row.recoveredKg).toBe(4.5)
  })

  it("shows refrigerant change amounts and refrigerant transition when notes contain existing structured text", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R449A",
      event: {
        id: "event-change",
        date: new Date("2026-02-01"),
        type: "REFRIGERANT_CHANGE",
        refrigerantAddedKg: 10,
        notes:
          "Byte av köldmedium från R404A till R449A. Omhändertagen mängd: 9,5 kg.",
      },
    })

    expect(row.addedKg).toBe(10)
    expect(row.recoveredKg).toBe(9.5)
    expect(row.previousRefrigerantType).toBe("R404A")
    expect(row.newRefrigerantType).toBe("R449A")
  })

  it("prefers structured refrigerant change fields over notes", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R449A",
      event: {
        id: "event-change-structured",
        date: new Date("2026-02-01"),
        type: "REFRIGERANT_CHANGE",
        refrigerantAddedKg: 10,
        previousRefrigerantType: "R404A",
        newRefrigerantType: "R454C",
        previousAmountKg: 42,
        newAmountKg: 24,
        recoveredAmountKg: 18,
        notes: "Äldre anteckning med annan text.",
      },
    })

    expect(row.refrigerantType).toBe("R454C")
    expect(row.previousRefrigerantType).toBe("R404A")
    expect(row.newRefrigerantType).toBe("R454C")
    expect(row.previousAmountKg).toBe(42)
    expect(row.newAmountKg).toBe(24)
    expect(row.addedKg).toBe(24)
    expect(row.recoveredKg).toBe(18)
  })

  it("prefers structured recovery amount when available", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R404A",
      event: {
        id: "event-recovery-structured",
        date: new Date("2026-02-01"),
        type: "RECOVERY",
        refrigerantAddedKg: null,
        recoveredAmountKg: 7.25,
        notes: null,
      },
    })

    expect(row.recoveredKg).toBe(7.25)
  })
})

describe("signed annual F-gas report history", () => {
  it("builds signed history create data from report metadata and readiness", () => {
    const report = {
      facility: { name: "Skolan 1" },
      qualitySummary: {
        status: "HAS_WARNINGS",
        blockingIssueCount: 0,
        warningCount: 2,
        totalIssueCount: 2,
      },
      signingMetadata: {
        signerName: "Anna Andersson",
        signerEmail: "anna@example.com",
        signerRole: "Miljösamordnare",
        signingDate: new Date("2026-03-31"),
        comment: "Granskat mot tillgängligt underlag.",
        attestationText: "Intygande",
      },
    } as AnnualFgasReportData

    expect(
      buildSignedAnnualReportCreateData({
        artifactId: "artifact-a",
        companyId: "company-a",
        userId: "user-a",
        report,
        reportYear: 2026,
        municipality: "Malmö",
        propertyId: "property-a",
      })
    ).toMatchObject({
      artifactId: "artifact-a",
      companyId: "company-a",
      userId: "user-a",
      reportYear: 2026,
      municipality: "Malmö",
      propertyId: "property-a",
      propertyName: "Skolan 1",
      signerName: "Anna Andersson",
      signerRole: "Miljösamordnare",
      readinessStatus: "HAS_WARNINGS",
      blockingIssueCount: 0,
      reviewWarningCount: 2,
      legacyMetadataOnly: false,
    })
  })

  it("does not create signed history data for unsigned reports", () => {
    const report = {
      signingMetadata: null,
    } as AnnualFgasReportData

    expect(
      buildSignedAnnualReportCreateData({
        companyId: "company-a",
        userId: "user-a",
        report,
        reportYear: 2026,
        municipality: null,
        propertyId: null,
      })
    ).toBeNull()
  })

  it("scopes signed report history by company and contractor user when needed", () => {
    expect(
      buildSignedAnnualReportHistoryWhere({
        companyId: "company-a",
        isContractor: false,
        userId: "user-a",
      })
    ).toEqual({ companyId: "company-a" })

    expect(
      buildSignedAnnualReportHistoryWhere({
        companyId: "company-a",
        isContractor: true,
        userId: "user-a",
      })
    ).toEqual({ companyId: "company-a", userId: "user-a" })
  })

  it("maps history records with regeneration link and scope summary", () => {
    expect(
      mapSignedAnnualReportHistoryItem({
        id: "history-a",
        reportYear: 2026,
        municipality: "Malmö",
        propertyId: null,
        propertyName: null,
        signerName: "Anna Andersson",
        signerRole: "Miljösamordnare",
        signingDate: new Date("2026-03-31"),
        comment: null,
        readinessStatus: "READY",
        blockingIssueCount: 0,
        reviewWarningCount: 0,
        createdAt: new Date("2026-04-01"),
        user: { name: "Anna Andersson", email: "anna@example.com" },
      })
    ).toMatchObject({
      id: "history-a",
      scopeSummary: "Kommun: Malmö",
      regenerateHref: "/api/reports/annual-fgas?historyId=history-a",
    })
  })
})

describe("annual F-gas report warnings", () => {
  it("warns for incomplete report data without changing unknown CO2e totals", () => {
    const warnings = buildAnnualFgasReportWarnings({
      certificateRegister: [],
      co2eSummary: { unknownCo2eEquipmentCount: 1 },
      equipment: [
        {
          id: "installation-a",
          equipmentId: "VP1",
          name: "Kyl A",
          location: null,
          propertyName: null,
          equipmentType: null,
          refrigerantType: "Okänt",
          refrigerantAmountKg: 10,
          co2eKg: null,
          controlRequired: false,
          inspectionIntervalMonths: null,
          leakDetectionSystem: false,
          installedAt: null,
          lastInspectionAt: null,
          nextInspectionAt: null,
          status: "active",
        },
      ],
      refrigerantHandlingLog: [],
      reportInstallations: [
        {
          id: "installation-a",
          name: "Kyl A",
          equipmentId: "VP1",
          assignedContractorId: null,
          assignedContractor: null,
          events: [
            {
              id: "event-leak",
              type: "LEAK",
              refrigerantAddedKg: null,
              notes: "Läckage",
            },
            {
              id: "event-recovery",
              type: "RECOVERY",
              refrigerantAddedKg: null,
              notes: null,
            },
          ],
        },
      ],
      scrappedEquipment: [
        {
          id: "scrap-a",
          scrappedAt: new Date("2026-03-01"),
          equipmentName: "Kyl A",
          equipmentId: "VP1",
          refrigerantType: "R404A",
          refrigerantAmountKg: 10,
          recoveredKg: null,
          servicePartnerName: null,
          certificateFileName: null,
          notes: null,
        },
      ],
    })

    expect(warnings.map((warning) => warning.id)).toContain("unknown-co2e")
    expect(warnings.map((warning) => warning.id)).toContain("leak-missing-amount-event-leak")
    expect(warnings.map((warning) => warning.id)).toContain("recovery-missing-amount-event-recovery")
    expect(warnings.map((warning) => warning.id)).toContain("scrap-missing-certificate-scrap-a")
    expect(warnings.find((warning) => warning.id === "unknown-co2e")?.severity).toBe("blocking")
    expect(warnings.find((warning) => warning.id === "leak-missing-amount-event-leak")?.severity).toBe("review")
  })

  it("calculates readiness status from blocking and review warnings", () => {
    expect(buildAnnualFgasReportQualitySummary([])).toEqual({
      status: "READY",
      blockingIssueCount: 0,
      warningCount: 0,
      totalIssueCount: 0,
    })

    expect(
      buildAnnualFgasReportQualitySummary([
        {
          id: "missing-certificate",
          severity: "review",
          message: "Tilldelad servicepartner saknar registrerat certifikatnummer.",
        },
      ])
    ).toMatchObject({
      status: "HAS_WARNINGS",
      blockingIssueCount: 0,
      warningCount: 1,
    })

    expect(
      buildAnnualFgasReportQualitySummary([
        {
          id: "unknown-co2e",
          severity: "blocking",
          message: "Aggregat saknar känt GWP/CO₂e-värde.",
        },
      ])
    ).toMatchObject({
      status: "MISSING_REQUIRED_DATA",
      blockingIssueCount: 1,
      warningCount: 0,
    })
  })

  it("flags missing property designation as a review warning", () => {
    const warnings = buildAnnualFgasReportWarnings({
      certificateRegister: [
        {
          name: "Tekniker",
          role: "Ansvarig tekniker/servicepartner",
          company: "Kyl AB",
          certificateNumber: "CERT-1",
          certificateOrganization: null,
          validUntil: null,
        },
      ],
      co2eSummary: { unknownCo2eEquipmentCount: 0 },
      equipment: [
        {
          id: "installation-a",
          equipmentId: "VP1",
          name: "Kyl A",
          location: null,
          propertyName: "Skolan 1",
          equipmentType: null,
          refrigerantType: "R404A",
          refrigerantAmountKg: 10,
          co2eKg: 39220,
          controlRequired: false,
          inspectionIntervalMonths: null,
          leakDetectionSystem: false,
          installedAt: null,
          lastInspectionAt: null,
          nextInspectionAt: null,
          status: "active",
        },
      ],
      refrigerantHandlingLog: [],
      reportInstallations: [
        {
          id: "installation-a",
          name: "Kyl A",
          equipmentId: "VP1",
          assignedContractorId: "contractor-a",
          assignedContractor: {
            memberships: [{ certificationNumber: "CERT-1" }],
          },
          property: {
            municipality: "Malmö",
            propertyDesignation: null,
          },
          events: [],
        },
      ],
      scrappedEquipment: [],
    })

    expect(warnings).toContainEqual(
      expect.objectContaining({
        id: "missing-property-designation-installation-a",
        severity: "review",
      })
    )
  })

  it("does not warn for missing technician certificate when service partner company has certificate", () => {
    const warnings = buildAnnualFgasReportWarnings({
      certificateRegister: [],
      co2eSummary: { unknownCo2eEquipmentCount: 0 },
      equipment: [],
      refrigerantHandlingLog: [],
      reportInstallations: [
        {
          id: "installation-a",
          name: "Kyl A",
          equipmentId: "VP1",
          assignedContractorId: "contractor-a",
          assignedServicePartnerCompanyId: "service-company-a",
          assignedServicePartnerCompany: {
            certificateNumber: "FCERT-1",
          },
          assignedContractor: {
            memberships: [{ certificationNumber: null }],
          },
          property: {
            municipality: "Malmö",
            propertyDesignation: "Skolan 1",
          },
          events: [],
        },
      ],
      scrappedEquipment: [],
    })

    expect(warnings.map((warning) => warning.id)).not.toContain(
      "missing-certificate-installation-a"
    )
  })
})

describe("annual F-gas report service partner company mapping", () => {
  it("uses the assigned service partner company certificate for the PDF service partner box", () => {
    const company = selectPrimaryAnnualReportServicePartnerCompany([
      {
        assignedServicePartnerCompany: {
          name: "Servicepartner AB",
          contactEmail: "info@servicepartner.example",
          phone: "040-123 45",
          certificateNumber: "FCERT-123",
        },
      },
    ])

    expect(company).toMatchObject({
      name: "Servicepartner AB",
      certificateNumber: "FCERT-123",
    })
  })
})

describe("annual F-gas report filename", () => {
  it("uses property designation for single-property reports", () => {
    expect(
      buildAnnualFgasReportFilename(
        {
          facility: {
            name: "Förskolan Åsen",
            address: null,
            municipality: "Malmö",
            propertyDesignation: "Åsen 1:23",
            propertyCount: 1,
          },
        },
        2026
      )
    ).toBe("fgas-arsrapport-asen-1-23-2026.pdf")
  })

  it("uses a multi-property filename when several properties are included", () => {
    expect(
      buildAnnualFgasReportFilename(
        {
          facility: {
            name: "2 fastigheter",
            address: "Flera anläggningsadresser",
            municipality: "Flera kommuner",
            propertyDesignation: "Flera fastighetsbeteckningar",
            propertyCount: 2,
          },
        },
        2026
      )
    ).toBe("fgas-arsrapport-flera-fastigheter-2026.pdf")
  })
})

describe("annual F-gas PDF template", () => {
  it("does not render internal review warnings in the PDF", () => {
    const html = renderToStaticMarkup(
      createElement(AnnualReportTemplate, {
        report: {
          reportYear: 2026,
          generatedAt: new Date("2026-03-31T10:00:00.000Z"),
          period: {
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: new Date("2027-01-01T00:00:00.000Z"),
          },
          operator: {
            name: "Fastighetsbolaget AB",
            organizationNumber: "556000-0000",
            postalAddress: "Testgatan 1, 123 45 Teststad",
            billingAddress: null,
            contactPerson: null,
            contactEmail: null,
            contactPhone: null,
          },
          contact: {
            name: "Anna Andersson",
            email: "anna@example.com",
            phone: null,
          },
          facility: {
            name: "Skolan 1",
            address: "Skolgatan 1, 123 45 Teststad",
            municipality: "Malmö",
            propertyDesignation: "Skolan 1:1",
            propertyCount: 1,
          },
          responsibleContractor: {
            name: null,
            company: "Servicepartner AB",
            email: null,
            phone: null,
            certificateNumber: null,
          },
          signingMetadata: null,
          reportNotes: null,
          certificateRegister: [],
          summary: {
            equipmentCount: 1,
            controlRequiredCount: 1,
            unknownCo2eEquipmentCount: 0,
            totalRefrigerantKg: 10,
            totalCo2eKg: 20880,
            knownCo2eKg: 20880,
            leakageCount: 0,
            addedRefrigerantKg: 0,
            recoveredRefrigerantKg: 0,
            regeneratedReusedRefrigerantKg: null,
            scrappedEquipmentCount: 0,
          },
          qualitySummary: {
            status: "HAS_WARNINGS",
            blockingIssueCount: 0,
            warningCount: 1,
            totalIssueCount: 1,
          },
          warnings: [
            {
              id: "missing-certificate-installation-a",
              severity: "review",
              message: "Tilldelad servicepartner saknar registrerat certifikatnummer.",
              equipmentName: "Kyl A",
              equipmentId: "KA1",
            },
          ],
          equipment: [
            {
              id: "installation-a",
              equipmentId: "KA1",
              name: "Kyl A",
              location: null,
              propertyName: "Skolan 1",
              equipmentType: "Kylaggregat",
              refrigerantType: "R410A",
              refrigerantAmountKg: 10,
              co2eKg: 20880,
              controlRequired: true,
              inspectionIntervalMonths: 12,
              leakDetectionSystem: false,
              installedAt: null,
              lastInspectionAt: null,
              nextInspectionAt: null,
              status: "active",
            },
          ],
          leakageControls: [],
          refrigerantHandlingLog: [],
          scrappedEquipment: [],
          notes: [],
        },
      })
    )

    expect(html).not.toContain("Rapportunderlag att kontrollera")
    expect(html).not.toContain(
      "Rapporten kan skapas, men följande uppgifter bör kontrolleras"
    )
    expect(html).toContain("Aggregatförteckning")
  })
})
