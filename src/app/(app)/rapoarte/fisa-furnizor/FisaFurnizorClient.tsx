"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface FisaRow {
  data: string;
  tip: "sold_initial" | "factura" | "plata";
  descriere: string;
  debit: number;
  credit: number;
  sold: number;
}
interface Fisa {
  furnizor: { nume: string; cui: string | null; telefon: string | null; email: string | null };
  soldFinal: number;
  rows: FisaRow[];
}
interface Furnizor { id: string; nume: string; cui: string | null; }
interface AsocInfo { name: string; address: string | null; city: string | null; cui: string | null; }

const fmt2 = (v: number) => v.toFixed(2);
function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function soldColor(v: number) {
  if (v < -0.005) return "#4ade80";  // credit — asociația are avans
  if (v >  0.005) return "#f87171";  // debit — asociația datorează
  return "#64748b";
}

async function downloadPdf(asoc: AsocInfo | null, fisa: Fisa) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const body: any[][] = [
    [
      { text: "Data",      style: "th", alignment: "center" },
      { text: "Descriere", style: "th" },
      { text: "Debit",     style: "th", alignment: "right" },
      { text: "Credit",    style: "th", alignment: "right" },
      { text: "Sold",      style: "th", alignment: "right" },
    ],
    ...fisa.rows.map(r => [
      { text: r.tip === "sold_initial" ? "—" : roDate(r.data), alignment: "center", fontSize: 8,
        bold: r.tip === "sold_initial", color: r.tip === "sold_initial" ? "#444" : "#222" },
      { text: r.descriere, fontSize: 8,
        bold: r.tip === "sold_initial", italics: r.tip === "sold_initial" },
      { text: r.debit  > 0 ? fmt2(r.debit)  : "", alignment: "right", fontSize: 8, color: "#c0392b" },
      { text: r.credit > 0 ? fmt2(r.credit) : "", alignment: "right", fontSize: 8, color: "#1a7a3f" },
      { text: fmt2(r.sold), alignment: "right", fontSize: 8,
        bold: true, color: r.sold < -0.005 ? "#1a7a3f" : r.sold > 0.005 ? "#c0392b" : "#555" },
    ]),
    [
      { text: "SOLD FINAL", colSpan: 4, alignment: "right", bold: true, fontSize: 9 }, {}, {}, {},
      { text: fmt2(fisa.soldFinal), alignment: "right", bold: true, fontSize: 10,
        color: fisa.soldFinal < -0.005 ? "#1a7a3f" : fisa.soldFinal > 0.005 ? "#c0392b" : "#555" },
    ],
  ];

  const doc: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 50],
    content: [
      { columns: [
        { stack: [
          { text: asoc?.name ?? "", bold: true, fontSize: 13 },
          { text: [asoc?.address, asoc?.city].filter(Boolean).join(", "), fontSize: 9, color: "#333" },
        ], width: "*" },
        { stack: [
          { text: "Data generării", fontSize: 9, color: "#666" },
          { text: new Date().toLocaleDateString("ro-RO"), bold: true, fontSize: 10 },
        ], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 10] },
      { text: "FIȘĂ FURNIZOR", style: "title", alignment: "center", margin: [0, 4, 0, 4] },
      { text: fisa.furnizor.nume, alignment: "center", fontSize: 11, bold: true },
      { text: [fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  |  "),
        alignment: "center", fontSize: 8, color: "#666", margin: [0, 0, 0, 14] },
      {
        table: { headerRows: 1, widths: [50, "*", 55, 55, 55], body },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null,
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => "#999", vLineColor: () => "#999",
          paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },
      { text: [
          { text: "Sold final: ", bold: false, fontSize: 9, color: "#555" },
          { text: `${fmt2(fisa.soldFinal)} lei`, bold: true, fontSize: 11,
            color: fisa.soldFinal < -0.005 ? "#1a7a3f" : fisa.soldFinal > 0.005 ? "#c0392b" : "#555" },
          { text: fisa.soldFinal < -0.005 ? "  (avans — suma se deduce din următoarea factură)" : fisa.soldFinal > 0.005 ? "  (de plătit)" : "  (achitat)", fontSize: 8, color: "#777" },
        ], margin: [0, 10, 0, 0],
      },
    ],
    styles: { title: { fontSize: 15, bold: true }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };

  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(doc).download(`fisa-furnizor-${fisa.furnizor.nume.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`);
}

export default function FisaFurnizorClient() {
  const { activeId: asociatieId } = useAsociatie();
  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [furnizori, setFurnizori] = useState<Furnizor[]>([]);
  const [furnizorId, setFurnizorId] = useState("");
  const [fisa, setFisa] = useState<Fisa | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unificare / deduplicare furnizori
  const [mergeOpen, setMergeOpen]         = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging]             = useState(false);
  const [dupOpen, setDupOpen]             = useState(false);
  const [dupPairs, setDupPairs]           = useState<{ base: string; target: Furnizor; dupes: Furnizor[] }[]>([]);
  const [dupLoading, setDupLoading]       = useState(false);
  const [dupRunning, setDupRunning]       = useState(false);
  const [dupSkip, setDupSkip]             = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
  }, [asociatieId]);

  const loadFurnizori = useCallback((keepId?: string) => {
    if (!asociatieId) { setFurnizori([]); setFurnizorId(""); return; }
    return fetch(`/api/furnizori?asociatieId=${asociatieId}`).then(r => r.json()).then((d: Furnizor[]) => {
      const list = Array.isArray(d) ? d : [];
      setFurnizori(list);
      setFurnizorId(prev => {
        const want = keepId ?? prev;
        return (want && list.some(x => x.id === want)) ? want : (list[0]?.id ?? "");
      });
    }).catch(() => setFurnizori([]));
  }, [asociatieId]);

  useEffect(() => { void loadFurnizori(); }, [loadFurnizori]);

  const fetchData = useCallback(async () => {
    if (!asociatieId || !furnizorId) { setFisa(null); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId, furnizorId });
    try {
      const res = await fetch(`/api/rapoarte/fisa-furnizor?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setFisa(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, furnizorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleMerge() {
    if (!furnizorId || !mergeTargetId || furnizorId === mergeTargetId) return;
    setMerging(true); setError(null);
    try {
      const res  = await fetch("/api/furnizori/merge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: furnizorId, targetId: mergeTargetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la unificare");
      const target = mergeTargetId;
      setMergeOpen(false); setMergeTargetId("");
      await loadFurnizori(target);
    } catch (e: any) { setError(e.message); }
    finally { setMerging(false); }
  }

  async function openDuplicates() {
    setDupLoading(true); setError(null);
    try {
      const res  = await fetch("/api/furnizori/duplicates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la detectare");
      setDupPairs(json.pairs ?? []);
      setDupSkip(new Set());
      setDupOpen(true);
    } catch (e: any) { setError(e.message); }
    finally { setDupLoading(false); }
  }

  async function runDedup() {
    setDupRunning(true); setError(null);
    try {
      for (const p of dupPairs) {
        for (const d of p.dupes) {
          if (dupSkip.has(d.id)) continue;
          const res = await fetch("/api/furnizori/merge", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceId: d.id, targetId: p.target.id }),
          });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Eroare"); }
        }
      }
      setDupOpen(false);
      await loadFurnizori();
      await fetchData();
    } catch (e: any) { setError(e.message); }
    finally { setDupRunning(false); }
  }

  async function handlePdf() {
    if (!fisa) return;
    setPdfLoading(true); setError(null);
    try {
      const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
      await downloadPdf(fresh, fisa);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  if (furnizori.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-header"><div><h1 className="page-title">Fișă furnizor</h1></div></div>
        <div className="empty-state"><span className="empty-state__icon">🏭</span><div className="empty-state__title">Niciun furnizor înregistrat</div></div>
      </div>
    );
  }

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
            <h1 className="page-title">Fișă furnizor</h1>
            <p className="page-sub">Extras cronologic: sold inițial, facturi, plăți, sold curent</p>
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
          {furnizori.length > 1 && (
            <button className="btn btn--ghost" onClick={() => { setMergeTargetId(""); setMergeOpen(true); }} disabled={!furnizorId} style={{ alignSelf: "flex-end" }}>⇄ Unifică</button>
          )}
          <button className="btn btn--ghost" onClick={openDuplicates} disabled={dupLoading} style={{ alignSelf: "flex-end" }}>{dupLoading ? "..." : "🧹 Curăță duplicate"}</button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {/* ── Modals unificare ──────────────────────────────────────────── */}
      {mergeOpen && (
        <div className="modal-overlay" onClick={() => !merging && setMergeOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal__header"><h2 className="modal__title">Unifică furnizori</h2></div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                Muți furnizorul <strong style={{ color: "#f87171" }}>{furnizori.find(f => f.id === furnizorId)?.nume}</strong> în furnizorul ales mai jos. Toate facturile, plățile și avansurile trec la el, iar duplicatul se dezactivează.
              </p>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Păstrează (furnizorul corect)</label>
                <select className="input" value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)}>
                  <option value="">— alege furnizorul de păstrat —</option>
                  {furnizori.filter(f => f.id !== furnizorId).map(f => (
                    <option key={f.id} value={f.id}>{f.nume}{f.cui ? ` (${f.cui})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setMergeOpen(false)} disabled={merging}>Anulează</button>
              <button className="btn btn--primary" onClick={handleMerge} disabled={merging || !mergeTargetId}>{merging ? "Se unifică..." : "Unifică"}</button>
            </div>
          </div>
        </div>
      )}

      {dupOpen && (() => {
        const totalDeMerge = dupPairs.reduce((s, p) => s + p.dupes.filter(d => !dupSkip.has(d.id)).length, 0);
        return (
          <div className="modal-overlay" onClick={() => !dupRunning && setDupOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "640px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div className="modal__header"><h2 className="modal__title">Curăță duplicate furnizori</h2></div>
              <div className="modal__body" style={{ overflowY: "auto" }}>
                {dupPairs.length === 0 ? (
                  <p style={{ fontSize: "0.9rem", color: "#4ade80" }}>✓ Nicio dublură detectată.</p>
                ) : (
                  <>
                    <p style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5, marginBottom: "1rem" }}>
                      Furnizori cu același nume de bază, unde unul are CUI. Varianta <strong>fără CUI</strong> se comasează în cea <strong>cu CUI</strong>. Debifează ce nu vrei.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {dupPairs.map(p => (
                        <div key={p.base} className="dash-panel" style={{ padding: "0.85rem 1rem" }}>
                          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#475569", fontWeight: 700, marginBottom: "0.35rem" }}>Se păstrează (cu CUI)</div>
                          <div style={{ fontWeight: 700, color: "#4ade80", fontSize: "0.85rem" }}>{p.target.nume}{p.target.cui ? ` (${p.target.cui})` : ""}</div>
                          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#475569", fontWeight: 700, margin: "0.6rem 0 0.35rem" }}>Se comasează în el</div>
                          {p.dupes.map(d => (
                            <label key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#f87171", cursor: "pointer", padding: "0.15rem 0" }}>
                              <input type="checkbox" checked={!dupSkip.has(d.id)}
                                onChange={e => setDupSkip(prev => { const n = new Set(prev); if (e.target.checked) n.delete(d.id); else n.add(d.id); return n; })} />
                              <span>{d.nume}{d.cui ? ` (${d.cui})` : " — fără CUI"}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button className="btn btn--secondary" onClick={() => setDupOpen(false)} disabled={dupRunning}>Închide</button>
                {dupPairs.length > 0 && (
                  <button className="btn btn--primary" onClick={runDedup} disabled={dupRunning || totalDeMerge === 0}>{dupRunning ? "Se unifică..." : `Unifică ${totalDeMerge} duplicate`}</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Fișă ──────────────────────────────────────────────────────── */}
      {loading && <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}>Se încarcă...</div>}

      {fisa && (
        <>
          {/* Header furnizor + sold curent */}
          <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#e2e8f0" }}>{fisa.furnizor.nume}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              {[fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  •  ") || "fără date de contact"}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Sold curent</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: soldColor(fisa.soldFinal) }}>
                {fmt2(fisa.soldFinal)} lei
                <span style={{ fontSize: "0.75rem", fontWeight: 400, marginLeft: "0.6rem", color: "#64748b" }}>
                  {fisa.soldFinal < -0.005 ? "avans (se deduce din viitoarele facturi)" : fisa.soldFinal > 0.005 ? "de plătit" : "achitat"}
                </span>
              </div>
            </div>
          </div>

          {/* Extras de cont */}
          <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
            {fisa.rows.length === 0 ? (
              <div className="dash-panel__empty">Nicio tranzacție înregistrată.</div>
            ) : (
              <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descriere</th>
                    <th style={{ textAlign: "right" }}>Debit (lei)</th>
                    <th style={{ textAlign: "right" }}>Credit (lei)</th>
                    <th style={{ textAlign: "right" }}>Sold (lei)</th>
                  </tr>
                </thead>
                <tbody>
                  {fisa.rows.map((r, i) => (
                    <tr key={i} className={r.tip === "sold_initial" ? "fisa-row--init" : undefined}>
                      <td style={{ whiteSpace: "nowrap", color: r.tip === "sold_initial" ? "#fbbf24" : "#94a3b8" }}>
                        {r.tip === "sold_initial" ? "Inițializare" : roDate(r.data)}
                      </td>
                      <td style={{ color: r.tip === "sold_initial" ? "#fbbf24" : "#cbd5e1", fontWeight: r.tip === "sold_initial" ? 600 : 400 }}>
                        {r.descriere}
                      </td>
                      <td style={{ textAlign: "right", color: "#f87171", fontWeight: r.debit > 0 ? 600 : 400 }}>
                        {r.debit > 0 ? fmt2(r.debit) : ""}
                      </td>
                      <td style={{ textAlign: "right", color: "#4ade80", fontWeight: r.credit > 0 ? 600 : 400 }}>
                        {r.credit > 0 ? fmt2(r.credit) : ""}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: soldColor(r.sold), whiteSpace: "nowrap" }}>
                        {fmt2(r.sold)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>SOLD FINAL</td>
                    <td style={{ textAlign: "right", fontWeight: 900, fontSize: "1rem", color: soldColor(fisa.soldFinal) }}>
                      {fmt2(fisa.soldFinal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Print zone */}
          <div id="print-zone">
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "8pt" }}>
              <div>
                <div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div>
                <div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.city].filter(Boolean).join(", ")}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "9pt", color: "#666" }}>Data</div>
                <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{new Date().toLocaleDateString("ro-RO")}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase" }}>Fișă furnizor</div>
            <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", marginTop: "2pt" }}>{fisa.furnizor.nume}</div>
            <div style={{ textAlign: "center", fontSize: "8.5pt", color: "#555", marginBottom: "12pt" }}>
              {[fisa.furnizor.cui ? `CUI: ${fisa.furnizor.cui}` : null, fisa.furnizor.telefon, fisa.furnizor.email].filter(Boolean).join("  |  ")}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr>{["Data", "Descriere", "Debit", "Credit", "Sold"].map((h, i) => (
                  <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "3pt 4pt", textAlign: i >= 2 ? "right" : i === 0 ? "center" : "left", fontWeight: "bold" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {fisa.rows.map((r, idx) => (
                  <tr key={idx} style={{ background: r.tip === "sold_initial" ? "#fffbe6" : idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                    <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "center", fontStyle: r.tip === "sold_initial" ? "italic" : "normal" }}>
                      {r.tip === "sold_initial" ? "Init." : roDate(r.data)}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "3pt 4pt", fontStyle: r.tip === "sold_initial" ? "italic" : "normal" }}>{r.descriere}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{r.debit  > 0 ? fmt2(r.debit)  : ""}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right" }}>{r.credit > 0 ? fmt2(r.credit) : ""}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(r.sold)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ border: "1px solid #555", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold" }}>SOLD FINAL</td>
                  <td style={{ border: "1px solid #555", padding: "3pt 4pt", textAlign: "right", fontWeight: "bold", fontSize: "10pt" }}>{fmt2(fisa.soldFinal)}</td>
                </tr>
              </tfoot>
            </table>
            <div style={{ marginTop: "8pt", fontSize: "9pt" }}>
              Sold final: <strong>{fmt2(fisa.soldFinal)} lei</strong>
              {fisa.soldFinal < -0.005 ? " — avans (se deduce din viitoarele facturi)" : fisa.soldFinal > 0.005 ? " — de plătit" : " — achitat"}
            </div>
          </div>
        </>
      )}
    </>
  );
}
