"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Row {
  id:          string;
  numar:       string;
  proprietar:  string;
  telefon:     string | null;
  intretinere: number;
  fonduri:     number;
  total:       number;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

const fmt2 = (v: number) => v.toFixed(2);

function roToday() {
  return new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function generateAndDownloadPdf(asoc: AsocInfo | null, rows: Row[]) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const tInt = rows.reduce((s, r) => s + r.intretinere, 0);
  const tFond = rows.reduce((s, r) => s + r.fonduri, 0);
  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const body: any[][] = [
    [
      { text: "Ap.", style: "th", alignment: "center" },
      { text: "Proprietar", style: "th" },
      { text: "Telefon", style: "th", alignment: "center" },
      { text: "Întreținere\n(lei)", style: "th", alignment: "right" },
      { text: "Fonduri\n(lei)", style: "th", alignment: "right" },
      { text: "Total\n(lei)", style: "th", alignment: "right" },
    ],
    ...rows.map(r => [
      { text: r.numar, alignment: "center", bold: true, fontSize: 9 },
      { text: r.proprietar || "—", fontSize: 8 },
      { text: r.telefon ?? "—", alignment: "center", fontSize: 8 },
      { text: r.intretinere ? fmt2(r.intretinere) : "", alignment: "right", fontSize: 8 },
      { text: r.fonduri ? fmt2(r.fonduri) : "", alignment: "right", fontSize: 8 },
      { text: fmt2(r.total), alignment: "right", bold: true, fontSize: 8 },
    ]),
    [
      { text: `TOTAL (${rows.length} restanțieri)`, colSpan: 3, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {},
      { text: fmt2(tInt), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(tFond), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(tTotal), alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const docDefinition: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 70],
    content: [
      { columns: [
        { stack: [
          { text: asoc?.name ?? "", bold: true, fontSize: 13 },
          adresa ? { text: adresa, fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
          contact ? { text: contact, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
        ], width: "*" },
        { stack: [{ text: "Situație la data", fontSize: 9, color: "#666" }, { text: roToday(), bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "RESTANȚE PROPRIETARI", style: "title", alignment: "center", margin: [0, 14, 0, 14] },
      {
        table: { headerRows: 1, widths: [28, "*", 75, 60, 55, 60], body },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null,
          hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999",
          paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },
    ],
    footer: () => ({
      margin: [30, 10, 30, 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#aaa" }] },
        { margin: [0, 8, 0, 0], columns: [
          { stack: [{ text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.adminName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
          { stack: [{ text: "CENZOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.cenzorName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
          { stack: [{ text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.presedinteName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
        ] },
      ],
    }),
    styles: { title: { fontSize: 15, bold: true, characterSpacing: 1 }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };

  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(`restante-proprietari-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RestantieriClient() {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/rapoarte/restantieri?asociatieId=${asociatieId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRows(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tInt = rows.reduce((s, r) => s + r.intretinere, 0);
  const tFond = rows.reduce((s, r) => s + r.fonduri, 0);
  const tTotal = rows.reduce((s, r) => s + r.total, 0);

  async function handleDownloadPdf() {
    if (!rows.length || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const res = await fetch(`/api/asociatii/${asociatieId}`);
      const freshAsoc: AsocInfo = await res.json();
      await generateAndDownloadPdf(freshAsoc, rows);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  function handlePrint() { window.print(); }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm 25mm 12mm; }
          body * { visibility: hidden; }
          #print-zone, #print-zone * { visibility: visible; }
          #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; }
        }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Restanțe proprietari</h1>
            <p className="page-sub">Apartamentele cu datorii — situație la zi ({roToday()})</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint} disabled={rows.length === 0}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={rows.length === 0 || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
            <button className="btn btn--secondary" onClick={fetchData} disabled={loading}>
              {loading ? "..." : "↻"}
            </button>
          </div>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {rows.length > 0 && (
        <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Proprietari cu datorii</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Restanță întreținere</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f87171" }}>{fmt2(tInt)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Restanță fonduri</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fbbf24" }}>{fmt2(tFond)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total restanțe</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ef4444" }}>{fmt2(tTotal)} lei</div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">✅</span>
          <div className="empty-state__title">Niciun restanțier — toate apartamentele sunt la zi</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: "center" }}>Ap.</th>
                <th>Proprietar</th>
                <th>Telefon</th>
                <th style={{ textAlign: "right" }}>Întreținere (lei)</th>
                <th style={{ textAlign: "right" }}>Fonduri (lei)</th>
                <th style={{ textAlign: "right" }}>Total (lei)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: "#a78bfa", textAlign: "center" }}>{r.numar}</td>
                  <td style={{ color: "#cbd5e1" }}>{r.proprietar || "—"}</td>
                  <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{r.telefon || "—"}</td>
                  <td style={{ textAlign: "right", color: "#f87171", whiteSpace: "nowrap" }}>{r.intretinere ? fmt2(r.intretinere) : ""}</td>
                  <td style={{ textAlign: "right", color: "#fbbf24", whiteSpace: "nowrap" }}>{r.fonduri ? fmt2(r.fonduri) : ""}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#ef4444", whiteSpace: "nowrap" }}>{fmt2(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>TOTAL ({rows.length})</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(tInt)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#fbbf24", whiteSpace: "nowrap" }}>{fmt2(tFond)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#ef4444", whiteSpace: "nowrap" }}>{fmt2(tTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Print zone */}
      <div id="print-zone">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "10pt" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div>
            {(asoc?.address || asoc?.city) && <div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ")}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9pt", color: "#666" }}>Situație la data</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roToday()}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 12pt" }}>Restanțe proprietari</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["Ap.", "Proprietar", "Telefon", "Întreținere\n(lei)", "Fonduri\n(lei)", "Total\n(lei)"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i >= 3 ? "right" : i === 1 ? "left" : "center", fontWeight: "bold", whiteSpace: "pre-line" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", fontWeight: "bold" }}>{r.numar}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{r.proprietar || "—"}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{r.telefon || "—"}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{r.intretinere ? fmt2(r.intretinere) : ""}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{r.fonduri ? fmt2(r.fonduri) : ""}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL ({rows.length} restanțieri)</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tInt)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tFond)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tTotal)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: "24pt", borderTop: "1px solid #aaa", paddingTop: "10pt", display: "flex", justifyContent: "space-between" }}>
          {[{ rol: "Administrator", nume: asoc?.adminName }, { rol: "Cenzor", nume: asoc?.cenzorName }, { rol: "Președinte", nume: asoc?.presedinteName }].map(({ rol, nume }) => (
            <div key={rol} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase" }}>{rol}</div>
              <div style={{ margin: "16pt auto 0", width: "75%", borderBottom: "1px solid #000" }} />
              <div style={{ fontSize: "9pt", marginTop: "4pt" }}>{nume ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
