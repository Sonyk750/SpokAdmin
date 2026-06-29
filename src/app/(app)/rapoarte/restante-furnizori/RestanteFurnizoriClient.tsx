"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Row {
  id:            string;
  nume:          string;
  cui:           string | null;
  telefon:       string | null;
  totalFacturat: number;
  totalPlatit:   number;
  sold:          number;
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

async function generatePdf(asoc: AsocInfo | null, rows: Row[]) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const tFacturat = rows.reduce((s, r) => s + r.totalFacturat, 0);
  const tPlatit   = rows.reduce((s, r) => s + r.totalPlatit,   0);
  const tSold     = rows.reduce((s, r) => s + r.sold,          0);
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");

  const body: any[][] = [
    [
      { text: "#",          style: "th", alignment: "center" },
      { text: "Furnizor",   style: "th" },
      { text: "CUI",        style: "th", alignment: "center" },
      { text: "Facturat\n(lei)",  style: "th", alignment: "right" },
      { text: "Plătit\n(lei)",    style: "th", alignment: "right" },
      { text: "Sold\n(lei)",      style: "th", alignment: "right" },
    ],
    ...rows.map((r, i) => [
      { text: String(i + 1), alignment: "center", fontSize: 8 },
      { text: r.nume, fontSize: 8, bold: true },
      { text: r.cui ?? "—", alignment: "center", fontSize: 8 },
      { text: fmt2(r.totalFacturat), alignment: "right", fontSize: 8 },
      { text: fmt2(r.totalPlatit),   alignment: "right", fontSize: 8 },
      { text: fmt2(r.sold), alignment: "right", fontSize: 8, bold: true, color: r.sold > 0 ? "#c0392b" : r.sold < 0 ? "#1a6e2e" : "#333" },
    ]),
    [
      { text: `TOTAL (${rows.length} furnizori)`, colSpan: 3, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {},
      { text: fmt2(tFacturat), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(tPlatit),   alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(tSold),     alignment: "right", bold: true, fontSize: 9, color: tSold > 0 ? "#c0392b" : tSold < 0 ? "#1a6e2e" : "#333" },
    ],
  ];

  const docDef: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 70],
    content: [
      { columns: [
        { stack: [
          { text: asoc?.name ?? "", bold: true, fontSize: 13 },
          adresa ? { text: adresa, fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
        ], width: "*" },
        { stack: [{ text: "Situație la data", fontSize: 9, color: "#666" }, { text: roToday(), bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "RESTANȚE FURNIZORI", style: "title", alignment: "center", margin: [0, 14, 0, 14] },
      {
        table: { headerRows: 1, widths: [18, "*", 60, 60, 60, 65], body },
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
  pm.createPdf(docDef).download(`restante-furnizori-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RestanteFurnizoriClient() {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc,       setAsoc]       = useState<AsocInfo | null>(null);
  const [rows,       setRows]       = useState<Row[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/rapoarte/restante-furnizori?asociatieId=${asociatieId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRows(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tFacturat = rows.reduce((s, r) => s + r.totalFacturat, 0);
  const tPlatit   = rows.reduce((s, r) => s + r.totalPlatit,   0);
  const tSold     = rows.reduce((s, r) => s + r.sold,          0);

  async function handlePdf() {
    if (!rows.length || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
      await generatePdf(fresh, rows);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

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
            <h1 className="page-title">Restanțe furnizori</h1>
            <p className="page-sub">Solduri furnizori față de asociație — situație la zi ({roToday()})</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={rows.length === 0}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handlePdf} disabled={rows.length === 0 || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
            <button className="btn btn--secondary" onClick={fetchData} disabled={loading}>{loading ? "..." : "↻"}</button>
          </div>
        </div>
        {error && <div className="wizard__error">{error}</div>}
      </div>

      {rows.length > 0 && (
        <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Furnizori cu sold</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total facturat</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e2e8f0" }}>{fmt2(tFacturat)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total plătit</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(tPlatit)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Sold total (datorat)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: tSold > 0 ? "#f87171" : tSold < 0 ? "#4ade80" : "#64748b" }}>{fmt2(tSold)} lei</div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">✅</span>
          <div className="empty-state__title">Niciun furnizor cu sold deschis</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>#</th>
                <th>Furnizor</th>
                <th>CUI</th>
                <th>Telefon</th>
                <th style={{ textAlign: "right" }}>Facturat (lei)</th>
                <th style={{ textAlign: "right" }}>Plătit (lei)</th>
                <th style={{ textAlign: "right" }}>Sold (lei)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: "#e2e8f0" }}>{r.nume}</td>
                  <td style={{ color: "#94a3b8" }}>{r.cui ?? "—"}</td>
                  <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{r.telefon ?? "—"}</td>
                  <td style={{ textAlign: "right", color: "#cbd5e1", whiteSpace: "nowrap" }}>{fmt2(r.totalFacturat)}</td>
                  <td style={{ textAlign: "right", color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(r.totalPlatit)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, whiteSpace: "nowrap", color: r.sold > 0 ? "#f87171" : r.sold < 0 ? "#4ade80" : "#64748b" }}>{fmt2(r.sold)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>TOTAL ({rows.length})</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#cbd5e1", whiteSpace: "nowrap" }}>{fmt2(tFacturat)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80",  whiteSpace: "nowrap" }}>{fmt2(tPlatit)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, whiteSpace: "nowrap", color: tSold > 0 ? "#f87171" : tSold < 0 ? "#4ade80" : "#64748b" }}>{fmt2(tSold)}</td>
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
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 12pt" }}>Restanțe furnizori</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["#", "Furnizor", "CUI", "Facturat (lei)", "Plătit (lei)", "Sold (lei)"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i >= 3 ? "right" : i === 0 ? "center" : "left", fontWeight: "bold" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{i + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", fontWeight: "bold" }}>{r.nume}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{r.cui ?? "—"}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(r.totalFacturat)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(r.totalPlatit)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(r.sold)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL ({rows.length} furnizori)</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tFacturat)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tPlatit)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tSold)}</td>
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
