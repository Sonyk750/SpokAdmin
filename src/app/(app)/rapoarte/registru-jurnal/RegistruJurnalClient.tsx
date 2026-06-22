"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Operatiune {
  id:         string;
  data:       string;
  fel:        "incasare" | "plata" | "transfer";
  document:   string;
  explicatie: string;
  incNum:     number;
  incBanca:   number;
  platiNum:   number;
  platiBanca: number;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

const fmt2 = (v: number) => v.toFixed(2);
const cell = (v: number) => (v ? fmt2(v) : "");

const felLabel = (fel: Operatiune["fel"]) =>
  fel === "incasare" ? "Încasare" : fel === "plata" ? "Plată" : "Transfer";
const felColor = (fel: Operatiune["fel"]) =>
  fel === "incasare" ? "#4ade80" : fel === "plata" ? "#f87171" : "#22d3ee";

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Totals { incNum: number; incBanca: number; platiNum: number; platiBanca: number; }
function sumOps(ops: Operatiune[]): Totals {
  return ops.reduce((t, o) => ({
    incNum: t.incNum + o.incNum, incBanca: t.incBanca + o.incBanca,
    platiNum: t.platiNum + o.platiNum, platiBanca: t.platiBanca + o.platiBanca,
  }), { incNum: 0, incBanca: 0, platiNum: 0, platiBanca: 0 });
}

async function generateAndDownloadPdf(
  asoc: AsocInfo | null, soldInitNum: number, soldInitBanca: number,
  ops: Operatiune[], dataStart: string, dataEnd: string,
) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const tot = sumOps(ops);
  const finalNum   = soldInitNum   + tot.incNum   - tot.platiNum;
  const finalBanca = soldInitBanca + tot.incBanca - tot.platiBanca;

  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const th = (t: string, align = "right") => ({ text: t, style: "th", alignment: align });
  const body: any[][] = [
    [ th("Nr.", "center"), th("Data", "center"), th("Document", "center"), th("Explicație", "left"),
      th("Înc.\nnumerar"), th("Înc.\nbancă"), th("Plăți\nnumerar"), th("Plăți\nbancă") ],
    [ { text: "", fontSize: 8 }, { text: roDate(dataStart), alignment: "center", fontSize: 8 }, { text: "—", alignment: "center", fontSize: 8 }, { text: "Sold inițial", italics: true, fontSize: 8 },
      { text: fmt2(soldInitNum), alignment: "right", bold: true, fontSize: 8 }, { text: fmt2(soldInitBanca), alignment: "right", bold: true, fontSize: 8 }, { text: "", fontSize: 8 }, { text: "", fontSize: 8 } ],
    ...ops.map((o, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(o.data), alignment: "center", fontSize: 8 },
      { text: o.document, alignment: "center", fontSize: 8 },
      { text: o.explicatie, fontSize: 8 },
      { text: cell(o.incNum),    alignment: "right", fontSize: 8 },
      { text: cell(o.incBanca),  alignment: "right", fontSize: 8 },
      { text: cell(o.platiNum),  alignment: "right", fontSize: 8 },
      { text: cell(o.platiBanca),alignment: "right", fontSize: 8 },
    ]),
    [ { text: "TOTAL operațiuni", colSpan: 4, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {}, {},
      { text: fmt2(tot.incNum), alignment: "right", bold: true, fontSize: 9 }, { text: fmt2(tot.incBanca), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(tot.platiNum), alignment: "right", bold: true, fontSize: 9 }, { text: fmt2(tot.platiBanca), alignment: "right", bold: true, fontSize: 9 } ],
    [ { text: "SOLD FINAL", colSpan: 4, alignment: "right", bold: true, fontSize: 9 }, {}, {}, {},
      { text: `Numerar: ${fmt2(finalNum)}`, alignment: "right", bold: true, fontSize: 9, color: "#0e7490", colSpan: 2 }, {},
      { text: `Bancă: ${fmt2(finalBanca)}`, alignment: "right", bold: true, fontSize: 9, color: "#0e7490", colSpan: 2 }, {} ],
  ];

  const docDefinition: any = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [25, 36, 25, 60],
    content: [
      {
        columns: [
          { stack: [
            { text: asoc?.name ?? "", bold: true, fontSize: 13 },
            adresa ? { text: adresa, fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
            contact ? { text: contact, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
          ], width: "*" },
          { stack: [
            { text: "Perioada", fontSize: 9, color: "#666" },
            { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 },
          ], width: "auto", alignment: "right" },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 790, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "REGISTRU JURNAL DE ÎNCASĂRI ȘI PLĂȚI", style: "title", alignment: "center", margin: [0, 12, 0, 12] },
      {
        table: { headerRows: 1, widths: [20, 50, 60, "*", 70, 70, 70, 70], body },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r === 1 ? "#EFEFEF" : r % 2 === 1 ? "#F5F5F5" : null,
          hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999",
          paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },
    ],
    footer: () => ({
      margin: [25, 8, 25, 0],
      columns: [
        { stack: [{ text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 30, y1: 18, x2: 200, y2: 18, lineWidth: 0.5 }] }, { text: asoc?.adminName ?? "", fontSize: 8, alignment: "center", margin: [0, 3, 0, 0] }], width: "*", alignment: "center" },
        { stack: [{ text: "CENZOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 30, y1: 18, x2: 200, y2: 18, lineWidth: 0.5 }] }, { text: asoc?.cenzorName ?? "", fontSize: 8, alignment: "center", margin: [0, 3, 0, 0] }], width: "*", alignment: "center" },
        { stack: [{ text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 30, y1: 18, x2: 200, y2: 18, lineWidth: 0.5 }] }, { text: asoc?.presedinteName ?? "", fontSize: 8, alignment: "center", margin: [0, 3, 0, 0] }], width: "*", alignment: "center" },
      ],
    }),
    styles: { title: { fontSize: 14, bold: true, characterSpacing: 0.5 }, th: { bold: true, fontSize: 8 } },
    defaultStyle: { font: "Roboto" },
  };

  const fileName = `registru-jurnal-${dataStart}-${dataEnd}.pdf`;
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(fileName);
}

export default function RegistruJurnalClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [soldInitNum, setSoldInitNum] = useState(0);
  const [soldInitBanca, setSoldInitBanca] = useState(0);
  const [ops, setOps] = useState<Operatiune[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setOps([]); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, dataStart, dataEnd });
    try {
      const res = await fetch(`/api/rapoarte/registru-jurnal?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setSoldInitNum(json.soldInitNumerar ?? 0);
      setSoldInitBanca(json.soldInitBanca ?? 0);
      setOps(json.operatiuni ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tot = sumOps(ops);
  const finalNum   = soldInitNum   + tot.incNum   - tot.platiNum;
  const finalBanca = soldInitBanca + tot.incBanca - tot.platiBanca;

  async function handleDownloadPdf() {
    if (!asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const res = await fetch(`/api/asociatii/${asociatieId}`);
      const freshAsoc: AsocInfo = await res.json();
      await generateAndDownloadPdf(freshAsoc, soldInitNum, soldInitBanca, ops, dataStart, dataEnd);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  function handlePrint() { window.print(); }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  const SUM = [
    { label: "Sold final numerar (casă)", value: finalNum,        color: "#a78bfa" },
    { label: "Sold final bancă",          value: finalBanca,      color: "#22d3ee" },
    { label: "Total încasări",            value: tot.incNum + tot.incBanca,    color: "#4ade80" },
    { label: "Total plăți",               value: tot.platiNum + tot.platiBanca,color: "#f87171" },
  ];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          #print-zone, #print-zone * { visibility: visible; }
          #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 9pt; }
        }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru jurnal</h1>
            <p className="page-sub">Registru-jurnal de încasări și plăți — toate operațiunile asociației</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
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

      <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {SUM.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>{s.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: s.color }}>{fmt2(s.value)} lei</div>
          </div>
        ))}
      </div>

      {ops.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">📒</span>
          <div className="empty-state__title">Nicio operațiune în perioada selectată</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>Nr.</th>
                <th>Data</th>
                <th>Document</th>
                <th>Explicație</th>
                <th style={{ textAlign: "right" }}>Înc. numerar</th>
                <th style={{ textAlign: "right" }}>Înc. bancă</th>
                <th style={{ textAlign: "right" }}>Plăți numerar</th>
                <th style={{ textAlign: "right" }}>Plăți bancă</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td /><td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(dataStart)}</td><td style={{ color: "#64748b" }}>—</td>
                <td style={{ fontStyle: "italic", color: "#94a3b8" }}>Sold inițial</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap" }}>{fmt2(soldInitNum)}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#22d3ee", whiteSpace: "nowrap" }}>{fmt2(soldInitBanca)}</td>
                <td /><td />
              </tr>
              {ops.map((o, idx) => (
                <tr key={o.id}>
                  <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(o.data)}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>{o.document}</td>
                  <td style={{ color: "#94a3b8" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: felColor(o.fel), marginRight: 6 }}>{felLabel(o.fel)}</span>
                    {o.explicatie}
                  </td>
                  <td style={{ textAlign: "right", color: "#4ade80", whiteSpace: "nowrap" }}>{cell(o.incNum)}</td>
                  <td style={{ textAlign: "right", color: "#4ade80", whiteSpace: "nowrap" }}>{cell(o.incBanca)}</td>
                  <td style={{ textAlign: "right", color: "#f87171", whiteSpace: "nowrap" }}>{cell(o.platiNum)}</td>
                  <td style={{ textAlign: "right", color: "#f87171", whiteSpace: "nowrap" }}>{cell(o.platiBanca)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>TOTAL operațiuni</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(tot.incNum)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(tot.incBanca)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(tot.platiNum)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(tot.platiBanca)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: "#cbd5e1", textAlign: "right" }}>SOLD FINAL</td>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 800, color: "#a78bfa", whiteSpace: "nowrap" }}>Numerar: {fmt2(finalNum)}</td>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 800, color: "#22d3ee", whiteSpace: "nowrap" }}>Bancă: {fmt2(finalBanca)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Print zone */}
      <div id="print-zone">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "8pt" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div>
            {(asoc?.address || asoc?.city) && <div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ")}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase", margin: "6pt 0 10pt" }}>
          Registru jurnal de încasări și plăți
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
          <thead>
            <tr>
              {["Nr.", "Data", "Document", "Explicație", "Înc. numerar", "Înc. bancă", "Plăți numerar", "Plăți bancă"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i >= 4 ? "right" : i === 3 ? "left" : "center", fontWeight: "bold" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#efefef" }}>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt" }} />
              <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{roDate(dataStart)}</td>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>—</td>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt", fontStyle: "italic" }}>Sold inițial</td>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(soldInitNum)}</td>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(soldInitBanca)}</td>
              <td style={{ border: "1px solid #999", padding: "3pt 4pt" }} />
              <td style={{ border: "1px solid #999", padding: "3pt 4pt" }} />
            </tr>
            {ops.map((o, idx) => (
              <tr key={o.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center", whiteSpace: "nowrap" }}>{roDate(o.data)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center", whiteSpace: "nowrap" }}>{o.document}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt" }}><b>{felLabel(o.fel)}:</b> {o.explicatie}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{cell(o.incNum)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{cell(o.incBanca)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{cell(o.platiNum)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{cell(o.platiBanca)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ borderTop: "2px solid #000", padding: "3pt 6pt", textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
              <td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tot.incNum)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tot.incBanca)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tot.platiNum)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(tot.platiBanca)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: "3pt 6pt", textAlign: "right", fontWeight: "bold" }}>SOLD FINAL</td>
              <td colSpan={2} style={{ padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>Numerar: {fmt2(finalNum)}</td>
              <td colSpan={2} style={{ padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>Bancă: {fmt2(finalBanca)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: "20pt", display: "flex", justifyContent: "space-between" }}>
          {[{ rol: "Administrator", nume: asoc?.adminName }, { rol: "Cenzor", nume: asoc?.cenzorName }, { rol: "Președinte", nume: asoc?.presedinteName }].map(({ rol, nume }) => (
            <div key={rol} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase" }}>{rol}</div>
              <div style={{ margin: "16pt auto 0", width: "70%", borderBottom: "1px solid #000" }} />
              <div style={{ fontSize: "9pt", marginTop: "4pt" }}>{nume ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
