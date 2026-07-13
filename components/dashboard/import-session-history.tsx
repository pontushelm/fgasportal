"use client"

import { useMemo, useState } from "react"
import { API_CACHE_KEYS, invalidateImportSessionCaches, useApiQuery } from "@/lib/client/api-cache"
import { buttonClassName, Card, Toast, type ToastMessage } from "@/components/ui"

type ImportRollback = {
  canRollback: boolean
  blockers: string[]
  affectedCount: number
  importedCount: number
}

type ImportSessionItem = {
  id: string
  importTypeLabel: string
  statusLabel: string
  sourceFileName: string | null
  rowsProcessed: number
  rowsImported: number
  rowsSkipped: number
  rowsFailed: number
  createdAt: string
  completedAt: string | null
  rolledBackAt: string | null
  createdBy: {
    name: string
    email: string
  }
  rolledBackBy?: {
    name: string
    email: string
  } | null
  rollback: ImportRollback
}

type ImportSessionsResponse = {
  sessions: ImportSessionItem[]
}

type ImportSessionResponse = {
  session: ImportSessionItem
}

type ImportSessionHistoryProps = {
  initialSessionId?: string | null
}

export function ImportSessionHistory({
  initialSessionId,
}: ImportSessionHistoryProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId ?? null
  )
  const [rollbackCandidate, setRollbackCandidate] =
    useState<ImportSessionItem | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const {
    data,
    error,
    isLoading,
  } = useApiQuery<ImportSessionsResponse>(API_CACHE_KEYS.importSessions)
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions])
  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions[0] ??
      null,
    [selectedSessionId, sessions]
  )
  const selectedSessionKey = selectedSession
    ? API_CACHE_KEYS.importSession(selectedSession.id)
    : null
  const {
    data: detailData,
    isLoading: isDetailLoading,
  } = useApiQuery<ImportSessionResponse>(selectedSessionKey)
  const detail = detailData?.session ?? selectedSession

  async function handleRollback() {
    if (!rollbackCandidate || isRollingBack) return

    setIsRollingBack(true)
    const response = await fetch(
      `/api/import-sessions/${rollbackCandidate.id}/rollback`,
      {
        credentials: "include",
        method: "POST",
      }
    )
    const result = await response.json().catch(() => ({}))
    setIsRollingBack(false)

    if (!response.ok) {
      setToast({
        type: "error",
        title: "Importen kunde inte ångras",
        message:
          result.rollback?.blockers?.join(" ") ||
          result.error ||
          "Försök igen om en stund.",
      })
      return
    }

    await invalidateImportSessionCaches(rollbackCandidate.id)
    setRollbackCandidate(null)
    setToast({
      type: result.alreadyRolledBack ? "warning" : "success",
      title: result.alreadyRolledBack ? "Redan ångrad" : "Import ångrad",
      message: result.alreadyRolledBack
        ? "Importen var redan markerad som ångrad."
        : "Importhistoriken sparades och de importerade posterna togs bort.",
    })
  }

  return (
    <Card className="mt-6 border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Importhistorik
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Senaste importer
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Importer sparas som sessionshistorik. En import kan bara ångras om
            de importerade posterna inte har börjat användas eller ändrats.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Hämtar importhistorik...
        </p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Kunde inte hämta importhistorik.
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Ingen importhistorik finns ännu. Endast importer som görs från och med
          den här versionen visas här.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Datum
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Typ
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Importerat
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Åtgärd
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {sessions.map((session) => (
                  <tr
                    className={
                      detail?.id === session.id ? "bg-blue-50/60" : undefined
                    }
                    key={session.id}
                  >
                    <td className="px-3 py-3 text-slate-700">
                      {formatDateTime(session.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-950">
                        {session.importTypeLabel}
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.sourceFileName || "Ingen fil sparad"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {session.rowsImported}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill label={session.statusLabel} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        Visa detaljer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail && (
            <ImportSessionDetail
              isLoading={isDetailLoading}
              session={detail}
              onRollback={() => setRollbackCandidate(detail)}
            />
          )}
        </div>
      )}

      {rollbackCandidate && (
        <div
          aria-labelledby="rollback-import-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-2xl">
            <h3
              className="text-lg font-semibold text-slate-950"
              id="rollback-import-title"
            >
              Ångra import av {rollbackCandidate.importTypeLabel.toLowerCase()}?
            </h3>
            <p className="mt-2">
              {rollbackCandidate.rollback.affectedCount} importerade poster tas
              bort. Importhistoriken sparas och markeras som ångrad.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className={buttonClassName({ variant: "secondary" })}
                disabled={isRollingBack}
                type="button"
                onClick={() => setRollbackCandidate(null)}
              >
                Avbryt
              </button>
              <button
                className={buttonClassName({ variant: "danger" })}
                disabled={isRollingBack}
                type="button"
                onClick={handleRollback}
              >
                {isRollingBack ? "Ångrar..." : "Ångra import"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
    </Card>
  )
}

function ImportSessionDetail({
  isLoading,
  onRollback,
  session,
}: {
  isLoading: boolean
  onRollback: () => void
  session: ImportSessionItem
}) {
  const canRollback = session.rollback.canRollback

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Detaljer
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {session.importTypeLabel}
          </h3>
          {isLoading && (
            <p className="mt-1 text-xs text-slate-500">Uppdaterar status...</p>
          )}
        </div>
        <StatusPill label={session.statusLabel} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailItem label="Startad" value={formatDateTime(session.createdAt)} />
        <DetailItem
          label="Slutförd"
          value={session.completedAt ? formatDateTime(session.completedAt) : "-"}
        />
        <DetailItem label="Importerad av" value={session.createdBy.name} />
        <DetailItem label="Fil" value={session.sourceFileName || "-"} />
        <DetailItem label="Rader" value={String(session.rowsProcessed)} />
        <DetailItem label="Importerade" value={String(session.rowsImported)} />
        <DetailItem label="Hoppade över" value={String(session.rowsSkipped)} />
        <DetailItem label="Fel" value={String(session.rowsFailed)} />
      </dl>

      {session.rolledBackAt && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          Importen ångrades {formatDateTime(session.rolledBackAt)}
          {session.rolledBackBy ? ` av ${session.rolledBackBy.name}.` : "."}
        </p>
      )}

      {canRollback ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Importen kan ångras.</p>
          <p className="mt-1">
            {session.rollback.affectedCount} importerade poster tas bort om du
            ångrar importen.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Importen kan inte ångras just nu.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {session.rollback.blockers.length > 0 ? (
              session.rollback.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))
            ) : (
              <li>Rollback är inte tillgänglig för den här importen.</li>
            )}
          </ul>
        </div>
      )}

      <button
        className={`mt-4 ${buttonClassName({
          variant: canRollback ? "danger" : "secondary",
        })}`}
        disabled={!canRollback}
        type="button"
        onClick={onRollback}
      >
        Ångra import
      </button>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === "Klar"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : label === "Ångrad"
        ? "border-slate-200 bg-slate-100 text-slate-700"
        : label === "Misslyckad"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-800"

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
