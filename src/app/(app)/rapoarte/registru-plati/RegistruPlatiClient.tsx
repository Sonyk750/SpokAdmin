"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface PlataRow {
  id:        string;
  data:      string;
  document:  string;
  furnizor:  string;
  categorie: string | null;
  metoda:    string;
  suma:      number;
  notes:     string | null;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

const fmt2 = (v: number) => v.toFixed(2);
const metodaLabel = (m: string) => m === "casa" ? "Casă" : m === "banca" ? "Bancă" : m === "online" ? "Online" : m;

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function generateAndDownloadPdf(asoc: AsocInfo | null, rows: PlataRow[], dataStart: string, dataEnd: string) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const total = rows.reduce((s, r) => s + r.suma, 0);
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const tableBody: any[][] = [
    [
      { text: "Nr.\ncrt.", style: "th", alignment: "center" },
      { text: "Data", style: "th", alignment: "center" },
      { text: "Document", style: "th", alignment: "center" },
      { text: "Furnizor / explicație", style: "th" },
      { text: "Metodă", style: "th", alignment: "center" },
      { text: "Sumă\n(lei)", style: "th", alignment: "right" },
    ],
    ...rows.map((r, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(r.data), alignment: "center", fontSize: 8 },
      { text: r.document, alignment: "center", fontSize: 8 },
      { stack: [
        { text: r.furnizor, fontSize: 8, bold: true },
        ...(r.categorie || r.notes ? [{ text: [r.categorie, r.notes].filter(Boolean).join(" — "), fontSize: 7.5, color: "#555", italics: true, margin: [0, 1, 0, 0] }] : []),
      ] },
      { text: metodaLabel(r.metoda), alignment: "center", fontSize: 8 },
      { text: fmt2(r.suma), alignment: "right", fontSize: 8 },
    ]),
    [
      { text: `TOTAL (${rows.length} plăți)`, colSpan: 5, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {}, {}, {},
      { text: fmt2(total), alignment: "right", bold: true, fontSize: 9 },
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
        { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "REGISTRU PLĂȚI", style: "title", alignment: "center", margin: [0, 14, 0, 14] },
      {
        table: { headerRows: 1, widths: [22, 48, 55, "*", 50, 55], body: tableBody },
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
  pm.createPdf(docDefinition).download(`registru-plati-${dataStart}-${dataEnd}.pdf`);
}

export default function RegistruPlatiClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [rows, setRows] = useState<PlataRow[]>([]);
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
    const params = new URLSearchParams({ asociatieId, dataStart, dataEnd });
    try {
      const res = await fetch(`/api/rapoarte/registru-plati?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRows(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total      = rows.reduce((s, r) => s + r.suma, 0);
  const totalCasa  = rows.filter(r => r.metoda === "casa").reduce((s, r) => s + r.suma, 0);
  const totalBanca = rows.filter(r => r.metoda !== "casa").reduce((s, r) => s + r.suma, 0);

  async function handleDownloadPdf() {
    if (!rows.length || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const res = await fetch(`/api/asociatii/${asociatieId}`);
      const freshAsoc: AsocInfo = await res.json();
      await generateAndDownloadPdf(freshAsoc, rows, dataStart, dataEnd);
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
            <h1 className="page-title">Registru plăți</h1>
            <p className="page-sub">Plăți către furnizori în perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={rows.length === 0 || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1.5rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">De la</label>
            <input type="date" className="input" value={dataStart} onChange={e => setDataStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Până la</label>
            <input type="date" className="input" value={dataEnd} onChange={e => setDataEnd(e.target.value)} />
          </div>
          <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>
            {loading ? "Se încarcă..." : "Actualizează"}
          </button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {rows.length > 0 && (
        <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Plăți</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total plătit</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f87171" }}>{fmt2(total)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Din casă</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fbbf24" }}>{fmt2(totalCasa)} lei</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Din bancă</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#22d3ee" }}>{fmt2(totalBanca)} lei</div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">🧾</span>
          <div className="empty-state__title">Nicio plată în perioada selectată</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>Nr.</th>
                <th>Data</th>
                <th>Document</th>
                <th>Furnizor / explicație</th>
                <th style={{ textAlign: "center" }}>Metodă</th>
                <th style={{ textAlign: "right" }}>Sumă (lei)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id}>
                  <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(r.data)}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>{r.document}</td>
                  <td style={{ color: "#cbd5e1" }}>
                    {r.furnizor}
                    {(r.categorie || r.notes) && (
                      <span style={{ display: "block", color: "#64748b", fontSize: "0.75rem", marginTop: 2 }}>{[r.categorie, r.notes].filter(Boolean).join(" — ")}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center", color: "#94a3b8" }}>{metodaLabel(r.metoda)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(r.suma)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>Total {roDate(dataStart)} — {roDate(dataEnd)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(total)} lei</td>
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
            <div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 12pt" }}>Registru plăți</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["Nr.\ncrt.", "Data", "Document", "Furnizor / explicație", "Metodă", "Sumă\n(lei)"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i === 5 ? "right" : i === 3 ? "left" : "center", fontWeight: "bold", whiteSpace: "pre-line" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{roDate(r.data)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{r.document}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>
                  <b>{r.furnizor}</b>{(r.categorie || r.notes) ? ` — ${[r.categorie, r.notes].filter(Boolean).join(" — ")}` : ""}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{metodaLabel(r.metoda)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>{fmt2(r.suma)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL ({rows.length} plăți)</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(total)}</td>
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
