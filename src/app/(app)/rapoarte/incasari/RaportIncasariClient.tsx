"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Pozitie   { tip: string; denumire: string; suma: number; fondId?: string; }
interface AvansItem { tip?: string; denumire?: string; suma: number; }

interface IncasareRow {
  id:             string;
  nrApartament:   string;
  proprietarNume: string | null;
  serie:          string;
  numarDocument:  number;
  tipDocument:    string;
  data:           string;
  sumaIncasata:   number;
  observatii:     string | null;
  pozitii:        Pozitie[];
  avans:          AvansItem[] | { suma: number } | null;
}

interface AsocInfo {
  name:           string;
  address:        string | null;
  city:           string | null;
  sector:         string | null;
  adminName:      string | null;
  presedinteName: string | null;
  cenzorName:     string | null;
}

const fmt2 = (v: number) => v.toFixed(2);

function ceReprezinta(row: IncasareRow): string {
  const parts: string[] = [];
  for (const p of row.pozitii) parts.push(`${p.denumire} ${fmt2(p.suma)} lei`);
  if (Array.isArray(row.avans)) {
    for (const a of row.avans) parts.push(`${a.denumire ?? "Avans"} ${fmt2(a.suma)} lei`);
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

  const [asoc,     setAsoc]    = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd,   setDataEnd]   = useState(defaultEnd);
  const [rows,    setRows]    = useState<IncasareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then(d => setAsoc(d))
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

  if (!asociatieId) {
    return (
      <div className="page-shell">
        <div className="wizard__error">Selectează o asociație din antetul paginii.</div>
      </div>
    );
  }

  return (
    <>
      {/* ════════════════════════ PRINT CSS ════════════════════════ */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 20mm 12mm;
          }

          /* hide everything except the printable zone */
          body > * { display: none !important; }
          #print-root { display: block !important; }

          #print-root {
            position: static;
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            color: #000;
            background: #fff;
          }

          /* ── antet ── */
          .pr-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 6pt;
            margin-bottom: 10pt;
          }
          .pr-header-left  { flex: 1; }
          .pr-header-right { text-align: right; flex-shrink: 0; }
          .pr-asoc-name { font-size: 12pt; font-weight: bold; }
          .pr-asoc-addr { font-size: 9pt; color: #333; margin-top: 2pt; }
          .pr-period-label { font-size: 9pt; color: #555; }
          .pr-period-value { font-size: 10pt; font-weight: bold; }

          /* ── titlu ── */
          .pr-title {
            text-align: center;
            font-size: 15pt;
            font-weight: bold;
            letter-spacing: 1pt;
            text-transform: uppercase;
            margin: 10pt 0 12pt;
          }

          /* ── tabel ── */
          .pr-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }
          .pr-table th {
            background: #e8e8e8;
            border: 1px solid #555;
            padding: 4pt 5pt;
            text-align: center;
            font-weight: bold;
          }
          .pr-table td {
            border: 1px solid #888;
            padding: 3pt 5pt;
            vertical-align: top;
          }
          .pr-table tbody tr:nth-child(even) td { background: #f7f7f7; }
          .pr-table tfoot td {
            border-top: 2px solid #000;
            font-weight: bold;
            padding: 4pt 5pt;
          }
          .td-center { text-align: center; }
          .td-right  { text-align: right; }
          .td-nr     { width: 28pt; }
          .td-data   { width: 52pt; white-space: nowrap; }
          .td-doc    { width: 55pt; white-space: nowrap; }
          .td-ap     { width: 28pt; }
          .td-repr   { }
          .td-val    { width: 52pt; }

          /* ── footer semnături ── */
          .pr-footer {
            margin-top: 24pt;
            border-top: 1px solid #aaa;
            padding-top: 10pt;
            display: flex;
            justify-content: space-between;
          }
          .pr-sign {
            text-align: center;
            flex: 1;
          }
          .pr-sign-role {
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
          }
          .pr-sign-line {
            margin: 20pt auto 0;
            width: 80%;
            border-bottom: 1px solid #000;
          }
          .pr-sign-name {
            font-size: 9pt;
            margin-top: 4pt;
            color: #333;
          }

          .no-print { display: none !important; }
        }

        @media screen {
          #print-root { display: none; }
        }
      `}</style>

      {/* ════════════════════════ SCREEN UI ════════════════════════ */}
      <div className="no-print">
        <div className="page-shell">
          <div className="page-header">
            <div>
              <h1 className="page-title">Registru încasări</h1>
              <p className="page-sub">Chitanțe emise în perioada selectată</p>
            </div>
            <button className="btn btn--primary" onClick={() => window.print()}
              disabled={rows.length === 0}>
              ⬇ Descarcă PDF
            </button>
          </div>

          <div className="lp-controls" style={{ marginBottom: "1.5rem" }}>
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
            <button className="btn btn--secondary" onClick={fetchData}
              disabled={loading} style={{ alignSelf: "flex-end" }}>
              {loading ? "Se încarcă..." : "Actualizează"}
            </button>
          </div>

          {error && <div className="wizard__error">{error}</div>}
        </div>

        {rows.length > 0 && (
          <div className="dash-panel" style={{
            margin: "0 1.5rem 1rem",
            padding: "1rem 1.5rem",
            display: "flex", gap: "2rem", flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Chitanțe</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total încasat</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div>
            </div>
          </div>
        )}

        {rows.length === 0 && !loading ? (
          <div className="empty-state" style={{ margin: "0 1.5rem" }}>
            <span className="empty-state__icon">🧾</span>
            <div className="empty-state__title">Nicio încasare în perioada selectată</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <table className="data-table" style={{ fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>Nr.</th>
                  <th>Data</th>
                  <th>Chitanță</th>
                  <th style={{ width: 50, textAlign: "center" }}>Ap.</th>
                  <th>Ce reprezintă</th>
                  <th style={{ textAlign: "right" }}>Valoare (lei)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(row.data)}</td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>
                      {row.serie} {row.numarDocument}
                    </td>
                    <td style={{ fontWeight: 700, color: "#a78bfa", textAlign: "center" }}>{row.nrApartament}</td>
                    <td style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                      {ceReprezinta(row)}
                      {row.proprietarNume && (
                        <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", marginTop: 1 }}>
                          {row.proprietarNume}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>
                      {fmt2(row.sumaIncasata)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ fontWeight: 700, color: "#94a3b8" }}>
                    Total {roDate(dataStart)} — {roDate(dataEnd)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>
                    {fmt2(totalIncasat)} lei
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════ PRINT DOCUMENT ════════════════════════ */}
      <div id="print-root" aria-hidden="true">
        {/* Antet */}
        <div className="pr-header">
          <div className="pr-header-left">
            <div className="pr-asoc-name">{asoc?.name ?? ""}</div>
            {(asoc?.address || asoc?.city) && (
              <div className="pr-asoc-addr">
                {[asoc.address, asoc.sector ? `Sector ${asoc.sector}` : null, asoc.city]
                  .filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div className="pr-header-right">
            <div className="pr-period-label">Perioada</div>
            <div className="pr-period-value">{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>

        {/* Titlu */}
        <div className="pr-title">Registru încasări</div>

        {/* Tabel */}
        <table className="pr-table">
          <thead>
            <tr>
              <th className="td-nr">Nr.<br />crt.</th>
              <th className="td-data">Data</th>
              <th className="td-doc">Seria și nr.<br />chitanță</th>
              <th className="td-ap">Ap.</th>
              <th className="td-repr">Ce reprezintă</th>
              <th className="td-val td-right">Valoare<br />(lei)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}>
                <td className="td-nr td-center">{idx + 1}</td>
                <td className="td-data td-center">{roDate(row.data)}</td>
                <td className="td-doc td-center">{row.serie} {row.numarDocument}</td>
                <td className="td-ap td-center">{row.nrApartament}</td>
                <td className="td-repr">
                  {ceReprezinta(row)}
                  {row.proprietarNume && (
                    <span style={{ display: "block", fontSize: "8pt", color: "#444", marginTop: "1pt" }}>
                      {row.proprietarNume}
                    </span>
                  )}
                </td>
                <td className="td-val td-right">{fmt2(row.sumaIncasata)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: "right", paddingRight: "8pt" }}>
                TOTAL ({rows.length} chitanțe)
              </td>
              <td className="td-right">{fmt2(totalIncasat)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer semnături */}
        <div className="pr-footer">
          <div className="pr-sign">
            <div className="pr-sign-role">Administrator</div>
            <div className="pr-sign-line" />
            <div className="pr-sign-name">{asoc?.adminName ?? ""}</div>
          </div>
          <div className="pr-sign">
            <div className="pr-sign-role">Cenzor</div>
            <div className="pr-sign-line" />
            <div className="pr-sign-name">{asoc?.cenzorName ?? ""}</div>
          </div>
          <div className="pr-sign">
            <div className="pr-sign-role">Președinte</div>
            <div className="pr-sign-line" />
            <div className="pr-sign-name">{asoc?.presedinteName ?? ""}</div>
          </div>
        </div>
      </div>
    </>
  );
}
