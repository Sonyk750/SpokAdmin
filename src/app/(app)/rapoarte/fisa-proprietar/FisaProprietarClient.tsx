"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

interface IncRow { id: string; data: string; document: string; tipPlata: string; suma: number; detalii: string; soldInainte: number; }
interface FisaRow {
  data: string;
  tip: "sold_initial" | "incasare";
  descriere: string;
  debit: number;
  credit: number;
  sold: number;
}
interface ListaRow { id: string; luna: number; an: number; totalLuna: number; totalDePlata: number; achitat: number; rest: number; }
interface Fisa {
  proprietar: { nume: string; telefon: string | null; email: string | null; numarAp: string };
  restantaIntretinere: number; restantaFonduri: number; totalRestanta: number;
  incasari: IncRow[]; liste: ListaRow[];
}
interface ApItem { id: string; numar: string; proprietar: string; }
interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; cenzorName: string | null; presedinteName: string | null;
}

const fmt2 = (v: number) => v.toFixed(2);
const LUNI = ["", "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
const metodaLabel = (m: string) => m === "casa" ? "Casă" : m === "banca" ? "Bancă" : m === "online" ? "Online" : m;
function roDate(iso: string) { return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function soldColor(v: number) {
  if (v < -0.005) return "#4ade80";
  if (v > 0.005) return "#f87171";
  return "#64748b";
}
function buildRows(fisa: Fisa): FisaRow[] {
  const initialSold = fisa.incasari[0]?.soldInainte ?? fisa.totalRestanta;
  const rows: FisaRow[] = [{
    data: "",
    tip: "sold_initial",
    descriere: initialSold < -0.005 ? "Sold inițial — avans la preluare" : "Sold inițial — restanță la preluare",
    debit: initialSold > 0.005 ? initialSold : 0,
    credit: initialSold < -0.005 ? -initialSold : 0,
    sold: initialSold,
  }];

  for (const inc of fisa.incasari) {
    rows.push({
      data: inc.data,
      tip: "incasare",
      descriere: `Plată ${metodaLabel(inc.tipPlata)}${inc.document?.trim() ? ` · ${inc.document}` : ""}${inc.detalii ? ` · ${inc.detalii}` : ""}`,
      debit: 0,
      credit: inc.suma,
      sold: inc.soldInainte - inc.suma,
    });
  }

  return rows;
}

async function downloadPdf(asoc: AsocInfo | null, fisa: Fisa, dataStart: string, dataEnd: string) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const totalIncasat = fisa.incasari.reduce((s, r) => s + r.suma, 0);
  const rows = buildRows(fisa);
  const incBody: any[][] = [
    [ { text: "Data", style: "th", alignment: "center" }, { text: "Descriere", style: "th" }, { text: "Debit", style: "th", alignment: "right" }, { text: "Credit", style: "th", alignment: "right" }, { text: "Sold", style: "th", alignment: "right" } ],
    ...rows.map(r => [
      { text: r.tip === "sold_initial" ? "—" : roDate(r.data), alignment: "center", fontSize: 8, bold: r.tip === "sold_initial", color: r.tip === "sold_initial" ? "#444" : "#222" },
      { text: r.descriere, fontSize: 8, bold: r.tip === "sold_initial", italics: r.tip === "sold_initial" },
      { text: r.debit > 0 ? fmt2(r.debit) : "", alignment: "right", fontSize: 8, color: "#c0392b" },
      { text: r.credit > 0 ? fmt2(r.credit) : "", alignment: "right", fontSize: 8, color: "#1a7a3f" },
      { text: fmt2(r.sold), alignment: "right", fontSize: 8, bold: true, color: r.sold < -0.005 ? "#1a7a3f" : r.sold > 0.005 ? "#c0392b" : "#555" },
    ]),
    [ { text: `SOLD FINAL`, colSpan: 4, alignment: "right", bold: true, fontSize: 9 }, {}, {}, {}, { text: fmt2(fisa.totalRestanta), alignment: "right", bold: true, fontSize: 10, color: fisa.totalRestanta < -0.005 ? "#1a7a3f" : fisa.totalRestanta > 0.005 ? "#c0392b" : "#555" } ],
  ];

  const listeBody: any[][] = [
    [ { text: "Luna", style: "th", alignment: "center" }, { text: "Total lună", style: "th", alignment: "right" }, { text: "Total de plată", style: "th", alignment: "right" }, { text: "Achitat", style: "th", alignment: "right" }, { text: "Rest", style: "th", alignment: "right" } ],
    ...fisa.liste.map(l => [
      { text: `${LUNI[l.luna] ?? l.luna} ${l.an}`, alignment: "center", fontSize: 8 },
      { text: fmt2(l.totalLuna), alignment: "right", fontSize: 8 }, { text: fmt2(l.totalDePlata), alignment: "right", fontSize: 8 },
      { text: fmt2(l.achitat), alignment: "right", fontSize: 8 }, { text: fmt2(l.rest), alignment: "right", fontSize: 8, bold: true },
    ]),
  ];

  const doc: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 50],
    content: [
      { columns: [
        { stack: [{ text: asoc?.name ?? "", bold: true, fontSize: 13 }, { text: [asoc?.address, asoc?.city].filter(Boolean).join(", "), fontSize: 9, color: "#333" }], width: "*" },
        { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 10] },
      { text: "FIȘĂ PROPRIETAR", style: "title", alignment: "center", margin: [0, 4, 0, 6] },
      { text: `Ap. ${fisa.proprietar.numarAp} — ${fisa.proprietar.nume}`, alignment: "center", fontSize: 11, bold: true, margin: [0, 0, 0, 2] },
      { text: [fisa.proprietar.telefon, fisa.proprietar.email].filter(Boolean).join("  |  "), alignment: "center", fontSize: 8, color: "#666", margin: [0, 0, 0, 10] },
      { columns: [
        { text: `Restanță întreținere: ${fmt2(fisa.restantaIntretinere)} lei`, fontSize: 9 },
        { text: `Restanță fonduri: ${fmt2(fisa.restantaFonduri)} lei`, fontSize: 9, alignment: "center" },
        { text: `TOTAL restanță: ${fmt2(fisa.totalRestanta)} lei`, fontSize: 9, bold: true, alignment: "right" },
      ], margin: [0, 0, 0, 12] },
      { text: "Extras cronologic", bold: true, fontSize: 10, margin: [0, 4, 0, 4] },
      { table: { headerRows: 1, widths: [50, "*", 55, 55, 55], body: incBody }, layout: tableLayout() },
      { text: `Total încasat în perioadă: ${fmt2(totalIncasat)} lei`, fontSize: 9, alignment: "right", margin: [0, 6, 0, 0] },
      { text: "Liste de plată", bold: true, fontSize: 10, margin: [0, 14, 0, 4] },
      fisa.liste.length ? { table: { headerRows: 1, widths: ["*", "*", "*", "*", "*"], body: listeBody }, layout: tableLayout() } : { text: "Nicio listă de plată.", italics: true, fontSize: 8, color: "#777" },
    ],
    styles: { title: { fontSize: 15, bold: true }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(doc).download(`fisa-proprietar-ap${fisa.proprietar.numarAp}.pdf`);
}
function tableLayout() {
  return {
    fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null,
    hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999",
    paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
  };
}

export default function FisaProprietarClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();
  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [aps, setAps] = useState<ApItem[]>([]);
  const [apId, setApId] = useState("");
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [fisa, setFisa] = useState<Fisa | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); setAps([]); setApId(""); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
    fetch(`/api/asociatii/${asociatieId}/apartamente`).then(r => r.json()).then((d: { apartamente: any[] }) => {
      const list = (d.apartamente ?? []).map(a => ({ id: a.id, numar: a.numar, proprietar: a.proprietar || "" }));
      setAps(list);
      setApId(prev => (prev && list.some((x: ApItem) => x.id === prev)) ? prev : (list[0]?.id ?? ""));
    }).catch(() => setAps([]));
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId || !apId) { setFisa(null); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, apartamentId: apId, dataStart, dataEnd });
    try {
      const res = await fetch(`/api/rapoarte/fisa-proprietar?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setFisa(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, apId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalIncasat = fisa?.incasari.reduce((s, r) => s + r.suma, 0) ?? 0;
  const rows = fisa ? buildRows(fisa) : [];

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

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 15mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; } }
        @media screen { #print-zone { display: none !important; } }
        .fisa-row--init td { font-style: italic; background: rgba(251,191,36,0.06); }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Fișă proprietar</h1>
            <p className="page-sub">Extras cronologic: sold inițial, încasări, sold curent</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!fisa}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handlePdf} disabled={!fisa || pdfLoading}>{pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}</button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Apartament</label>
            <select className="input" value={apId} onChange={e => setApId(e.target.value)} style={{ minWidth: "240px" }}>
              {aps.map(a => <option key={a.id} value={a.id}>Ap. {a.numar}{a.proprietar ? ` — ${a.proprietar}` : ""}</option>)}
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
          <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>{loading ? "..." : "Actualizează"}</button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {fisa && (
        <>
          <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#e2e8f0" }}>Ap. {fisa.proprietar.numarAp} — {fisa.proprietar.nume || "—"}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              {[fisa.proprietar.telefon, fisa.proprietar.email].filter(Boolean).join("  •  ") || "fără contact"}
            </div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Restanță întreținere</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f87171" }}>{fmt2(fisa.restantaIntretinere)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Restanță fonduri</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fbbf24" }}>{fmt2(fisa.restantaFonduri)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Total restanță</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ef4444" }}>{fmt2(fisa.totalRestanta)} lei</div></div>
              <div><div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Total încasat (perioadă)</div><div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div></div>
            </div>
          </div>

          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#cbd5e1", margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Extras cronologic</div>
            {rows.length === 0 ? <div className="dash-panel__empty">Nicio mișcare în perioadă.</div> : (
              <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                <thead><tr><th>Data</th><th>Descriere</th><th style={{ textAlign: "right" }}>Debit (lei)</th><th style={{ textAlign: "right" }}>Credit (lei)</th><th style={{ textAlign: "right" }}>Sold (lei)</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.tip}-${i}`} className={r.tip === "sold_initial" ? "fisa-row--init" : undefined}>
                      <td style={{ whiteSpace: "nowrap", color: r.tip === "sold_initial" ? "#fbbf24" : "#94a3b8" }}>{r.tip === "sold_initial" ? "Inițializare" : roDate(r.data)}</td>
                      <td style={{ color: r.tip === "sold_initial" ? "#fbbf24" : "#cbd5e1", fontWeight: r.tip === "sold_initial" ? 600 : 400 }}>{r.descriere}</td>
                      <td style={{ textAlign: "right", color: "#f87171", whiteSpace: "nowrap", fontWeight: r.debit > 0 ? 700 : 400 }}>{r.debit > 0 ? fmt2(r.debit) : ""}</td>
                      <td style={{ textAlign: "right", color: "#4ade80", whiteSpace: "nowrap", fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? fmt2(r.credit) : ""}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: soldColor(r.sold), whiteSpace: "nowrap" }}>{fmt2(r.sold)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} style={{ textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>Total încasat</td><td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</td><td style={{ textAlign: "right", fontWeight: 900, fontSize: "1rem", color: soldColor(fisa.totalRestanta) }}>{fmt2(fisa.totalRestanta)}</td></tr></tfoot>
              </table>
            )}
          </div>

          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#cbd5e1", margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Liste de plată</div>
            {fisa.liste.length === 0 ? <div className="dash-panel__empty">Nicio listă de plată.</div> : (
              <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                <thead><tr><th>Luna</th><th style={{ textAlign: "right" }}>Total lună</th><th style={{ textAlign: "right" }}>Total de plată</th><th style={{ textAlign: "right" }}>Achitat</th><th style={{ textAlign: "right" }}>Rest</th></tr></thead>
                <tbody>
                  {fisa.liste.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600, color: "#a78bfa" }}>{LUNI[l.luna] ?? l.luna} {l.an}</td>
                      <td style={{ textAlign: "right", color: "#cbd5e1" }}>{fmt2(l.totalLuna)}</td>
                      <td style={{ textAlign: "right", color: "#cbd5e1" }}>{fmt2(l.totalDePlata)}</td>
                      <td style={{ textAlign: "right", color: "#4ade80" }}>{fmt2(l.achitat)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: l.rest > 0 ? "#f87171" : "#64748b" }}>{fmt2(l.rest)}</td>
                    </tr>
                  ))}
                </tbody>
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
          <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase" }}>Fișă proprietar</div>
          <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", marginTop: "2pt" }}>Ap. {fisa.proprietar.numarAp} — {fisa.proprietar.nume}</div>
          <div style={{ textAlign: "center", fontSize: "8.5pt", color: "#555", marginBottom: "8pt" }}>{[fisa.proprietar.telefon, fisa.proprietar.email].filter(Boolean).join("  |  ")}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "10pt" }}>
            <span>Restanță întreținere: <b>{fmt2(fisa.restantaIntretinere)} lei</b></span>
            <span>Restanță fonduri: <b>{fmt2(fisa.restantaFonduri)} lei</b></span>
            <span>TOTAL restanță: <b>{fmt2(fisa.totalRestanta)} lei</b></span>
          </div>
          <div style={{ fontWeight: "bold", fontSize: "10pt", margin: "6pt 0 4pt" }}>Extras cronologic</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <thead><tr>{["Data", "Descriere", "Debit", "Credit", "Sold"].map((h, i) => <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i >= 2 ? "right" : i === 1 ? "left" : "center", fontWeight: "bold" }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} style={{ background: r.tip === "sold_initial" ? "#fffbe6" : idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center", fontStyle: r.tip === "sold_initial" ? "italic" : "normal" }}>{r.tip === "sold_initial" ? "Init." : roDate(r.data)}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", fontStyle: r.tip === "sold_initial" ? "italic" : "normal" }}>{r.descriere}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{r.debit > 0 ? fmt2(r.debit) : ""}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{r.credit > 0 ? fmt2(r.credit) : ""}</td>
                  <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(r.sold)}</td>
                </tr>
              ))}
              <tr><td colSpan={3} style={{ borderTop: "2px solid #000", padding: "3pt 6pt", textAlign: "right", fontWeight: "bold" }}>TOTAL încasat</td><td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(totalIncasat)}</td><td style={{ borderTop: "2px solid #000", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(fisa.totalRestanta)}</td></tr>
            </tbody>
          </table>
          {fisa.liste.length > 0 && (
            <>
              <div style={{ fontWeight: "bold", fontSize: "10pt", margin: "12pt 0 4pt" }}>Liste de plată</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                <thead><tr>{["Luna", "Total lună", "Total de plată", "Achitat", "Rest"].map((h, i) => <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i === 0 ? "center" : "right", fontWeight: "bold" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {fisa.liste.map((l, idx) => (
                    <tr key={l.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                      <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center" }}>{LUNI[l.luna] ?? l.luna} {l.an}</td>
                      <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(l.totalLuna)}</td>
                      <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(l.totalDePlata)}</td>
                      <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{fmt2(l.achitat)}</td>
                      <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(l.rest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}
