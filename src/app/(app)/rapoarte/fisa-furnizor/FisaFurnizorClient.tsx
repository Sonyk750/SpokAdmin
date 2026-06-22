"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface FactRow { id: string; data: string; document: string; categorie: string | null; valoare: number; platit: number; rest: number; status: string; }
interface PlataRow { id: string; data: string; suma: number; metoda: string; document: string; }
interface Fisa {
  furnizor: { nume: string; cui: string | null; telefon: string | null; email: string | null };
  totalFacturat: number; totalPlatit: number; soldCurent: number;
  facturi: FactRow[]; plati: PlataRow[];
}
interface Furnizor { id: string; nume: string; cui: string | null; }
interface AsocInfo { name: string; address: string | null; city: string | null; sector: string | null; cui: string | null; phone: string | null; email: string | null; adminName: string | null; cenzorName: string | null; presedinteName: string | null; }

const fmt2 = (v: number) => v.toFixed(2);
const metodaLabel = (m: string) => m === "casa" ? "Casă" : m === "banca" ? "Bancă" : m === "online" ? "Online" : m;
function roDate(iso: string) { return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function tableLayout() {
  return { fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null, hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999", paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4 };
}

async function downloadPdf(asoc: AsocInfo | null, fisa: Fisa, dataStart: string, dataEnd: string) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const factBody: any[][] = [
    [ { text: "Data", style: "th", alignment: "center" }, { text: "Factura", style: "th", alignment: "center" }, { text: "Categorie", style: "th" }, { text: "Valoare", style: "th", alignment: "right" }, { text: "Plătit", style: "th", alignment: "right" }, { text: "Rest", style: "th", alignment: "right" } ],
    ...fisa.facturi.map(f => [
      { text: roDate(f.data), alignment: "center", fontSize: 8 }, { text: f.document, alignment: "center", fontSize: 8 }, { text: f.categorie || "—", fontSize: 8 },
      { text: fmt2(f.valoare), alignment: "right", fontSize: 8 }, { text: fmt2(f.platit), alignment: "right", fontSize: 8 }, { text: fmt2(f.rest), alignment: "right", fontSize: 8, bold: true },
    ]),
    [ { text: "TOTAL facturat", colSpan: 3, alignment: "right", bold: true, fontSize: 9 }, {}, {}, { text: fmt2(fisa.totalFacturat), alignment: "right", bold: true, fontSize: 9 }, { text: "", fontSize: 9 }, { text: "", fontSize: 9 } ],
  ];
  const platiBody: any[][] = [
    [ { text: "Data", style: "th", alignment: "center" }, { text: "Factura", style: "th", alignment: "center" }, { text: "Metodă", style: "th", alignment: "center" }, { text: "Sumă", style: "th", alignment: "right" } ],
    ...fisa.plati.map(p => [
      { text: roDate(p.data), alignment: "center", fontSize: 8 }, { text: p.document, alignment: "center", fontSize: 8 }, { text: metodaLabel(p.metoda), alignment: "center", fontSize: 8 }, { text: fmt2(p.suma), alignment: "right", fontSize: 8 },
    ]),
    [ { text: "TOTAL plătit", colSpan: 3, alignment: "right", bold: true, fontSize: 9 }, {}, {}, { text: fmt2(fisa.totalPlatit), alignment: "right", bold: true, fontSize: 9 } ],
  ];

  const doc: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 50],
    content: [
      { columns: [
        { stack: [{ text: asoc?.name ?? "", bold: true, fontSize: 13 }, { text: [asoc?.address, asoc?.city].filter(Boolean).join(", "), fontSize: 9, color: "#333" }], width: "*" },
        { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 10] },
      { text: "FIȘĂ FURNIZOR", style: "title", alignment: "center", margin: [0, 4, 0, 4] },
      { text: fisa.furnizor.nume, alignment: "center", fontSize: 11, bold: true },
      { text: [fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  |  "), alignment: "center", fontSize: 8, color: "#666", margin: [0, 0, 0, 10] },
      { columns: [
        { text: `Facturat (perioadă): ${fmt2(fisa.totalFacturat)} lei`, fontSize: 9 },
        { text: `Plătit (perioadă): ${fmt2(fisa.totalPlatit)} lei`, fontSize: 9, alignment: "center" },
        { text: `SOLD curent: ${fmt2(fisa.soldCurent)} lei`, fontSize: 9, bold: true, alignment: "right" },
      ], margin: [0, 0, 0, 12] },
      { text: "Facturi", bold: true, fontSize: 10, margin: [0, 4, 0, 4] },
      fisa.facturi.length ? { table: { headerRows: 1, widths: [50, 55, "*", 55, 55, 55], body: factBody }, layout: tableLayout() } : { text: "Nicio factură în perioadă.", italics: true, fontSize: 8, color: "#777" },
      { text: "Plăți", bold: true, fontSize: 10, margin: [0, 14, 0, 4] },
      fisa.plati.length ? { table: { headerRows: 1, widths: [60, 70, 70, "*"], body: platiBody }, layout: tableLayout() } : { text: "Nicio plată în perioadă.", italics: true, fontSize: 8, color: "#777" },
    ],
    styles: { title: { fontSize: 15, bold: true }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(doc).download(`fisa-furnizor-${fisa.furnizor.nume.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`);
}

export default function FisaFurnizorClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();
  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [furnizori, setFurnizori] = useState<Furnizor[]>([]);
  const [furnizorId, setFurnizorId] = useState("");
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [fisa, setFisa] = useState<Fisa | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  useEffect(() => {
    fetch(`/api/furnizori`).then(r => r.json()).then((d: Furnizor[]) => {
      const list = Array.isArray(d) ? d : [];
      setFurnizori(list);
      setFurnizorId(prev => (prev && list.some(x => x.id === prev)) ? prev : (list[0]?.id ?? ""));
    }).catch(() => setFurnizori([]));
  }, []);

  const fetchData = useCallback(async () => {
    if (!asociatieId || !furnizorId) { setFisa(null); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, furnizorId, dataStart, dataEnd });
    try {
      const res = await fetch(`/api/rapoarte/fisa-furnizor?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setFisa(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, furnizorId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handlePdf() {
    if (!fisa || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
      await downloadPdf(fresh, fisa, dataStart, dataEnd);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  if (furnizori.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-header"><div><h1 className="page-title">Fișă furnizor</h1><p className="page-sub">Extras pe furnizor</p></div></div>
        <div className="empty-state"><span className="empty-state__icon">🏭</span><div className="empty-state__title">Niciun furnizor înregistrat</div></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 15mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; } }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Fișă furnizor</h1>
            <p className="page-sub">Extras pe furnizor: facturi, plăți și sold</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!fisa}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handlePdf} disabled={!fisa || pdfLoading}>{pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}</button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Furnizor</label>
            <select className="input" value={furnizorId} onChange={e => setFurnizorId(e.target.value)} style={{ minWidth: "240px" }}>
              {furnizori.map(f => <option key={f.id} value={f.id}>{f.nume}{f.cui ? ` (${f.cui})` : ""}</option>)}
            </select>
          </div>
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

      {fisa && (
        <>
          <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#e2e8f0" }}>{fisa.furnizor.nume}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              {[fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  •  ") || "fără date de contact"}
            </div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Facturat (perioadă)</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>{fmt2(fisa.totalFacturat)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Plătit (perioadă)</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(fisa.totalPlatit)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Sold curent (de plată)</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: fisa.soldCurent > 0 ? "#f87171" : "#64748b" }}>{fmt2(fisa.soldCurent)} lei</div></div>
            </div>
          </div>

          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#cbd5e1", margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Facturi</div>
            {fisa.facturi.length === 0 ? <div className="dash-panel__empty">Nicio factură în perioadă.</div> : (
              <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                <thead><tr><th>Data</th><th>Factura</th><th>Categorie</th><th style={{ textAlign: "right" }}>Valoare</th><th style={{ textAlign: "right" }}>Plătit</th><th style={{ textAlign: "right" }}>Rest</th></tr></thead>
                <tbody>
                  {fisa.facturi.map(f => (
                    <tr key={f.id}>
                      <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(f.data)}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>{f.document}</td>
                      <td style={{ color: "#94a3b8" }}>{f.categorie || "—"}</td>
                      <td style={{ textAlign: "right", color: "#cbd5e1" }}>{fmt2(f.valoare)}</td>
                      <td style={{ textAlign: "right", color: "#4ade80" }}>{fmt2(f.platit)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: f.rest > 0 ? "#f87171" : "#64748b" }}>{fmt2(f.rest)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} style={{ textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>Total facturat</td><td style={{ textAlign: "right", fontWeight: 800, color: "#a78bfa" }}>{fmt2(fisa.totalFacturat)}</td><td /><td /></tr></tfoot>
              </table>
            )}
          </div>

          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#cbd5e1", margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Plăți</div>
            {fisa.plati.length === 0 ? <div className="dash-panel__empty">Nicio plată în perioadă.</div> : (
              <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                <thead><tr><th>Data</th><th>Factura</th><th style={{ textAlign: "center" }}>Metodă</th><th style={{ textAlign: "right" }}>Sumă (lei)</th></tr></thead>
                <tbody>
                  {fisa.plati.map(p => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(p.data)}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>{p.document}</td>
                      <td style={{ textAlign: "center", color: "#94a3b8" }}>{metodaLabel(p.metoda)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(p.suma)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} style={{ textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>Total plătit</td><td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80" }}>{fmt2(fisa.totalPlatit)}</td></tr></tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {/* Print zone */}
      {fisa && (
        <div id="print-zone">
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "8pt" }}>
            <div><div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div><div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.city].filter(Boolean).join(", ")}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div><div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div></div>
          </div>
          <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase" }}>Fișă furnizor</div>
          <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", marginTop: "2pt" }}>{fisa.furnizor.nume}</div>
          <div style={{ textAlign: "center", fontSize: "8.5pt", color: "#555", marginBottom: "8pt" }}>{[fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  |  ")}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "10pt" }}>
            <span>Facturat: <b>{fmt2(fisa.totalFacturat)} lei</b></span>
            <span>Plătit: <b>{fmt2(fisa.totalPlatit)} lei</b></span>
            <span>SOLD curent: <b>{fmt2(fisa.soldCurent)} lei</b></span>
          </div>
          <div style={{ fontWeight: "bold", fontSize: "10pt", margin: "6pt 0 4pt" }}>Facturi</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <thead><tr>{["Data", "Factura", "Categorie", "Valoare", "Plătit", "Rest"].map((h, i) => <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i >= 3 ? "right" : i === 2 ? "left" : "center", fontWeight: "bold" }}>{h}</th>)}</tr></thead>
            <tbody>
              {fisa.facturi.map((f, idx) => (
                <tr key={f.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{roDate(f.data)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{f.document}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt" }}>{f.categorie || "—"}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(f.valoare)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(f.platit)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(f.rest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: "bold", fontSize: "10pt", margin: "12pt 0 4pt" }}>Plăți</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <thead><tr>{["Data", "Factura", "Metodă", "Sumă"].map((h, i) => <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i === 3 ? "right" : "center", fontWeight: "bold" }}>{h}</th>)}</tr></thead>
            <tbody>
              {fisa.plati.map((p, idx) => (
                <tr key={p.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{roDate(p.data)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{p.document}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{metodaLabel(p.metoda)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(p.suma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
