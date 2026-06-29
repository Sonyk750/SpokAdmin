"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

interface Operatiune {
  id:       string;
  data:     string;
  fel:      "incasare" | "plata" | "transfer";
  document: string;
  detalii:  string;
  intrare:  number;
  iesire:   number;
}

interface AsocInfo {
  name:           string;
  address:        string | null;
  city:           string | null;
  sector:         string | null;
  cui:            string | null;
  phone:          string | null;
  email:          string | null;
  adminName:      string | null;
  presedinteName: string | null;
  cenzorName:     string | null;
  banci?:         { name: string; iban?: string }[];
}

const fmt2 = (v: number) => v.toFixed(2);

const felLabel = (fel: Operatiune["fel"]) =>
  fel === "incasare" ? "Încasare" : fel === "plata" ? "Plată" : "Transfer";
const felColor = (fel: Operatiune["fel"]) =>
  fel === "incasare" ? "#4ade80" : fel === "plata" ? "#f87171" : "#22d3ee";
const felColorPdf = (fel: Operatiune["fel"]) =>
  fel === "incasare" ? "#1a7f37" : fel === "plata" ? "#b91c1c" : "#0e7490";

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function withRunningBalance(soldInitial: number, ops: Operatiune[]) {
  let sold = soldInitial;
  return ops.map(op => {
    sold += op.intrare - op.iesire;
    return { ...op, sold };
  });
}

async function generateAndDownloadPdf(
  asoc:        AsocInfo | null,
  cont:        string,
  soldInitial: number,
  ops:         Operatiune[],
  dataStart:   string,
  dataEnd:     string,
) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const rows = withRunningBalance(soldInitial, ops);
  const totalIntrari = ops.reduce((s, o) => s + o.intrare, 0);
  const totalIesiri  = ops.reduce((s, o) => s + o.iesire, 0);
  const soldFinal    = soldInitial + totalIntrari - totalIesiri;

  const adresa = [
    asoc?.address,
    asoc?.sector ? `Sector ${asoc.sector}` : null,
    asoc?.city,
  ].filter(Boolean).join(", ");
  const contact = [
    asoc?.cui   ? `CUI: ${asoc.cui}`     : null,
    asoc?.phone ? `Tel: ${asoc.phone}`   : null,
    asoc?.email ? `Email: ${asoc.email}` : null,
  ].filter(Boolean).join("   |   ");

  const tableBody: any[][] = [
    [
      { text: "Nr.\ncrt.", style: "th", alignment: "center" },
      { text: "Data",      style: "th", alignment: "center" },
      { text: "Document",  style: "th", alignment: "center" },
      { text: "Explicație", style: "th" },
      { text: "Intrări\n(lei)", style: "th", alignment: "right" },
      { text: "Ieșiri\n(lei)",  style: "th", alignment: "right" },
      { text: "Sold\n(lei)",    style: "th", alignment: "right" },
    ],
    [
      { text: "", alignment: "center", fontSize: 8 },
      { text: roDate(dataStart), alignment: "center", fontSize: 8 },
      { text: "—", alignment: "center", fontSize: 8 },
      { text: "Sold inițial", italics: true, fontSize: 8 },
      { text: "", alignment: "right", fontSize: 8 },
      { text: "", alignment: "right", fontSize: 8 },
      { text: fmt2(soldInitial), alignment: "right", bold: true, fontSize: 8 },
    ],
    ...rows.map((row, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(row.data), alignment: "center", fontSize: 8 },
      { text: row.document, alignment: "center", fontSize: 8 },
      {
        stack: [
          { text: felLabel(row.fel), fontSize: 7, color: felColorPdf(row.fel), bold: true },
          { text: row.detalii, fontSize: 8, margin: [0, 1, 0, 0] },
        ],
      },
      { text: row.intrare ? fmt2(row.intrare) : "", alignment: "right", fontSize: 8 },
      { text: row.iesire  ? fmt2(row.iesire)  : "", alignment: "right", fontSize: 8 },
      { text: fmt2(row.sold), alignment: "right", fontSize: 8 },
    ]),
    [
      { text: "TOTAL", colSpan: 4, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] },
      {}, {}, {},
      { text: fmt2(totalIntrari), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(totalIesiri),  alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(soldFinal),    alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 40, 30, 70],
    content: [
      {
        columns: [
          {
            stack: [
              { text: asoc?.name ?? "", bold: true, fontSize: 13 },
              adresa  ? { text: adresa,  fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
              contact ? { text: contact, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
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
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "REGISTRU DE BANCĂ", style: "title", alignment: "center", margin: [0, 14, 0, 4] },
      { text: cont, alignment: "center", fontSize: 11, bold: true, color: "#333", margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: [22, 48, 55, "*", 50, 50, 55],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#DDDDDD" : rowIndex === 1 ? "#EFEFEF" : rowIndex % 2 === 1 ? "#F5F5F5" : null,
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
    footer: () => ({
      margin: [30, 10, 30, 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#aaa" }] },
        {
          margin: [0, 8, 0, 0],
          columns: [
            { stack: [{ text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.adminName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
            { stack: [{ text: "CENZOR", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.cenzorName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
            { stack: [{ text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" }, { canvas: [{ type: "line", x1: 10, y1: 20, x2: 130, y2: 20, lineWidth: 0.5 }] }, { text: asoc?.presedinteName ?? "", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] }], width: "*", alignment: "center" },
          ],
        },
      ],
    }),
    styles: {
      title: { fontSize: 15, bold: true, characterSpacing: 1 },
      th:    { bold: true, fontSize: 9 },
    },
    defaultStyle: { font: "Roboto" },
  };

  const safeCont = cont.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const fileName = `registru-banca-${safeCont}-${dataStart}-${dataEnd}.pdf`;
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(fileName);
}

export default function RegistruBancaClient({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd:   string;
}) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc,        setAsoc]        = useState<AsocInfo | null>(null);
  const [conturi,     setConturi]     = useState<string[]>([]);
  const [cont,        setCont]        = useState("");
  const [dataStart,   setDataStart]   = useState(defaultStart);
  const [dataEnd,     setDataEnd]     = useState(defaultEnd);
  const [soldInitial, setSoldInitial] = useState(0);
  const [isPrimary,   setIsPrimary]   = useState(false);
  const [ops,         setOps]         = useState<Operatiune[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Încarcă asociația + conturile bancare
  useEffect(() => {
    if (!asociatieId) { setAsoc(null); setConturi([]); setCont(""); return; }
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then((d: AsocInfo) => {
        setAsoc(d);
        const banci: string[] = Array.isArray(d.banci) ? d.banci.map(b => b.name).filter(Boolean) : [];
        setConturi(banci);
        setCont(prev => (prev && banci.includes(prev)) ? prev : (banci[0] ?? ""));
      })
      .catch(() => { setConturi([]); setCont(""); });
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId || !cont) { setOps([]); setSoldInitial(0); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, cont, dataStart, dataEnd });
    try {
      const res  = await fetch(`/api/rapoarte/registru-banca?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setSoldInitial(json.soldInitial ?? 0);
      setIsPrimary(!!json.isPrimary);
      setOps(json.operatiuni ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, cont, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows         = withRunningBalance(soldInitial, ops);
  const totalIntrari = ops.reduce((s, o) => s + o.intrare, 0);
  const totalIesiri  = ops.reduce((s, o) => s + o.iesire, 0);
  const soldFinal    = soldInitial + totalIntrari - totalIesiri;

  async function handleDownloadPdf() {
    if (!asociatieId || !cont) return;
    setPdfLoading(true); setError(null);
    try {
      const res = await fetch(`/api/asociatii/${asociatieId}`);
      const freshAsoc: AsocInfo = await res.json();
      await generateAndDownloadPdf(freshAsoc, cont, soldInitial, ops, dataStart, dataEnd);
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

  if (conturi.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru bancă</h1>
            <p className="page-sub">Operațiunile prin contul bancar selectat</p>
          </div>
        </div>
        <div className="empty-state">
          <span className="empty-state__icon">🏦</span>
          <div className="empty-state__title">Niciun cont bancar configurat</div>
          <p className="page-sub" style={{ marginTop: "0.5rem" }}>Adaugă conturi bancare în inițializarea asociației (pasul Sold casă / bancă).</p>
        </div>
      </div>
    );
  }

  return (
    <>
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

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru bancă</h1>
            <p className="page-sub">Operațiunile prin contul bancar selectat</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint} disabled={!cont}>
              🖨 Printează
            </button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={pdfLoading || !cont}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Cont bancar</label>
            <select className="input" value={cont} onChange={e => setCont(e.target.value)} style={{ minWidth: "200px" }}>
              {conturi.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">De la</label>
            <RoDate className="input" value={dataStart} onChange={v => setDataStart(v)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Până la</label>
            <RoDate className="input" value={dataEnd} onChange={v => setDataEnd(v)} />
          </div>
          <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>
            {loading ? "Se încarcă..." : "Actualizează"}
          </button>
        </div>

        {conturi.length > 1 && !isPrimary && (
          <p className="page-sub" style={{ marginBottom: "1rem", fontSize: "0.8125rem" }}>
            ℹ️ Încasările și plățile generice „prin bancă" sunt atribuite contului principal ({conturi[0]}). Aici apar doar soldul inițial și transferurile contului „{cont}".
          </p>
        )}

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {/* Summary */}
      <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Cont</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#e2e8f0" }}>{cont}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Sold inițial</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>{fmt2(soldInitial)} lei</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Intrări</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIntrari)} lei</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Ieșiri</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f87171" }}>{fmt2(totalIesiri)} lei</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Sold final</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#22d3ee" }}>{fmt2(soldFinal)} lei</div>
        </div>
      </div>

      {/* Table (screen) */}
      {ops.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">🏦</span>
          <div className="empty-state__title">Nicio operațiune prin acest cont în perioada selectată</div>
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
                <th style={{ textAlign: "right" }}>Intrări (lei)</th>
                <th style={{ textAlign: "right" }}>Ieșiri (lei)</th>
                <th style={{ textAlign: "right" }}>Sold (lei)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: "center", color: "#64748b" }} />
                <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(dataStart)}</td>
                <td style={{ color: "#64748b" }}>—</td>
                <td style={{ fontStyle: "italic", color: "#94a3b8" }}>Sold inițial</td>
                <td />
                <td />
                <td style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap" }}>{fmt2(soldInitial)}</td>
              </tr>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(row.data)}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>{row.document}</td>
                  <td style={{ color: "#94a3b8" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: felColor(row.fel) }}>{felLabel(row.fel)}</span>
                    <span style={{ display: "block", color: "#64748b", fontSize: "0.78rem", marginTop: 1 }}>{row.detalii}</span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>{row.intrare ? fmt2(row.intrare) : ""}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#f87171", whiteSpace: "nowrap" }}>{row.iesire ? fmt2(row.iesire) : ""}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap" }}>{fmt2(row.sold)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>TOTAL</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(totalIntrari)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(totalIesiri)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#22d3ee", whiteSpace: "nowrap" }}>{fmt2(soldFinal)}</td>
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
            {(asoc?.address || asoc?.city) && (
              <div style={{ fontSize: "9pt", color: "#333", marginTop: "2pt" }}>
                {[asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ")}
              </div>
            )}
            {(asoc?.cui || asoc?.phone || asoc?.email) && (
              <div style={{ fontSize: "8pt", color: "#555", marginTop: "2pt" }}>
                {[asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("  |  ")}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", letterSpacing: "1pt", textTransform: "uppercase", margin: "10pt 0 2pt" }}>
          Registru de bancă
        </div>
        <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", color: "#333", marginBottom: "12pt" }}>{cont}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["Nr.\ncrt.", "Data", "Document", "Explicație", "Intrări\n(lei)", "Ieșiri\n(lei)", "Sold\n(lei)"].map((h, i) => (
                <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i >= 4 ? "right" : i <= 2 ? "center" : "left", fontWeight: "bold", fontSize: "9pt", whiteSpace: "pre-line" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#efefef" }}>
              <td style={{ border: "1px solid #999", padding: "3pt 5pt" }} />
              <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{roDate(dataStart)}</td>
              <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>—</td>
              <td style={{ border: "1px solid #999", padding: "3pt 5pt", fontStyle: "italic" }}>Sold inițial</td>
              <td style={{ border: "1px solid #999", padding: "3pt 5pt" }} />
              <td style={{ border: "1px solid #999", padding: "3pt 5pt" }} />
              <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(soldInitial)}</td>
            </tr>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{roDate(row.data)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{row.document}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>
                  <span style={{ fontWeight: "bold" }}>{felLabel(row.fel)}: </span>{row.detalii}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>{row.intrare ? fmt2(row.intrare) : ""}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>{row.iesire ? fmt2(row.iesire) : ""}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>{fmt2(row.sold)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(totalIntrari)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(totalIesiri)}</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(soldFinal)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: "24pt", borderTop: "1px solid #aaa", paddingTop: "10pt", display: "flex", justifyContent: "space-between" }}>
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
