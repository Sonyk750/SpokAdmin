"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface Linie { label: string; suma: number; }
interface Raport {
  venituri: Linie[]; totalVenituri: number;
  cheltuieli: Linie[]; totalCheltuieli: number;
  rezultat: number;
}
interface AsocInfo { name: string; address: string | null; city: string | null; sector: string | null; cui: string | null; phone: string | null; email: string | null; adminName: string | null; cenzorName: string | null; presedinteName: string | null; }

const fmt2 = (v: number) => v.toFixed(2);
function roDate(iso: string) { return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function tableLayout() {
  return { fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null, hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999", paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 5, paddingRight: () => 5 };
}

async function downloadPdf(asoc: AsocInfo | null, rap: Raport, dataStart: string, dataEnd: string) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const venBody: any[][] = [
    [ { text: "Categorie", style: "th" }, { text: "Suma (lei)", style: "th", alignment: "right" } ],
    ...rap.venituri.map(v => [{ text: v.label, fontSize: 9 }, { text: fmt2(v.suma), alignment: "right", fontSize: 9 }]),
    [ { text: "TOTAL VENITURI", bold: true, fontSize: 9 }, { text: fmt2(rap.totalVenituri), alignment: "right", bold: true, fontSize: 9 } ],
  ];
  const cheltBody: any[][] = [
    [ { text: "Categorie", style: "th" }, { text: "Suma (lei)", style: "th", alignment: "right" } ],
    ...rap.cheltuieli.map(c => [{ text: c.label, fontSize: 9 }, { text: fmt2(c.suma), alignment: "right", fontSize: 9 }]),
    [ { text: "TOTAL CHELTUIELI", bold: true, fontSize: 9 }, { text: fmt2(rap.totalCheltuieli), alignment: "right", bold: true, fontSize: 9 } ],
  ];

  const doc: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 50],
    content: [
      { columns: [
        { stack: [{ text: asoc?.name ?? "", bold: true, fontSize: 13 }, { text: [asoc?.address, asoc?.city].filter(Boolean).join(", "), fontSize: 9, color: "#333" }], width: "*" },
        { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 12] },
      { text: "VENITURI ȘI CHELTUIELI", style: "title", alignment: "center", margin: [0, 0, 0, 14] },
      { columns: [
        { width: "*", stack: [{ text: "VENITURI", bold: true, fontSize: 11, color: "#1a7f37", margin: [0, 0, 0, 4] }, { table: { headerRows: 1, widths: ["*", 70], body: venBody }, layout: tableLayout() }] },
        { width: 16, text: "" },
        { width: "*", stack: [{ text: "CHELTUIELI", bold: true, fontSize: 11, color: "#b91c1c", margin: [0, 0, 0, 4] }, { table: { headerRows: 1, widths: ["*", 70], body: cheltBody }, layout: tableLayout() }] },
      ] },
      { text: `REZULTAT (Venituri − Cheltuieli): ${fmt2(rap.rezultat)} lei`, bold: true, fontSize: 12, alignment: "center", color: rap.rezultat >= 0 ? "#1a7f37" : "#b91c1c", margin: [0, 18, 0, 0] },
    ],
    styles: { title: { fontSize: 15, bold: true }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(doc).download(`venituri-cheltuieli-${dataStart}-${dataEnd}.pdf`);
}

export default function VenituriCheltuieliClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();
  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [rap, setRap] = useState<Raport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setRap(null); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, dataStart, dataEnd });
    try {
      const res = await fetch(`/api/rapoarte/venituri-cheltuieli?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRap(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handlePdf() {
    if (!rap || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
      await downloadPdf(fresh, rap, dataStart, dataEnd);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  const maxBar = rap ? Math.max(1, rap.totalVenituri, rap.totalCheltuieli) : 1;

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 15mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; } }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Venituri și cheltuieli</h1>
            <p className="page-sub">Raport sintetic pe perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!rap}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handlePdf} disabled={!rap || pdfLoading}>{pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}</button>
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
          <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>{loading ? "..." : "Actualizează"}</button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {rap && (
        <>
          {/* Sumar + bare comparative */}
          <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Total venituri</div><div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(rap.totalVenituri)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Total cheltuieli</div><div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f87171" }}>{fmt2(rap.totalCheltuieli)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Rezultat</div><div style={{ fontSize: "1.5rem", fontWeight: 800, color: rap.rezultat >= 0 ? "#22d3ee" : "#ef4444" }}>{fmt2(rap.rezultat)} lei</div></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[{ l: "Venituri", v: rap.totalVenituri, c: "#4ade80" }, { l: "Cheltuieli", v: rap.totalCheltuieli, c: "#f87171" }].map(b => (
                <div key={b.l} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ width: 80, fontSize: "0.78rem", color: "#94a3b8" }}>{b.l}</span>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden", height: 22 }}>
                    <div style={{ width: `${(b.v / maxBar) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${b.c}, ${b.c}99)`, minWidth: 2 }} />
                  </div>
                  <span style={{ width: 110, textAlign: "right", fontWeight: 700, color: b.c, fontSize: "0.85rem" }}>{fmt2(b.v)} lei</span>
                </div>
              ))}
            </div>
          </div>

          {/* Doua tabele */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", margin: "0 1.5rem 1.5rem" }}>
            <div className="table-wrap">
              <div style={{ fontWeight: 700, color: "#4ade80", margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Venituri</div>
              {rap.venituri.length === 0 ? <div className="dash-panel__empty">Niciun venit în perioadă.</div> : (
                <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                  <thead><tr><th>Categorie</th><th style={{ textAlign: "right" }}>Suma (lei)</th></tr></thead>
                  <tbody>{rap.venituri.map(v => <tr key={v.label}><td style={{ color: "#cbd5e1" }}>{v.label}</td><td style={{ textAlign: "right", fontWeight: 600, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(v.suma)}</td></tr>)}</tbody>
                  <tfoot><tr><td style={{ fontWeight: 700, color: "#94a3b8" }}>TOTAL</td><td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80" }}>{fmt2(rap.totalVenituri)}</td></tr></tfoot>
                </table>
              )}
            </div>
            <div className="table-wrap">
              <div style={{ fontWeight: 700, color: "#f87171", margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Cheltuieli</div>
              {rap.cheltuieli.length === 0 ? <div className="dash-panel__empty">Nicio cheltuială în perioadă.</div> : (
                <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                  <thead><tr><th>Categorie</th><th style={{ textAlign: "right" }}>Suma (lei)</th></tr></thead>
                  <tbody>{rap.cheltuieli.map(c => <tr key={c.label}><td style={{ color: "#cbd5e1" }}>{c.label}</td><td style={{ textAlign: "right", fontWeight: 600, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(c.suma)}</td></tr>)}</tbody>
                  <tfoot><tr><td style={{ fontWeight: 700, color: "#94a3b8" }}>TOTAL</td><td style={{ textAlign: "right", fontWeight: 800, color: "#f87171" }}>{fmt2(rap.totalCheltuieli)}</td></tr></tfoot>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Print zone */}
      {rap && (
        <div id="print-zone">
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "10pt" }}>
            <div><div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div><div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.city].filter(Boolean).join(", ")}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div><div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div></div>
          </div>
          <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "4pt 0 12pt" }}>Venituri și cheltuieli</div>
          <div style={{ display: "flex", gap: "16pt" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", fontSize: "11pt", color: "#1a7f37", marginBottom: "4pt" }}>VENITURI</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                <thead><tr><th style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 5pt", textAlign: "left" }}>Categorie</th><th style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 5pt", textAlign: "right" }}>Suma</th></tr></thead>
                <tbody>{rap.venituri.map((v, i) => <tr key={v.label} style={{ background: i % 2 ? "#f5f5f5" : "#fff" }}><td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{v.label}</td><td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(v.suma)}</td></tr>)}</tbody>
                <tfoot><tr><td style={{ borderTop: "2px solid #000", padding: "3pt 5pt", fontWeight: "bold" }}>TOTAL</td><td style={{ borderTop: "2px solid #000", padding: "3pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(rap.totalVenituri)}</td></tr></tfoot>
              </table>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", fontSize: "11pt", color: "#b91c1c", marginBottom: "4pt" }}>CHELTUIELI</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                <thead><tr><th style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 5pt", textAlign: "left" }}>Categorie</th><th style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 5pt", textAlign: "right" }}>Suma</th></tr></thead>
                <tbody>{rap.cheltuieli.map((c, i) => <tr key={c.label} style={{ background: i % 2 ? "#f5f5f5" : "#fff" }}><td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{c.label}</td><td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(c.suma)}</td></tr>)}</tbody>
                <tfoot><tr><td style={{ borderTop: "2px solid #000", padding: "3pt 5pt", fontWeight: "bold" }}>TOTAL</td><td style={{ borderTop: "2px solid #000", padding: "3pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(rap.totalCheltuieli)}</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", marginTop: "16pt" }}>REZULTAT (Venituri − Cheltuieli): {fmt2(rap.rezultat)} lei</div>
        </div>
      )}
    </>
  );
}
