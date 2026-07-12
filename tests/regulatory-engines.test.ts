import { describe, expect, it } from "vitest"
import { buildDataQualityReport } from "@/lib/dashboard/data-quality"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { evaluateDataQuality } from "@/lib/regulatory/data-quality-engine"
import { evaluateInstallationCompliance } from "@/lib/regulatory/compliance-engine"
import { evaluateRegisterCompleteness } from "@/lib/regulatory/register-engine"
import {
  buildReportingGroups,
  evaluateReportingRequirement,
} from "@/lib/regulatory/reporting-engine"

describe("regulatory engines", () => {
  it("preserves existing installation compliance behavior", () => {
    const legacy = calculateInstallationCompliance(
      "R410A",
      4.8,
      true,
      null,
      null,
      true
    )
    const evaluation = evaluateInstallationCompliance({
      refrigerantType: "R410A",
      refrigerantAmount: 4.8,
      hasLeakDetectionSystem: true,
      isHermeticallySealed: true,
    })

    expect(evaluation.co2eTon).toBe(legacy.co2eTon)
    expect(evaluation.inspectionIntervalMonths).toBe(
      legacy.inspectionIntervalMonths
    )
    expect(evaluation.intervalMonths).toBe(legacy.inspectionIntervalMonths)
    expect(evaluation.status).toBe(legacy.status)
    expect(evaluation.reasonCode).toBe(legacy.leakCheckReasonCode)
    expect(evaluation.isLeakCheckRequired).toBe(
      legacy.inspectionObligation.isLeakCheckRequired
    )
    expect("reportingScope" in evaluation).toBe(false)
  })

  it("keeps reporting threshold logic separate from leak-check intervals", () => {
    const evaluation = evaluateReportingRequirement({
      co2eTon: 15,
      installationRegisterType: "STATIONARY",
    })

    expect(evaluation.annualReportRequirement).toBe("REQUIRED")
    expect(evaluation.isReportable).toBe(true)
    expect(evaluation.reportRecipient).toBe("MUNICIPALITY")
    expect(evaluation.reportingScope).toBe("PROPERTY")
    expect(evaluation.thresholdBasis).toBe("CO2E_TONNES")
    expect(evaluation.thresholdValue).toBe(14)
    expect("intervalMonths" in evaluation).toBe(false)
  })

  it("routes ordinary mobile reporting to the municipality per individual unit", () => {
    const evaluation = evaluateReportingRequirement({
      co2eTon: 15,
      installationRegisterType: "MOBILE",
    })

    expect(evaluation.annualReportRequirement).toBe("REQUIRED")
    expect(evaluation.reportingScope).toBe("INDIVIDUAL")
    expect(evaluation.reportRecipient).toBe("MUNICIPALITY")
    expect(evaluation.reportReason).toBe(
      "MOBILE_INDIVIDUAL_AT_OR_ABOVE_THRESHOLD"
    )
  })

  it("uses a >= 14 tonnes CO2e reporting threshold", () => {
    expect(
      evaluateReportingRequirement({ co2eTon: 13.999 }).annualReportRequirement
    ).toBe("NOT_REQUIRED")
    expect(
      evaluateReportingRequirement({ co2eTon: 14 }).annualReportRequirement
    ).toBe("REQUIRED")
    expect(
      evaluateReportingRequirement({ co2eTon: 14.001 }).annualReportRequirement
    ).toBe("REQUIRED")
  })

  it("aggregates stationary installations per property only", () => {
    const groups = buildReportingGroups([
      {
        co2eTon: 8,
        id: "a",
        installationRegisterType: "STATIONARY",
        propertyId: "property-1",
        propertyName: "Fastighet 1",
      },
      {
        co2eTon: 7,
        id: "b",
        installationRegisterType: "STATIONARY",
        propertyId: "property-1",
        propertyName: "Fastighet 1",
      },
      {
        co2eTon: 13,
        id: "c",
        installationRegisterType: "STATIONARY",
        propertyId: "property-2",
        propertyName: "Fastighet 2",
      },
    ])

    const propertyOne = groups.find(
      (group) => group.reportGroupId === "property:property-1"
    )
    const propertyTwo = groups.find(
      (group) => group.reportGroupId === "property:property-2"
    )

    expect(groups).toHaveLength(2)
    expect(propertyOne?.annualReportRequirement).toBe("REQUIRED")
    expect(propertyTwo?.annualReportRequirement).toBe("NOT_REQUIRED")
  })

  it("never aggregates ordinary mobile installations with each other", () => {
    const groups = buildReportingGroups([
      { co2eTon: 8, id: "mobile-a", installationRegisterType: "MOBILE" },
      { co2eTon: 7, id: "mobile-b", installationRegisterType: "MOBILE" },
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.reportGroupId)).toEqual([
      "installation:mobile-a",
      "installation:mobile-b",
    ])
    expect(groups.every((group) => group.annualReportRequirement === "NOT_REQUIRED"))
      .toBe(true)
  })

  it("reports only individually qualifying ordinary mobile units", () => {
    const groups = buildReportingGroups([
      { co2eTon: 18, id: "mobile-a", installationRegisterType: "MOBILE" },
      { co2eTon: 8, id: "mobile-b", installationRegisterType: "MOBILE" },
      { co2eTon: 6, id: "mobile-c", installationRegisterType: "MOBILE" },
    ])
    const reportableGroups = groups.filter((group) => group.isReportable)

    expect(reportableGroups).toHaveLength(1)
    expect(reportableGroups[0].reportGroupId).toBe("installation:mobile-a")
    expect(reportableGroups[0].reportRecipient).toBe("MUNICIPALITY")
  })

  it("aggregates vessel equipment by identified vessel and routes to Transportstyrelsen", () => {
    const groups = buildReportingGroups([
      {
        co2eTon: 8,
        id: "aurora-a",
        installationRegisterType: "MOBILE",
        isInstalledOnVessel: true,
        mobileUnitName: "Aurora",
      },
      {
        co2eTon: 7,
        id: "aurora-b",
        installationRegisterType: "MOBILE",
        isInstalledOnVessel: true,
        mobileUnitName: "Aurora",
      },
      {
        co2eTon: 10,
        id: "borealis-a",
        installationRegisterType: "MOBILE",
        isInstalledOnVessel: true,
        mobileUnitName: "Borealis",
      },
    ])

    expect(groups).toHaveLength(2)
    const aurora = groups.find((group) => group.reportGroupId === "vessel:aurora")
    const borealis = groups.find(
      (group) => group.reportGroupId === "vessel:borealis"
    )

    expect(aurora?.annualReportRequirement).toBe("REQUIRED")
    expect(aurora?.reportRecipient).toBe("TRANSPORT_AGENCY")
    expect(aurora?.installationIds).toEqual(["aurora-a", "aurora-b"])
    expect(borealis?.annualReportRequirement).toBe("NOT_REQUIRED")
  })

  it("does not group unidentified vessel equipment into a fake vessel", () => {
    const groups = buildReportingGroups([
      {
        co2eTon: 20,
        id: "missing-vessel",
        installationRegisterType: "MOBILE",
        isInstalledOnVessel: true,
      },
    ])

    expect(groups).toEqual([])
  })

  it("returns uncertain reporting when CO2e cannot be calculated", () => {
    expect(
      evaluateReportingRequirement({
        co2eTon: null,
        installationRegisterType: "STATIONARY",
      }).annualReportRequirement
    ).toBe("UNCERTAIN")
  })

  it("keeps register completeness separate from reportability", () => {
    const evaluation = evaluateRegisterCompleteness({
      propertyId: null,
      refrigerantAmount: 0,
      refrigerantType: "",
    })

    expect(evaluation.isComplete).toBe(false)
    expect(evaluation.issueIds).toEqual([
      "INSTALLATION_MISSING_PROPERTY",
      "INSTALLATION_MISSING_REFRIGERANT",
      "INSTALLATION_MISSING_CHARGE",
    ])
    expect("annualReportRequirement" in evaluation).toBe(false)
    expect("isReportable" in evaluation).toBe(false)
  })

  it("preserves data quality issue output through the data quality engine", () => {
    const input = {
      installations: [
        {
          propertyId: "property-1",
          refrigerantAmount: 10,
          refrigerantType: "R22",
        },
      ],
      properties: [
        {
          municipality: null,
          propertyDesignation: null,
        },
      ],
    }

    const legacy = buildDataQualityReport(input)
    const evaluation = evaluateDataQuality(input)

    expect(evaluation.score).toBe(legacy.score)
    expect(evaluation.issues.map((issue) => issue.id)).toEqual(
      legacy.issues.map((issue) => issue.id)
    )
    expect(evaluation.issues.map((issue) => issue.severity)).toEqual(
      legacy.issues.map((issue) => issue.severity)
    )
  })
})
