import { describe, expect, it } from "vitest"

import type { AnnualFgasReportData } from "@/lib/reports/annualFgasReportTypes"
import { hashBuffer, hashString } from "@/lib/reports/hash"
import {
  ANNUAL_FGAS_SNAPSHOT_SCHEMA,
  ANNUAL_FGAS_SNAPSHOT_VERSION,
  buildAnnualFgasReportSnapshotHash,
  createAnnualFgasReportSnapshot,
} from "@/lib/reports/reportSnapshot"
import { buildAnnualFgasSignedReportArtifactDraft } from "@/lib/reports/signedReportArtifacts"
import { stableStringify } from "@/lib/reports/stableStringify"

const generatedAt = new Date("2026-01-15T10:30:00.000Z")
const signedAt = new Date("2026-02-01T08:15:00.000Z")

function createReport(overrides: Partial<AnnualFgasReportData> = {}): AnnualFgasReportData {
  return {
    reportYear: 2025,
    generatedAt,
    period: {
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-12-31T23:59:59.999Z"),
    },
    operator: {
      name: "Helm Polar Test AB",
      organizationNumber: "559000-0000",
      postalAddress: "Testgatan 1",
      billingAddress: "Fakturagatan 2",
      contactPerson: "Anna Ansvarig",
      contactEmail: "anna@example.com",
      contactPhone: "070-000 00 00",
    },
    contact: {
      name: "Anna Ansvarig",
      email: "anna@example.com",
      phone: "070-000 00 00",
    },
    facility: {
      name: "Kvarteret Test",
      address: "Fastighetsvägen 4",
      municipality: "Stockholm",
      propertyDesignation: "Test 1:2",
      propertyCount: 1,
    },
    responsibleContractor: {
      name: "Serviceansvarig",
      company: "Kylservice AB",
      email: "service@example.com",
      phone: null,
      certificateNumber: "CERT-123",
    },
    signingMetadata: {
      signerName: "Anna Ansvarig",
      signerEmail: "anna@example.com",
      signerRole: "Operatör",
      signingDate: signedAt,
      comment: null,
      attestationText: "Rapporten har signerats elektroniskt.",
      signedReportId: null,
    },
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
      status: "READY",
      blockingIssueCount: 0,
      warningCount: 0,
      totalIssueCount: 0,
    },
    warnings: [],
    equipment: [
      {
        id: "installation-1",
        equipmentId: "AGG-1",
        name: "Aggregat 1",
        location: "Tak",
        propertyName: "Kvarteret Test",
        equipmentType: null,
        refrigerantType: "R410A",
        refrigerantAmountKg: 10,
        co2eKg: 20880,
        controlRequired: true,
        inspectionIntervalMonths: 12,
        leakDetectionSystem: false,
        installedAt: new Date("2024-01-01T00:00:00.000Z"),
        lastInspectionAt: new Date("2025-06-01T00:00:00.000Z"),
        nextInspectionAt: new Date("2026-06-01T00:00:00.000Z"),
        status: "active",
      },
    ],
    leakageControls: [],
    refrigerantHandlingLog: [],
    scrappedEquipment: [],
    notes: [],
    ...overrides,
  }
}

describe("stableStringify", () => {
  it("orders object keys deterministically and normalizes dates", () => {
    const left = { b: 2, a: { date: generatedAt, z: "last", first: true } }
    const right = { a: { first: true, z: "last", date: generatedAt }, b: 2 }

    expect(stableStringify(left)).toBe(stableStringify(right))
    expect(stableStringify(left)).toContain("2026-01-15T10:30:00.000Z")
  })
})

describe("report hashing", () => {
  it("hashes strings and buffers with SHA-256", () => {
    const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

    expect(hashString("hello")).toBe(expected)
    expect(hashBuffer(Buffer.from("hello", "utf8"))).toBe(expected)
  })
})

describe("annual F-gas report snapshots", () => {
  it("includes stable snapshot metadata", () => {
    const snapshot = createAnnualFgasReportSnapshot(createReport(), {
      artifactId: "artifact-1",
      generatedAt,
    })

    expect(snapshot.snapshotVersion).toBe(ANNUAL_FGAS_SNAPSHOT_VERSION)
    expect(snapshot.snapshotSchema).toBe(ANNUAL_FGAS_SNAPSHOT_SCHEMA)
    expect(snapshot.reportType).toBe("ANNUAL_FGAS")
    expect(snapshot.artifactId).toBe("artifact-1")
    expect(snapshot.generatedAt).toBe("2026-01-15T10:30:00.000Z")
  })

  it("produces the same hash for equivalent snapshots", () => {
    const report = createReport()
    const equivalentReport = {
      ...createReport(),
      operator: {
        contactPhone: "070-000 00 00",
        contactEmail: "anna@example.com",
        contactPerson: "Anna Ansvarig",
        billingAddress: "Fakturagatan 2",
        postalAddress: "Testgatan 1",
        organizationNumber: "559000-0000",
        name: "Helm Polar Test AB",
      },
    }

    const left = buildAnnualFgasReportSnapshotHash(report, { generatedAt })
    const right = buildAnnualFgasReportSnapshotHash(equivalentReport, { generatedAt })

    expect(left.snapshotJson).toBe(right.snapshotJson)
    expect(left.snapshotSha256).toBe(right.snapshotSha256)
  })

  it("changes the snapshot hash when report data changes", () => {
    const original = buildAnnualFgasReportSnapshotHash(createReport(), { generatedAt })
    const changed = buildAnnualFgasReportSnapshotHash(
      createReport({
        summary: {
          ...createReport().summary,
          totalRefrigerantKg: 11,
        },
      }),
      { generatedAt },
    )

    expect(changed.snapshotSha256).not.toBe(original.snapshotSha256)
  })

  it("preserves certification data in newly generated signed report snapshots", () => {
    const snapshot = createAnnualFgasReportSnapshot(
      createReport({
        responsibleContractor: {
          name: "Serviceansvarig",
          company: "Kylservice AB",
          email: "service@example.com",
          phone: null,
          certificateNumber: "FCERT-RECORD",
        },
        certificateRegister: [
          {
            name: "Tekniker Ett",
            role: "Ansvarig tekniker/servicepartner",
            company: "Kylservice AB",
            certificateNumber: "TECH-RECORD",
            certificateOrganization: "Personcert AB",
            validUntil: new Date("2028-05-01T00:00:00.000Z"),
          },
        ],
      }),
      { artifactId: "artifact-1", generatedAt }
    )

    const report = snapshot.report as {
      responsibleContractor: { certificateNumber: string }
      certificateRegister: Array<{
        certificateNumber: string
        certificateOrganization: string
      }>
    }

    expect(report.responsibleContractor.certificateNumber).toBe("FCERT-RECORD")
    expect(report.certificateRegister[0]).toMatchObject({
      certificateNumber: "TECH-RECORD",
      certificateOrganization: "Personcert AB",
    })
  })

  it("builds an annual artifact draft without storing anything", () => {
    const { artifact, snapshotResult } = buildAnnualFgasSignedReportArtifactDraft({
      artifactId: "artifact-1",
      companyId: "company-1",
      report: createReport(),
      generatedAt,
      scope: {
        type: "PROPERTY",
        id: "property-1",
        label: "Kvarteret Test",
        reportYear: 2025,
      },
      signer: {
        signedByUserId: "user-1",
        signerName: "Anna Ansvarig",
        signerEmail: "anna@example.com",
        signerRole: "Operatör",
        signingText: "Rapporten har signerats elektroniskt.",
        signedAt,
      },
    })

    expect(artifact.id).toBe("artifact-1")
    expect(artifact.companyId).toBe("company-1")
    expect(artifact.reportType).toBe("ANNUAL_FGAS")
    expect(artifact.scopeType).toBe("PROPERTY")
    expect(artifact.snapshotSchema).toBe(ANNUAL_FGAS_SNAPSHOT_SCHEMA)
    expect(snapshotResult.snapshot.artifactId).toBe("artifact-1")
    expect(artifact.snapshotSha256).toBe(snapshotResult.snapshotSha256)
    expect(artifact.pdfStorageKey).toBeNull()
  })
})
