"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { roDate } from "@/lib/date"

type Line  = { id: string; name: string; description: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; vatPct: number }
type Party = { name: string; vat: string; regCom: string; address: string; city: string; county: string; email: string; phone: string }
type Bank  = { iban: string; name: string; bic: string }
type InvoiceData = {
  invoiceNo: string; issueDate: string; dueDate: string; currency: string; note: string
  supplier: Party; buyer: Party; lines: Line[]; banks: Bank[]
  totals: { lineExtension: number; taxExclusive: number; taxInclusive: number; allowance: number; payable: number; taxAmount: number }
}

export default function FacturaSPVPage() {
  const { id } = useParams<{ id: string }>()
  const [data,  setData]  = useState<InvoiceData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/spv/parse?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError("Eroare la încărcare"))
  }, [id])

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 600)
  }, [data])

  const fmt     = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const fmtDate = (s: string) => roDate(s)

  if (error) return <div style={{ padding: "2rem", color: "#f87171", fontFamily: "Arial" }}>{error}</div>
  if (!data)  return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "Arial" }}>Se încarcă factura...</div>

  const { invoiceNo, issueDate, dueDate, currency, note, supplier, buyer, lines, banks, totals } = data

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 15mm; size: A4; }
        }
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; }
        .page { background: white; max-width: 210mm; margin: 0 auto; padding: 20mm; box-shadow: 0 0 20px rgba(0,0,0,.1); }
      `}</style>

      <div className="no-print" style={{ padding: "1rem 2rem", background: "#1e1b4b", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "0.5rem 1.25rem", background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
        >
          Printează / Salvează PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: "0.5rem 1.25rem", background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}
        >
          Închide
        </button>
      </div>

      <div className="page">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, borderBottom: "2px solid #7c3aed", paddingBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1f2937" }}>FACTURĂ</div>
            <div style={{ fontSize: 18, color: "#7c3aed", fontWeight: 600, marginTop: 4 }}>{invoiceNo}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#6b7280" }}>
            <div><b style={{ color: "#1f2937" }}>Data emiterii:</b> {fmtDate(issueDate)}</div>
            {dueDate && <div style={{ marginTop: 4 }}><b style={{ color: "#1f2937" }}>Scadență:</b> {fmtDate(dueDate)}</div>}
            <div style={{ marginTop: 4 }}><b style={{ color: "#1f2937" }}>Monedă:</b> {currency}</div>
          </div>
        </div>

        {/* Supplier + Buyer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Furnizor</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{supplier.name}</div>
            {supplier.vat    && <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>CIF: {supplier.vat}</div>}
            {supplier.regCom && <div style={{ fontSize: 12, color: "#374151" }}>Reg. Com.: {supplier.regCom}</div>}
            {supplier.address && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{supplier.address}</div>}
            {(supplier.city || supplier.county) && <div style={{ fontSize: 12, color: "#6b7280" }}>{[supplier.city, supplier.county].filter(Boolean).join(", ")}</div>}
            {supplier.phone && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Tel: {supplier.phone}</div>}
            {supplier.email && <div style={{ fontSize: 12, color: "#6b7280" }}>Email: {supplier.email}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Beneficiar</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{buyer.name}</div>
            {buyer.vat    && <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>CIF: {buyer.vat}</div>}
            {buyer.regCom && <div style={{ fontSize: 12, color: "#374151" }}>Reg. Com.: {buyer.regCom}</div>}
            {buyer.address && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{buyer.address}</div>}
            {(buyer.city || buyer.county) && <div style={{ fontSize: 12, color: "#6b7280" }}>{[buyer.city, buyer.county].filter(Boolean).join(", ")}</div>}
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#7c3aed", color: "white" }}>
              <th style={{ padding: "8px 10px", textAlign: "left",   fontWeight: 600 }}>Nr.</th>
              <th style={{ padding: "8px 10px", textAlign: "left",   fontWeight: 600 }}>Denumire</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>U.M.</th>
              <th style={{ padding: "8px 10px", textAlign: "right",  fontWeight: 600 }}>Cant.</th>
              <th style={{ padding: "8px 10px", textAlign: "right",  fontWeight: 600 }}>Preț unit.</th>
              <th style={{ padding: "8px 10px", textAlign: "right",  fontWeight: 600 }}>TVA %</th>
              <th style={{ padding: "8px 10px", textAlign: "right",  fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#f5f3ff" : "white", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "7px 10px", color: "#6b7280" }}>{l.id}</td>
                <td style={{ padding: "7px 10px" }}>
                  <div style={{ fontWeight: 600, color: "#1f2937" }}>{l.name}</div>
                  {l.description && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{l.description}</div>}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{l.unit}</td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>{fmt(l.unitPrice)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#6b7280" }}>{l.vatPct}%</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Banks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "start" }}>
          {banks.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Date bancare</div>
              {banks.map((b, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "#1f2937", fontWeight: 600 }}>{b.iban}</div>
                  {b.name && <div style={{ fontSize: 11, color: "#6b7280" }}>{b.name}{b.bic ? ` (${b.bic})` : ""}</div>}
                </div>
              ))}
            </div>
          )}
          <div style={{ minWidth: 260 }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {totals.allowance > 0 && (
                  <tr>
                    <td style={{ padding: "4px 0", color: "#6b7280" }}>Discount:</td>
                    <td style={{ padding: "4px 0", textAlign: "right", color: "#6b7280" }}>-{fmt(totals.allowance)} {currency}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "4px 0", color: "#6b7280" }}>Bază impozabilă:</td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>{fmt(totals.taxExclusive)} {currency}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#6b7280" }}>TVA:</td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>{fmt(totals.taxAmount)} {currency}</td>
                </tr>
                <tr style={{ borderTop: "2px solid #7c3aed" }}>
                  <td style={{ padding: "8px 0 4px", fontWeight: 700, fontSize: 15 }}>TOTAL:</td>
                  <td style={{ padding: "8px 0 4px", textAlign: "right", fontWeight: 700, fontSize: 15, color: "#7c3aed" }}>{fmt(totals.payable)} {currency}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {note && (
          <div style={{ marginTop: 24, padding: "12px 16px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Observații</div>
            <div style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-line" }}>{note}</div>
          </div>
        )}
      </div>
    </>
  )
}
