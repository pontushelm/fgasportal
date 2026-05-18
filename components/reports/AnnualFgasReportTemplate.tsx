/* eslint-disable @next/next/no-head-element, @next/next/no-img-element */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ReactNode } from "react"
import type {
  AnnualFgasCertificateEntry,
  AnnualFgasEquipmentRow,
  AnnualFgasRefrigerantHandlingRow,
  AnnualFgasReportData,
  AnnualFgasScrappedEquipmentRow,
} from "@/lib/reports/annualFgasReportTypes"

export function AnnualReportTemplate({ report }: { report: AnnualFgasReportData }) {
  return (
    <html lang="sv">
      <head>
        <meta charSet="utf-8" />
        <title>Årsrapport F-gas {report.reportYear}</title>
        <style>{annualReportPrintStyles}</style>
      </head>
      <body>
        <main className="report-page">
          <ReportHeader report={report} />

          <ReportSection title="Operatör">
            <div className="field-grid field-grid-2">
              <Field label="Företagsnamn" value={report.operator.name} />
              <Field label="Organisationsnummer" value={report.operator.organizationNumber} />
              <Field label="Postadress" value={report.operator.postalAddress} />
              <Field label="Fakturaadress" value={report.operator.billingAddress} />
            </div>
          </ReportSection>

          <ReportSection title="Kontaktuppgifter">
            <div className="field-grid field-grid-3">
              <Field label="Kontaktperson" value={report.contact.name} />
              <Field label="E-post" value={report.contact.email} />
              <Field label="Telefon" value={report.contact.phone} />
            </div>
          </ReportSection>

          <ReportSection title="Anläggningsuppgifter">
            <div className="field-grid field-grid-2">
              <Field label="Anläggningsadress" value={report.facility.address} />
              <Field label="Kommun" value={report.facility.municipality} />
              <Field label="Fastighetsbeteckning" value={report.facility.propertyDesignation} />
            </div>
          </ReportSection>

          <div className="summary-grid">
            <SummaryBox
              title="Sammanfattning"
              rows={[
                ["Antal aggregat i rapporten", formatInteger(report.summary.equipmentCount)],
                ["Total köldmediemängd", `${formatInteger(report.summary.totalRefrigerantKg)} kg`],
                ["Total CO₂e", formatCo2eSummary(report)],
                ["Antal läckage", formatInteger(report.summary.leakageCount)],
                ["Påfylld köldmediemängd", `${formatNumber(report.summary.addedRefrigerantKg)} kg`],
                ["Återvunnen köldmediemängd", `${formatNumber(report.summary.recoveredRefrigerantKg)} kg`],
              ]}
            />
            <SummaryBox
              title="Servicepartner"
              rows={[
                ["Företag", report.responsibleContractor.company || report.responsibleContractor.name || "-"],
                ["Företagscertifikat nr", report.responsibleContractor.certificateNumber || "-"],
                ["Telefon", report.responsibleContractor.phone || "-"],
                ["E-post", report.responsibleContractor.email || "-"],
              ]}
            />
          </div>

          <ReportQualitySummary report={report} />

          {report.summary.totalCo2eKg === null && (
            <p className="warning-box">
              Total CO₂e kan inte beräknas fullständigt eftersom ett eller flera
              aggregat saknar känt GWP-värde. Känd delsumma:{" "}
              {formatNumber(report.summary.knownCo2eKg)} kg CO₂e.
            </p>
          )}

          {report.warnings.length > 0 && (
            <ReportWarnings rows={report.warnings} />
          )}

          <ReportSection title="Aggregatförteckning">
            <EquipmentList
              rows={report.equipment}
              refrigerantHandlingRows={report.refrigerantHandlingLog}
            />
          </ReportSection>

          {report.refrigerantHandlingLog.length > 0 && (
            <ReportSection title="Köldmediehantering - händelser under året">
              <DataTable
                columns={["Datum", "Aggregat", "Typ", "Köldmedium", "Påfyllt", "Omhändertaget/återvunnet", "Anteckning"]}
                rows={report.refrigerantHandlingLog.map((row) => [
                  formatDate(row.date),
                  displayEquipment(row.equipmentName, row.equipmentId),
                  row.eventType,
                  formatHandlingRefrigerant(row),
                  formatOptionalNumber(row.addedKg),
                  formatOptionalNumber(row.recoveredKg),
                  row.notes || "-",
                ])}
              />
            </ReportSection>
          )}

          <CertificateRegister rows={report.certificateRegister} />

          {report.summary.regeneratedReusedRefrigerantKg != null &&
            report.summary.regeneratedReusedRefrigerantKg > 0 && (
            <ReportSection title="Regenererat eller återanvänt köldmedium">
              <DataTable
                columns={["Datum", "Aggregat", "Köldmedium", "Mängd", "Anteckning"]}
                rows={report.refrigerantHandlingLog
                  .filter((row) => row.regeneratedReusedKg != null && row.regeneratedReusedKg > 0)
                  .map((row) => [
                    formatDate(row.date),
                    displayEquipment(row.equipmentName, row.equipmentId),
                    row.refrigerantType,
                    `${formatNumber(row.regeneratedReusedKg ?? 0)} kg`,
                    row.notes || "-",
                  ])}
              />
            </ReportSection>
          )}

          {report.scrappedEquipment.length > 0 && (
            <ScrappedEquipmentSection rows={report.scrappedEquipment} />
          )}

          <ReportSection title="Övriga anteckningar">
            {report.reportNotes ? (
              <p className="note-box">{report.reportNotes}</p>
            ) : (
              <p className="muted">Inga övriga anteckningar angivna.</p>
            )}
          </ReportSection>

          {report.signingMetadata && <SigningMetadataSection report={report} />}

          <SignatureSection />
        </main>
      </body>
    </html>
  )
}

export function ReportHeader({ report }: { report: AnnualFgasReportData }) {
  const logoDataUri = getReportLogoDataUri()

  return (
    <header className="report-header">
      <div>
        <h1>Årsrapport enligt 15 § Förordning (2016:1128) om fluorerade växthusgaser</h1>
        <p>Rapportår: {report.reportYear}</p>
      </div>
      <div className="header-meta">
        {logoDataUri && (
          <img
            alt="FgasPortal"
            className="report-logo"
            src={logoDataUri}
          />
        )}
        <p>Skapad: {formatDate(report.generatedAt)}</p>
      </div>
    </header>
  )
}

export function ReportSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: Array<Array<ReactNode>>
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? (
          rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="empty-cell">
              Inga uppgifter registrerade för valt rapportår.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function SummaryBox({
  rows,
  title,
}: {
  rows: Array<[string, ReactNode]>
  title: string
}) {
  return (
    <section className="summary-box">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SignatureSection() {
  return (
    <section className="signature-section">
      <div>
        <p>Operatörens underskrift:</p>
        <div className="signature-line" />
        <p>Namnförtydligande</p>
      </div>
      <div>
        <p>Datum:</p>
        <div className="signature-line" />
      </div>
    </section>
  )
}

export function SigningMetadataSection({ report }: { report: AnnualFgasReportData }) {
  const signing = report.signingMetadata
  if (!signing) return null

  return (
    <ReportSection title="Intygande och signering">
      <div className="signing-box">
        <p className="strong">{signing.attestationText}</p>
        <div className="field-grid field-grid-2 signing-fields">
          <Field label="Signeras av" value={signing.signerName} />
          <Field label="Roll/titel" value={signing.signerRole} />
          <Field label="Signeringsdatum" value={formatDate(signing.signingDate)} />
          <Field label="FÃ¶retag" value={report.operator.name} />
        </div>
        {signing.comment && (
          <div className="signing-comment">
            <span>Kommentar:</span>
            <p>{signing.comment}</p>
          </div>
        )}
      </div>
    </ReportSection>
  )
}

export function CertificateRegister({
  rows,
}: {
  rows: AnnualFgasCertificateEntry[]
}) {
  return (
    <ReportSection title="Certifikatregister för tekniker">
      <DataTable
        columns={["Namn", "Roll", "Företag", "Certifikatnummer", "Certifieringsorgan", "Giltigt till"]}
        rows={rows.map((row) => [
          row.name,
          row.role,
          row.company || "-",
          row.certificateNumber || "-",
          row.certificateOrganization || "-",
          formatDate(row.validUntil),
        ])}
      />
    </ReportSection>
  )
}

export function ReportWarnings({
  rows,
}: {
  rows: AnnualFgasReportData["warnings"]
}) {
  return (
    <ReportSection title="Rapportunderlag att kontrollera">
      <p className="muted">
        Rapporten kan skapas, men följande uppgifter bör kontrolleras innan den
        skickas till tillsynsmyndigheten.
      </p>
      <ul className="warning-list">
        {rows.map((row) => (
          <li key={row.id} className={row.severity === "blocking" ? "warning-required" : undefined}>
            <strong>{row.severity === "blocking" ? "Kräver komplettering: " : "Bör granskas: "}</strong>
            {row.equipmentName
              ? `${displayEquipment(row.equipmentName, row.equipmentId ?? null)}: ${row.message}`
              : row.message}
          </li>
        ))}
      </ul>
    </ReportSection>
  )
}

export function ReportQualitySummary({ report }: { report: AnnualFgasReportData }) {
  const status = report.qualitySummary

  return (
    <ReportSection title="Rapportstatus">
      <div className={`quality-box quality-${status.status.toLowerCase()}`}>
        <div>
          <p className="quality-label">{qualityStatusLabel(status.status)}</p>
          <p className="muted">
            Bedömningen baseras på uppgifter som finns registrerade i FgasPortal.
            Rapporten bör kontrolleras mot organisationens rutiner innan den skickas.
          </p>
        </div>
        <dl>
          <div>
            <dt>Kräver komplettering</dt>
            <dd>{formatInteger(status.blockingIssueCount)}</dd>
          </div>
          <div>
            <dt>Bör granskas</dt>
            <dd>{formatInteger(status.warningCount)}</dd>
          </div>
        </dl>
      </div>
      {report.warnings.length > 0 && (
        <ul className="quality-list">
          {report.warnings.slice(0, 4).map((warning) => (
            <li key={warning.id}>
              {warning.equipmentName
                ? `${displayEquipment(warning.equipmentName, warning.equipmentId ?? null)}: ${warning.message}`
                : warning.message}
            </li>
          ))}
        </ul>
      )}
    </ReportSection>
  )
}

function EquipmentList({
  refrigerantHandlingRows,
  rows,
}: {
  refrigerantHandlingRows: AnnualFgasRefrigerantHandlingRow[]
  rows: AnnualFgasEquipmentRow[]
}) {
  const addedByEquipment = new Map<string, number>()
  const recoveredByEquipment = new Map<string, number>()

  refrigerantHandlingRows.forEach((row) => {
    const key = row.equipmentId || row.equipmentName
    addedByEquipment.set(key, (addedByEquipment.get(key) ?? 0) + (row.addedKg ?? 0))
    recoveredByEquipment.set(
      key,
      (recoveredByEquipment.get(key) ?? 0) + (row.recoveredKg ?? 0)
    )
  })

  return (
    <DataTable
      columns={[
        "Aggregat-ID",
        "Typ",
        "Köldmedium",
        "Fyllnadsmängd (kg)",
        "CO₂e (ton)",
        "Gaslarm",
        // TODO: Split refill origin into new/regenerated/reused once event forms and imports store that distinction.
        "Påfyllt (kg)",
        "Omhändertaget/återvunnet (kg)",
      ]}
      rows={rows.map((row) => {
        const key = row.equipmentId || row.name
        return [
          row.equipmentId || row.name,
          row.equipmentType || "-",
          row.refrigerantType,
          formatNumber(row.refrigerantAmountKg),
          formatCo2eTon(row.co2eKg),
          row.leakDetectionSystem ? "Ja" : "Nej",
          formatOptionalNumber(addedByEquipment.get(key)),
          formatOptionalNumber(recoveredByEquipment.get(key)),
        ]
      })}
    />
  )
}

export function ScrappedEquipmentSection({
  rows,
}: {
  rows: AnnualFgasScrappedEquipmentRow[]
}) {
  return (
    <ReportSection title="Skrotade eller avvecklade aggregat">
      <DataTable
        columns={["Datum", "Aggregat", "Köldmedium", "Mängd", "Återvunnet", "Servicepartner", "Intyg", "Anteckning"]}
        rows={rows.map((row) => [
          formatDate(row.scrappedAt),
          displayEquipment(row.equipmentName, row.equipmentId),
          row.refrigerantType,
          `${formatNumber(row.refrigerantAmountKg)} kg`,
          row.recoveredKg == null ? "-" : `${formatNumber(row.recoveredKg)} kg`,
          row.servicePartnerName || "-",
          row.certificateFileName || "-",
          row.notes || "-",
        ])}
      />
    </ReportSection>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field">
      <span>{label}:</span>
      <strong>{value || "-"}</strong>
    </div>
  )
}

function displayEquipment(name: string, equipmentId: string | null) {
  return equipmentId ? `${equipmentId} - ${name}` : name
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value === 0 ? 1 : 0,
  }).format(value)
}

function formatCo2eSummary(report: AnnualFgasReportData) {
  if (report.summary.totalCo2eKg !== null) {
    return `${formatInteger(report.summary.totalCo2eKg / 1000)} ton`
  }

  return `Kan inte beräknas fullständigt (känd delsumma ${formatInteger(
    report.summary.knownCo2eKg / 1000
  )} ton)`
}

function formatCo2eTon(valueKg: number | null) {
  if (valueKg === null) return "Okänt GWP-värde"

  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(valueKg / 1000)
}

function formatOptionalNumber(value: number | null | undefined) {
  if (!value) return "-"
  return formatNumber(value)
}

function formatHandlingRefrigerant(row: AnnualFgasRefrigerantHandlingRow) {
  if (row.previousRefrigerantType && row.newRefrigerantType) {
    return `${row.previousRefrigerantType} → ${row.newRefrigerantType}`
  }

  return row.newRefrigerantType ?? row.refrigerantType
}

function getReportLogoDataUri() {
  const logoPath = join(process.cwd(), "public", "logo-mark.png")

  if (!existsSync(logoPath)) return null

  return `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
}

function qualityStatusLabel(status: AnnualFgasReportData["qualitySummary"]["status"]) {
  return {
    READY: "Rapportstatus: Redo",
    HAS_WARNINGS: "Rapportstatus: Bör granskas",
    MISSING_REQUIRED_DATA: "Rapportstatus: Kräver komplettering",
  }[status]
}

const annualReportPrintStyles = `
  @page {
    size: A4 portrait;
    margin: 15mm 13mm 18mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    background: #ffffff;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    line-height: 1.35;
  }

  .report-page {
    width: 100%;
  }

  .report-header {
    align-items: flex-end;
    border-bottom: 1px solid #b8c0cc;
    display: flex;
    justify-content: space-between;
    margin-bottom: 14px;
    padding-top: 16px;
    padding-bottom: 8px;
  }

  .report-header h1 {
    font-size: 18px;
    line-height: 1.1;
    margin: 0 0 6px;
    text-transform: uppercase;
  }

  .report-header p {
    margin: 0;
  }

  .header-meta {
    color: #374151;
    min-width: 105px;
    text-align: right;
    white-space: nowrap;
  }

  .report-logo {
    display: block;
    height: 18px;
    margin: 0 0 6px auto;
    opacity: 0.82;
    width: auto;
  }

  .report-section {
    break-inside: avoid;
    margin-top: 12px;
  }

  .report-section h2 {
    border-left: 3px solid #2563eb;
    font-size: 12px;
    line-height: 1.2;
    margin: 0 0 8px;
    padding: 4px 0 4px 8px;
    text-transform: uppercase;
  }

  .strong {
    font-weight: 700;
    margin: 0;
  }

  .field-grid {
    display: grid;
    gap: 5px 18px;
  }

  .field-grid-2 {
    grid-template-columns: 1fr 1fr;
  }

  .field-grid-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .field {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .field span {
    color: #4b5563;
    flex: 0 0 auto;
  }

  .field strong {
    font-weight: 700;
  }

  .summary-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
    margin-top: 12px;
  }

  .summary-box {
    border: 1px solid #b8c0cc;
    break-inside: avoid;
    min-height: 116px;
    padding: 10px;
  }

  .summary-box h3 {
    border-bottom: 1px solid #d1d5db;
    font-size: 11px;
    margin: 0 0 8px;
    padding-bottom: 6px;
  }

  .summary-box dl,
  .summary-box div {
    margin: 0;
  }

  .summary-box div {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr auto;
    margin-top: 2px;
  }

  .summary-box dt {
    color: #4b5563;
  }

  .summary-box dd {
    font-weight: 700;
    margin: 0;
    text-align: right;
  }

  .data-table {
    border-collapse: collapse;
    font-size: 7.8px;
    page-break-inside: auto;
    width: 100%;
  }

  .data-table thead {
    display: table-header-group;
  }

  .data-table tfoot {
    display: table-footer-group;
  }

  .data-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .data-table th {
    background: #f3f4f6;
    border: 1px solid #b8c0cc;
    font-weight: 700;
    padding: 4px 5px;
    text-align: left;
    vertical-align: top;
  }

  .data-table td {
    border: 1px solid #c9d0da;
    padding: 4px 5px;
    vertical-align: top;
  }

  .empty-cell {
    color: #4b5563;
    font-style: italic;
    text-align: center;
  }

  .notes-list {
    border: 1px solid #c9d0da;
    margin: 0;
    padding: 8px 8px 8px 18px;
  }

  .note-box {
    border: 1px solid #c9d0da;
    margin: 0;
    min-height: 34px;
    padding: 7px 9px;
    white-space: pre-wrap;
  }

  .muted {
    color: #4b5563;
    margin: 0;
  }

  .warning-box {
    border: 1px solid #d97706;
    color: #78350f;
    margin: 10px 0 0;
    padding: 7px 9px;
  }

  .warning-list {
    border: 1px solid #d97706;
    color: #78350f;
    margin: 6px 0 0;
    padding: 7px 9px 7px 18px;
  }

  .warning-required {
    color: #7f1d1d;
  }

  .quality-box {
    border: 1px solid #c9d0da;
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 170px;
    padding: 8px 10px;
  }

  .quality-box dl {
    display: grid;
    gap: 4px;
    margin: 0;
  }

  .quality-box div {
    margin: 0;
  }

  .quality-box dt,
  .quality-box dd {
    display: inline;
    margin: 0;
  }

  .quality-box dd {
    float: right;
    font-weight: 700;
  }

  .quality-label {
    font-size: 11px;
    font-weight: 700;
    margin: 0 0 3px;
  }

  .quality-ready {
    border-color: #86efac;
  }

  .quality-has_warnings {
    border-color: #d97706;
  }

  .quality-missing_required_data {
    border-color: #b91c1c;
  }

  .quality-list {
    color: #4b5563;
    margin: 6px 0 0;
    padding: 0 0 0 16px;
  }

  .lined-box {
    border: 1px solid #c9d0da;
    height: 42px;
  }

  .signature-section {
    border: 1px solid #c9d0da;
    break-inside: avoid;
    display: grid;
    gap: 22px;
    grid-template-columns: 1fr 1fr;
    margin-top: 14px;
    padding: 10px;
  }

  .signature-section p {
    color: #374151;
    margin: 0 0 22px;
  }

  .signature-line {
    border-bottom: 1px solid #6b7280;
    height: 18px;
    margin-bottom: 6px;
  }

  .signing-box {
    border: 1px solid #94a3b8;
    break-inside: avoid;
    padding: 10px;
  }

  .signing-fields {
    margin-top: 8px;
  }

  .signing-comment {
    border-top: 1px solid #d1d5db;
    margin-top: 8px;
    padding-top: 7px;
  }

  .signing-comment span {
    color: #4b5563;
    font-weight: 700;
  }

  .signing-comment p {
    margin: 3px 0 0;
  }

  @media screen {
    body {
      background: #e5e7eb;
    }

    .report-page {
      background: #ffffff;
      margin: 24px auto;
      min-height: 297mm;
      padding: 15mm 13mm 18mm;
      width: 210mm;
    }
  }
`
