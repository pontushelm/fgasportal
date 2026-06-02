import type { AnnualFgasReportData, AnnualFgasSigningMetadata } from "@/lib/reports/annualFgasReportTypes"
import { hashString } from "@/lib/reports/hash"
import { stableStringify, toStableJsonValue } from "@/lib/reports/stableStringify"

export const ANNUAL_FGAS_SNAPSHOT_VERSION = 1
export const ANNUAL_FGAS_SNAPSHOT_SCHEMA = "annual_fgas_snapshot_v1"
export const ANNUAL_FGAS_REPORT_TYPE = "ANNUAL_FGAS"

export type ReportSnapshotScope = {
  type: "PROPERTY" | "MUNICIPALITY" | "COMPANY" | "CUSTOM"
  id?: string | null
  label?: string | null
  reportYear?: number | null
  municipality?: string | null
  propertyName?: string | null
  propertyDesignation?: string | null
}

export type AnnualFgasReportSnapshot = {
  snapshotVersion: number
  snapshotSchema: typeof ANNUAL_FGAS_SNAPSHOT_SCHEMA
  reportType: typeof ANNUAL_FGAS_REPORT_TYPE
  generatedAt: string
  scope: ReturnType<typeof toStableJsonValue>
  signingMetadata: ReturnType<typeof toStableJsonValue>
  report: ReturnType<typeof toStableJsonValue>
}

export type ReportSnapshotHashResult<TSnapshot> = {
  snapshot: TSnapshot
  snapshotJson: string
  snapshotSha256: string
}

export type BuildAnnualFgasReportSnapshotOptions = {
  generatedAt?: Date | string
  scope?: ReportSnapshotScope
  signingMetadata?: AnnualFgasSigningMetadata | null
}

function timestampToIsoString(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString()
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function inferAnnualFgasReportScope(report: AnnualFgasReportData): ReportSnapshotScope {
  const propertyDesignation = report.facility.propertyDesignation
  const propertyName = report.facility.name
  const municipality = report.facility.municipality
  const hasSingleProperty = report.facility.propertyCount === 1

  return {
    type: hasSingleProperty ? "PROPERTY" : municipality ? "MUNICIPALITY" : "CUSTOM",
    id: propertyDesignation,
    label: hasSingleProperty ? propertyName : municipality ?? propertyName,
    reportYear: report.reportYear,
    municipality,
    propertyName,
    propertyDesignation,
  }
}

export function createAnnualFgasReportSnapshot(
  report: AnnualFgasReportData,
  options: BuildAnnualFgasReportSnapshotOptions = {},
): AnnualFgasReportSnapshot {
  const signingMetadata = options.signingMetadata ?? report.signingMetadata ?? null

  return {
    snapshotVersion: ANNUAL_FGAS_SNAPSHOT_VERSION,
    snapshotSchema: ANNUAL_FGAS_SNAPSHOT_SCHEMA,
    reportType: ANNUAL_FGAS_REPORT_TYPE,
    generatedAt: timestampToIsoString(options.generatedAt),
    scope: toStableJsonValue(options.scope ?? inferAnnualFgasReportScope(report)),
    signingMetadata: toStableJsonValue(signingMetadata),
    report: toStableJsonValue(report),
  }
}

export function buildSnapshotHash<TSnapshot>(snapshot: TSnapshot): ReportSnapshotHashResult<TSnapshot> {
  const snapshotJson = stableStringify(snapshot)

  return {
    snapshot,
    snapshotJson,
    snapshotSha256: hashString(snapshotJson),
  }
}

export function buildAnnualFgasReportSnapshotHash(
  report: AnnualFgasReportData,
  options: BuildAnnualFgasReportSnapshotOptions = {},
): ReportSnapshotHashResult<AnnualFgasReportSnapshot> {
  return buildSnapshotHash(createAnnualFgasReportSnapshot(report, options))
}
