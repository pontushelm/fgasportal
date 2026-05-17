import type { AnnualFgasReportData } from "@/lib/reports/annualFgasReportTypes"

export function buildAnnualFgasReportFilename(
  report: Pick<AnnualFgasReportData, "facility">,
  year: number
) {
  if (report.facility.propertyCount === 1) {
    const propertySegment = slugifyFilenameSegment(
      report.facility.propertyDesignation || report.facility.name
    )

    if (propertySegment) {
      return `fgas-arsrapport-${propertySegment}-${year}.pdf`
    }
  }

  if (report.facility.propertyCount > 1) {
    return `fgas-arsrapport-flera-fastigheter-${year}.pdf`
  }

  return `fgas-arsrapport-${year}.pdf`
}

export function slugifyFilenameSegment(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
