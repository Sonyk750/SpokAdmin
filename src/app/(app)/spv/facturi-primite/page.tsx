"use client"

import { useState, useEffect, useCallback } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"

type SpvStatus = { connected: boolean; expired?: boolean }

type SpvInvoice = {
  id:            string
  downloadId:    string | null
  uploadId:      string | null
  supplier:      string | null
  supplierCui:   string | null
  invoiceNumber: string | null
  issueDate:     string | null
  total:         number | null
  currency:      string
  status:        string
}

function defaultDates() {
  const to   = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 2)
  return {
    from: from.toISOString().split("T")[0],
    to:   to.toISOString().split("T")[0],
  }
}

const STATUS_LABEL: Record<string, string> = {
  NEW:       "Nou",
  READ:      "Citit",
  PROCESSED: "Procesat",
}

const STATUS_PILL: Record<string, string> = {
  NEW:       "pill pill--violet",
  READ:      "pill pill--gray",
  PROCESSED: "pill pill--green",
}

export default function FacturiPrimitePage() {
  const { activeId: asociatieId, activeName } = useAsociatie()

  const [spvStatus, setSpvStatus] = useState<SpvStatus | null>(null)
  const [invoices,  setInvoices]  = useState<SpvInvoice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)
  const [message,   setMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [dateFrom,  setDateFrom]  = useState(defaultDates().from)
  const [dateTo,    setDateTo]    = useState(defaultDates().to)

  const fetchInvoices = useCallback(async (asocId: string, from: string, to: string, sync = false) => {
    if (!asocId) return
    if (sync) setSyncing(true)
    else setLoading(true)
    try {
      const p = new URLSearchParams({ asociatieId: asocId, from, to })
      if (sync) p.set("sync", "true")
      const res  = await fetch(`/api/spv/inbox?${p}`)
      const data = await res.json()
      if (data.invoices) {
        setInvoices(data.invoices)
        if (sync) setMessage({ type: "success", text: `Sincronizat: ${data.invoices.length} facturi primite` })
      } else if (data.error) {
        setMessage({ type: "error", text: `Eroare: ${data.error}` })
      }
    } catch {
      setMessage({ type: "error", text: "Eroare la preluare facturi" })
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetch("/api/spv/status")
      .then(r => r.json())
      .then(setSpvStatus)
      .catch(() => setSpvStatus({ connected: false }))
  }, [])

  useEffect(() => {
    if (asociatieId) {
      fetchInvoices(asociatieId, dateFrom, dateTo)
    }
  }, [asociatieId, fetchInvoices, dateFrom, dateTo])

  function handleSync() {
    fetchInvoices(asociatieId, dateFrom, dateTo, true)
  }

  function handleDateChange(newFrom: string, newTo: string) {
    fetchInvoices(asociatieId, newFrom, newTo)
  }

  const isEmpty = !loading && invoices.length === 0

  return (
    <div className="page-shell">

      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Facturi primite</h1>
          <p className="page-sub">
            Facturi primite prin ANAF e-Factură
            {activeName ? ` — ${activeName}` : ""}
          </p>
        </div>
        <div className="spv-toolbar">
          <input
            type="date"
            value={dateFrom}
            onChange={e => {
              setDateFrom(e.target.value)
              handleDateChange(e.target.value, dateTo)
            }}
            className="spv-date-input"
          />
          <span className="spv-date-sep">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => {
              setDateTo(e.target.value)
              handleDateChange(dateFrom, e.target.value)
            }}
            className="spv-date-input"
          />
          {spvStatus?.connected && (
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="btn btn--secondary btn--sm"
            >
              {syncing ? "Se sincronizează..." : "🔄 Sincronizează"}
            </button>
          )}
          {!spvStatus?.connected && (
            <a href="/spv/conectare" className="btn btn--secondary btn--sm">
              🔐 Conectează SPV
            </a>
          )}
        </div>
      </div>

      {message && (
        <div className={`spv-alert spv-alert--${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="spv-alert__close">✕</button>
        </div>
      )}

      {loading ? (
        <div className="spv-loading">Se încarcă facturile...</div>
      ) : isEmpty ? (
        <div className="empty-state">
          <span className="empty-state__icon">{spvStatus?.connected ? "📭" : "🏛️"}</span>
          <p className="empty-state__title">
            {spvStatus?.connected ? "Nu există facturi în perioada selectată" : "SPV neconectat"}
          </p>
          <p className="empty-state__desc">
            {spvStatus?.connected
              ? "Apasă \"Sincronizează\" pentru a prelua facturile noi de la ANAF."
              : "Conectează-te cu certificatul digital pentru a sincroniza facturile primite."}
          </p>
          {spvStatus?.connected
            ? <button onClick={handleSync} disabled={syncing} className="btn btn--primary">🔄 Sincronizează ANAF</button>
            : <a href="/spv/conectare" className="btn btn--primary">🔐 Conectează SPV</a>
          }
        </div>
      ) : (
        <>
          <div className="spv-count">{invoices.length} factur{invoices.length === 1 ? "ă" : "i"}</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nr. Factură</th>
                  <th>Furnizor</th>
                  <th>ID Încărcare</th>
                  <th>Data</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoiceNumber || "—"}</strong>
                      {inv.downloadId && (
                        <div style={{ fontSize: "0.7rem", color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>
                          {inv.downloadId}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{inv.supplier || "—"}</div>
                      {inv.supplierCui && (
                        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>CIF: {inv.supplierCui}</div>
                      )}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af" }}>
                      {inv.uploadId || "—"}
                    </td>
                    <td>
                      {inv.issueDate
                        ? new Date(inv.issueDate).toLocaleDateString("ro-RO")
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {inv.total != null
                        ? <strong>{inv.total.toFixed(2)} <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{inv.currency}</span></strong>
                        : "—"}
                    </td>
                    <td>
                      <span className={STATUS_PILL[inv.status] || "pill pill--gray"}>
                        {STATUS_LABEL[inv.status] || inv.status}
                      </span>
                    </td>
                    <td>
                      <a
                        href={`/api/spv/download?id=${inv.downloadId || inv.id}`}
                        download
                        className="btn-action"
                      >
                        ⬇ ZIP
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
