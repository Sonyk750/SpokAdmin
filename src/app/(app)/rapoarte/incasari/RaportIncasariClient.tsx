"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Pozitie { tip: string; denumire: string; suma: number; fondId?: string; }
interface AvansItem { tip?: string; denumire?: string; suma: number; }

interface IncasareRow {
  id:             string;
  nrApartament:   string;
  proprietarNume: string | null;
  serie:          string;
  numarDocument:  number;
  tipDocument:    string;
  tipPlata:       string;
  data:           string;
  sumaIncasata:   number;
  observatii:     string | null;
  pozitii:        Pozitie[];
  avans:          AvansItem[] | { suma: number } | null;
}

const fmt2 = (v: number) => v.toFixed(2);

function ceReprezinta(row: IncasareRow): string {
  const parts: string[] = [];
  for (const p of row.pozitii) {
    parts.push(`${p.denumire} ${fmt2(p.suma)} lei`);
  }
  if (Array.isArray(row.avans)) {
    for (const a of row.avans) {
      parts.push(`${a.denumire ?? "Avans"} ${fmt2(a.suma)} lei`);
    }
  } else if (row.avans && typeof row.avans === "object" && (row.avans as any).suma > 0) {
    parts.push(`Avans ${fmt2((row.avans as any).suma)} lei`);
  }
  return parts.join("; ") || "—";
}

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RaportIncasariClient({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd:   string;
}) {
  const { activeId: asociatieId } = useAsociatie();
  const [asocName, setAsocName] = useState<string>("");

  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd,   setDataEnd]   = useState(defaultEnd);

  const [rows,    setRows]    = useState<IncasareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch association name
  useEffect(() => {
    if (!asociatieId) { setAsocName(""); return; }
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then(d => setAsocName(d.name ?? ""))
      .catch(() => {});
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setRows([]); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, dataStart, dataEnd });
    try {
      const res  = await fetch(`/api/incasari?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRows(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalIncasat = rows.reduce((s, r) => s + r.sumaIncasata, 0);

  function handlePrint() {
    window.print();
  }

  if (!asociatieId) {
    return (
      <div className="page-shell">
        <div className="wizard__error">Selectează o asociație din antetul paginii.</div>
      </div>
    );
  }

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #raport-incasari, #raport-incasari * { visibility: visible; }
          #raport-incasari { position: fixed; inset: 0; padding: 20mm 15mm; background: white; color: black; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th, td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
          th { background: #eee; font-weight: bold; }
          .print-header { margin-bottom: 12mm; }
          .print-header h1 { font-size: 14pt; font-weight: bold; margin: 0 0 2mm; }
          .print-header p  { font-size: 10pt; margin: 0; color: #444; }
          .print-total { margin-top: 6mm; font-size: 10pt; text-align: right; font-weight: bold; }
          .col-nr   { width: 6%; }
          .col-data { width: 12%; white-space: nowrap; }
          .col-doc  { width: 14%; white-space: nowrap; }
          .col-repr { width: 48%; }
          .col-val  { width: 12%; text-align: right; white-space: nowrap; }
          .col-ap   { width: 8%; }
        }
      `}</style>

      <div className="page-shell no-print">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Raport încasări</h1>
            <p className="page-sub">Chitanțe emise în perioada selectată</p>
          </div>
          <button className="btn btn--primary" onClick={handlePrint} disabled={rows.length === 0}>
            ⬇ Descarcă PDF
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="lp-controls no-print" style={{ marginBottom: "1.5rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">De la</label>
            <input type="date" className="input" value={dataStart}
              onChange={e => setDataStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Până la</label>
            <input type="date" className="input" value={dataEnd}
              onChange={e => setDataEnd(e.target.value)} />
          </div>
          <button className="btn btn--secondary no-print" onClick={fetchData}
            disabled={loading} style={{ alignSelf: "flex-end" }}>
            {loading ? "Se încarcă..." : "Actualizează"}
          </button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {/* ── Printable area ── */}
      <div id="raport-incasari" ref={printRef}
        style={{ background: "transparent" }}>

        {/* Print header (only visible in print) */}
        <div className="print-header" style={{ display: "none" }}>
          <h1>Raport încasări</h1>
          <p>{asocName}</p>
          <p>Perioada: {roDate(dataStart)} — {roDate(dataEnd)}</p>
        </div>

        {/* Summary bar (screen only) */}
        {rows.length > 0 && (
          <div className="no-print dash-panel" style={{
            padding: "1rem 1.5rem", display: "flex", gap: "2rem",
            flexWrap: "wrap", marginBottom: "1rem", marginLeft: "1.5rem", marginRight: "1.5rem",
          }}>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Chitanțe</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total încasat</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div>
            </div>
          </div>
        )}

        {rows.length === 0 && !loading ? (
          <div className="no-print empty-state" style={{ margin: "0 1.5rem" }}>
            <span className="empty-state__icon">🧾</span>
            <div className="empty-state__title">Nicio încasare în perioada selectată</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <table className="data-table" style={{ fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th className="col-nr"  style={{ width: "50px" }}>Nr. crt.</th>
                  <th className="col-data">Data</th>
                  <th className="col-doc">Chitanță</th>
                  <th className="col-ap" style={{ width: "60px" }}>Ap.</th>
                  <th className="col-repr">Ce reprezintă</th>
                  <th className="col-val" style={{ textAlign: "right" }}>Valoare (lei)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="col-nr" style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                    <td className="col-data" style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>
                      {roDate(row.data)}
                    </td>
                    <td className="col-doc" style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>
                      {row.serie} {row.numarDocument}
                    </td>
                    <td className="col-ap" style={{ fontWeight: 700, color: "#a78bfa", textAlign: "center" }}>
                      {row.nrApartament}
                    </td>
                    <td className="col-repr" style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                      {ceReprezinta(row)}
                      {row.proprietarNume && (
                        <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", marginTop: "1px" }}>
                          {row.proprietarNume}
                        </span>
                      )}
                    </td>
                    <td className="col-val" style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>
                      {fmt2(row.sumaIncasata)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)" }}>
                  <td colSpan={5} style={{ padding: "0.75rem", fontWeight: 700, color: "#94a3b8", fontSize: "0.8125rem" }}>
                    Total perioada {roDate(dataStart)} — {roDate(dataEnd)}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.75rem", fontWeight: 800, color: "#4ade80", fontSize: "1rem", whiteSpace: "nowrap" }}>
                    {fmt2(totalIncasat)} lei
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Print total */}
        <div className="print-total" style={{ display: "none" }}>
          Total: {fmt2(totalIncasat)} lei ({rows.length} chitanțe)
        </div>
      </div>
    </>
  );
}
