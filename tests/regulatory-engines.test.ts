import { describe, expect, it } from "vitest"
import { buildDataQualityReport } from "@/lib/dashboard/data-quality"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { evaluateDataQuality } from "@/lib/regulatory/data-quality-engine"
import { evaluateInstallationCompliance } from "@/lib/regulatory/compliance-engine"
import { evaluateRegisterCompleteness } from "@/lib/regulatory/register-engine"
import { evaluateReportingRequirement } from "@/lib/regulatory/reporting-engine"

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
    expect(evaluation.thresholdTonCo2e).toBe(14)
    expect("intervalMonths" in evaluation).toBe(false)
  })

  it("documents current mobile reporting behavior for PR2 correction", () => {
    const evaluation = evaluateReportingRequirement({
      co2eTon: 15,
      installationRegisterType: "MOBILE",
    })

    expect(evaluation.annualReportRequirement).toBe("REQUIRED")
    expect(evaluation.reportingScope).toBe("INDIVIDUAL")
    expect(evaluation.reportRecipient).toBe("UNKNOWN")
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
