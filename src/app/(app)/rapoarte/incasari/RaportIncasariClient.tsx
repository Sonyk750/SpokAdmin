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

async function generateAndDownloadPdf(
  asoc:      AsocInfo | null,
  rows:      IncasareRow[],
  dataStart: string,
  dataEnd:   string,
) {
  // pdfmake exports the instance directly (no .default); vfs_fonts exports the vfs object directly
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const totalIncasat = rows.reduce((s, r) => s + r.sumaIncasata, 0);
  const adresa = [
    asoc?.address,
    asoc?.sector ? `Sector ${asoc.sector}` : null,
    asoc?.city,
  ].filter(Boolean).join(", ");

  const tableBody: any[][] = [
    // Header row
    [
      { text: "Nr.\ncrt.", style: "th", alignment: "center" },
      { text: "Data",      style: "th", alignment: "center" },
      { text: "Seria și nr.\nchitanță", style: "th", alignment: "center" },
      { text: "Ap.", style: "th", alignment: "center" },
      { text: "Detalii încasare", style: "th" },
      { text: "Valoare\n(lei)", style: "th", alignment: "right" },
    ],
    // Data rows
    ...rows.map((row, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(row.data), alignment: "center", fontSize: 8 },
      { text: `${row.serie} ${row.numarDocument}`, alignment: "center", fontSize: 8 },
      { text: row.nrApartament + (row.proprietarNume ? `\n${row.proprietarNume}` : ""), alignment: "center", fontSize: 8 },
      { text: ceReprezinta(row), fontSize: 8 },
      { text: fmt2(row.sumaIncasata), alignment: "right", fontSize: 8 },
    ]),
    // Total row
    [
      { text: `TOTAL (${rows.length} chitanțe)`, colSpan: 5, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] },
      {}, {}, {}, {},
      { text: fmt2(totalIncasat), alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const docDefinition: any = {
    pageSize:    "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 40, 30, 70],

    content: [
      // ── Antet ──
      {
        columns: [
          {
            stack: [
              { text: asoc?.name ?? "", bold: true, fontSize: 13 },
              adresa ? { text: adresa, fontSize: 9, color: "#444", margin: [0, 2, 0, 0] } : {},
            ],
            width: "*",
          },
          {
            stack: [
              { text: "Perioada", fontSize: 9, color: "#666" },
              { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 },
            ],
            width: "auto",
            alignment: "right",
          },
        ],
      },
      // separator
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },

      // ── Titlu ──
      { text: "REGISTRU ÎNCASĂRI", style: "title", alignment: "center", margin: [0, 14, 0, 14] },

      // ── Tabel ──
      {
        table: {
          headerRows: 1,
          widths: [22, 48, 55, 22, "*", 48],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#DDDDDD" : rowIndex % 2 === 0 ? "#F5F5F5" : null,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#999",
          vLineColor: () => "#999",
          paddingTop:    () => 3,
          paddingBottom: () => 3,
          paddingLeft:   () => 4,
          paddingRight:  () => 4,
        },
      },
    ],

    // ── Footer semnături (pe fiecare pagina) ──
    footer: (_currentPage: number, _pageCount: number) => ({
      margin: [30, 10, 30, 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#aaa" }] },
        {
          margin: [0, 8, 0, 0],
          columns: [
            {
              stack: [
                { text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] },
                { text: asoc?.adminName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] },
              ],
              width: "*",
              alignment: "center",
            },
            {
              stack: [
                { text: "CENZOR", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] },
                { text: asoc?.cenzorName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] },
              ],
              width: "*",
              alignment: "center",
            },
            {
              stack: [
                { text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] },
                { text: asoc?.presedinteName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] },
              ],
              width: "*",
              alignment: "center",
            },
          ],
        },
      ],
    }),

    styles: {
      title: { fontSize: 15, bold: true, characterSpacing: 1 },
      th:    { bold: true, fontSize: 9 },
    },

    defaultStyle: {
      font: "Roboto",
    },
  };

  const fileName = `registru-incasari-${dataStart}-${dataEnd}.pdf`;
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(fileName);
}

export default function RaportIncasariClient({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd:   string;
}) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc,      setAsoc]      = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd,   setDataEnd]   = useState(defaultEnd);
  const [rows,      setRows]      = useState<IncasareRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

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

  async function handleDownloadPdf() {
    if (!rows.length) return;
    setPdfLoading(true);
    setError(null);
    try {
      await generateAndDownloadPdf(asoc, rows, dataStart, dataEnd);
    } catch (e: any) {
      setError(`Eroare PDF: ${e?.message ?? String(e)}`);
    } finally {
      setPdfLoading(false);
    }
  }

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
      {/* Print CSS — pentru butonul Printează */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm 25mm 12mm; }
          body * { visibility: hidden; }
          #print-zone, #print-zone * { visibility: visible; }
          #print-zone {
            position: fixed; inset: 0;
            background: #fff; color: #000;
            font-family: "Times New Roman", serif;
            font-size: 10pt;
            padding: 0;
          }
        }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      {/* ── Header UI ── */}
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru încasări</h1>
            <p className="page-sub">Chitanțe emise în perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint}
              disabled={rows.length === 0}>
              🖨 Printează
            </button>
            <button className="btn btn--primary" onClick={handleDownloadPdf}
              disabled={rows.length === 0 || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        {/* Filters */}
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

      {/* Summary */}
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

      {/* Table (screen) */}
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
                <th style={{ width: 60, textAlign: "center" }}>Ap.</th>
                <th>Detalii încasare</th>
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
                  <td style={{ fontWeight: 700, color: "#a78bfa", textAlign: "center" }}>
                    {row.nrApartament}
                    {row.proprietarNume && (
                      <span style={{ display: "block", fontWeight: 400, color: "#64748b", fontSize: "0.7rem", marginTop: 1 }}>
                        {row.proprietarNume}
                      </span>
                    )}
                  </td>
                  <td style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                    {ceReprezinta(row)}
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

      {/* ── Print zone (vizibil doar la print din browser) ── */}
      <div id="print-zone">
        {/* Antet */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "10pt" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div>
            {(asoc?.address || asoc?.city) && (
              <div style={{ fontSize: "9pt", color: "#444", marginTop: "2pt" }}>
                {[asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>
        {/* Titlu */}
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold",
          letterSpacing: "1pt", textTransform: "uppercase", margin: "10pt 0 12pt" }}>
          Registru încasări
        </div>
        {/* Tabel print */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["Nr.\ncrt.", "Data", "Seria și nr.\nchitanță", "Ap.", "Detalii încasare", "Valoare\n(lei)"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555",
                  padding: "4pt 5pt", textAlign: i === 5 ? "right" : i <= 3 ? "center" : "left",
                  fontWeight: "bold", fontSize: "9pt", whiteSpace: "pre-line" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>
                  {roDate(row.data)}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>
                  {row.serie} {row.numarDocument}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>
                  {row.nrApartament}
                  {row.proprietarNume && (
                    <span style={{ display: "block", fontSize: "8pt", color: "#444" }}>{row.proprietarNume}</span>
                  )}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>
                  {ceReprezinta(row)}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>
                  {fmt2(row.sumaIncasata)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>
                TOTAL ({rows.length} chitanțe)
              </td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>
                {fmt2(totalIncasat)}
              </td>
            </tr>
          </tfoot>
        </table>
        {/* Semnături */}
        <div style={{ marginTop: "24pt", borderTop: "1px solid #aaa", paddingTop: "10pt",
          display: "flex", justifyContent: "space-between" }}>
          {[
            { rol: "Administrator", nume: asoc?.adminName },
            { rol: "Cenzor",        nume: asoc?.cenzorName },
            { rol: "Președinte",    nume: asoc?.presedinteName },
          ].map(({ rol, nume }) => (
            <div key={rol} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase", letterSpacing: "0.5pt" }}>{rol}</div>
              <div style={{ margin: "16pt auto 0", width: "75%", borderBottom: "1px solid #000" }} />
              <div style={{ fontSize: "9pt", marginTop: "4pt", color: "#333" }}>{nume ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
