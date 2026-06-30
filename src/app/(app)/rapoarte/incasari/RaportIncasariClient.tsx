"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pozitie   { tip: string; denumire: string; suma: number; fondId?: string; }
interface AvansItem { tip?: string; denumire?: string; suma: number; }

interface IncasareRow {
  id:             string;
  nrApartament:   string;
  proprietarNume: string | null;
  serie:          string | null;
  numarDocument:  number | null;
  tipDocument:    string;
  tipPlata:       string;
  data:           string;
  sumaIncasata:   number;
  observatii:     string | null;
  pozitii:        Pozitie[];
  avans:          AvansItem[] | { suma: number } | null;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (v: number) => v.toFixed(2);

const TIP_DOC_LABEL: Record<string, string> = {
  chitanta:            "Chitanță",
  dispozitie_incasare: "Dispoziție de încasare",
  proces_verbal:       "Proces verbal",
  extras_cont:         "Extras de cont",
};

const TIP_PLATA_LABEL: Record<string, string> = {
  casa: "Casă", banca: "Bancă", online: "Online",
};

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

// ─── Chitanță PDF (per rând) ──────────────────────────────────────────────────

function buildChitantaDoc(inc: IncasareRow, asoc: AsocInfo | null): any {
  const adresa  = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const docLabel = TIP_DOC_LABEL[inc.tipDocument] ?? inc.tipDocument;
  const docNr    = inc.serie && inc.numarDocument != null ? ` ${inc.serie} ${inc.numarDocument}` : "";
  const pozitiiLines: any[] = inc.pozitii.map(p => ({
    columns: [{ text: p.denumire, fontSize: 9 }, { text: `${fmt2(p.suma)} lei`, fontSize: 9, alignment: "right" }],
    margin: [0, 1, 0, 1],
  }));
  if (Array.isArray(inc.avans)) {
    for (const a of inc.avans) {
      pozitiiLines.push({ columns: [{ text: a.denumire ?? "Avans", fontSize: 9 }, { text: `${fmt2(a.suma)} lei`, fontSize: 9, alignment: "right" }], margin: [0, 1, 0, 1] });
    }
  } else if (inc.avans && (inc.avans as any).suma > 0) {
    pozitiiLines.push({ columns: [{ text: "Avans", fontSize: 9 }, { text: `${fmt2((inc.avans as any).suma)} lei`, fontSize: 9, alignment: "right" }], margin: [0, 1, 0, 1] });
  }
  return {
    pageSize: "A5", pageOrientation: "landscape", pageMargins: [30, 28, 30, 28],
    content: [
      { text: asoc?.name ?? "", bold: true, fontSize: 13, margin: [0, 0, 0, 2] },
      adresa ? { text: adresa, fontSize: 8.5, color: "#444", margin: [0, 0, 0, 1] } : {},
      asoc?.cui ? { text: `CUI: ${asoc.cui}`, fontSize: 8, color: "#666" } : {},
      { canvas: [{ type: "line", x1: 0, y1: 4, x2: 530, y2: 4, lineWidth: 1, lineColor: "#aaa" }], margin: [0, 6, 0, 10] },
      { text: `${docLabel}${docNr}`, fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 4] },
      { text: `Data: ${roDate(inc.data)}`, fontSize: 9, alignment: "center", color: "#555", margin: [0, 0, 0, 10] },
      { columns: [{ text: "Apartament:", bold: true, fontSize: 10 }, { text: `Nr. ${inc.nrApartament}`, bold: true, fontSize: 12, alignment: "right" }] },
      inc.proprietarNume ? { text: inc.proprietarNume, fontSize: 9, color: "#555", margin: [0, 2, 0, 6] } : { margin: [0, 0, 0, 6] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 530, y2: 0, lineWidth: 0.5, lineColor: "#ccc" }], margin: [0, 0, 0, 6] },
      ...pozitiiLines,
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 530, y2: 0, lineWidth: 0.5, lineColor: "#ccc" }], margin: [0, 6, 0, 6] },
      { columns: [{ text: "TOTAL ÎNCASAT:", bold: true, fontSize: 11 }, { text: `${fmt2(inc.sumaIncasata)} lei`, bold: true, fontSize: 13, alignment: "right" }] },
      { columns: [
          { text: `Administrator,\n\n\n${asoc?.adminName ?? ""}`, fontSize: 9, color: "#555", alignment: "center" },
          { text: "Casier,\n\n\n", fontSize: 9, color: "#555", alignment: "center" },
          { text: "Am primit,\n\n\n", fontSize: 9, color: "#555", alignment: "center" },
        ], margin: [0, 20, 0, 0] },
    ],
    defaultStyle: { font: "Roboto" },
  };
}

async function handlePrint(inc: IncasareRow, asoc: AsocInfo | null) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;
  (pdfMake.default ?? pdfMake).createPdf(buildChitantaDoc(inc, asoc)).print();
}

async function handlePdf(inc: IncasareRow, asoc: AsocInfo | null) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;
  const docLabel = inc.serie && inc.numarDocument != null ? `${inc.serie}${inc.numarDocument}` : "incasare";
  (pdfMake.default ?? pdfMake).createPdf(buildChitantaDoc(inc, asoc)).download(`chitanta_ap${inc.nrApartament}_${docLabel}.pdf`);
}

// ─── Registru PDF (toate rândurile) ──────────────────────────────────────────

async function generateRegistruPdf(asoc: AsocInfo | null, rows: IncasareRow[], dataStart: string, dataEnd: string) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const totalIncasat = rows.reduce((s, r) => s + r.sumaIncasata, 0);
  const adresa  = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const tableBody: any[][] = [
    [
      { text: "Nr.\ncrt.", style: "th", alignment: "center" },
      { text: "Data", style: "th", alignment: "center" },
      { text: "Seria și nr.\nchitanță", style: "th", alignment: "center" },
      { text: "Ap.", style: "th", alignment: "center" },
      { text: "Detalii încasare", style: "th" },
      { text: "Valoare\n(lei)", style: "th", alignment: "right" },
    ],
    ...rows.map((row, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(row.data), alignment: "center", fontSize: 8 },
      { text: row.serie && row.numarDocument != null ? `${row.serie} ${row.numarDocument}` : "—", alignment: "center", fontSize: 8 },
      { text: row.nrApartament, bold: true, alignment: "center", fontSize: 9 },
      {
        stack: [
          { text: ceReprezinta(row), fontSize: 8 },
          ...(row.proprietarNume ? [{ text: row.proprietarNume, fontSize: 7.5, color: "#555", margin: [0, 2, 0, 0], italics: true }] : []),
        ],
      },
      { text: fmt2(row.sumaIncasata), alignment: "right", fontSize: 8 },
    ]),
    [
      { text: `TOTAL (${rows.length} chitanțe)`, colSpan: 5, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] },
      {}, {}, {}, {},
      { text: fmt2(totalIncasat), alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const doc: any = {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [30, 40, 30, 70],
    content: [
      { columns: [
        { stack: [
          { text: asoc?.name ?? "", bold: true, fontSize: 13 },
          adresa  ? { text: adresa,  fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
          contact ? { text: contact, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
        ], width: "*" },
        { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: `${roDate(dataStart)} — ${roDate(dataEnd)}`, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "REGISTRU ÎNCASĂRI", style: "title", alignment: "center", margin: [0, 14, 0, 14] },
      {
        table: { headerRows: 1, widths: [22, 48, 55, 24, "*", 48], body: tableBody },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null,
          hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999",
          paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },
    ],
    footer: (_p: number, _n: number) => ({
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
  pm.createPdf(doc).download(`registru-incasari-${dataStart}-${dataEnd}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RaportIncasariClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc,       setAsoc]       = useState<AsocInfo | null>(null);
  const [dataStart,  setDataStart]  = useState(defaultStart);
  const [dataEnd,    setDataEnd]    = useState(defaultEnd);
  const [rows,       setRows]       = useState<IncasareRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Edit
  const [editRow,     setEditRow]     = useState<IncasareRow | null>(null);
  const [editData,    setEditData]    = useState("");
  const [editSerie,   setEditSerie]   = useState("");
  const [editNr,      setEditNr]      = useState("");
  const [editTipDoc,  setEditTipDoc]  = useState("chitanta");
  const [editTipPlata,setEditTipPlata]= useState("casa");
  const [editObs,     setEditObs]     = useState("");
  const [editSaving,  setEditSaving]  = useState(false);
  const [editErr,     setEditErr]     = useState<string | null>(null);

  // Delete
  const [delRow,   setDelRow]   = useState<IncasareRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delErr,   setDelErr]   = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(d => setAsoc(d)).catch(() => {});
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

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(row: IncasareRow) {
    setEditRow(row);
    setEditData(new Date(row.data).toISOString().slice(0, 10));
    setEditSerie(row.serie ?? "");
    setEditNr(row.numarDocument != null ? String(row.numarDocument) : "");
    setEditTipDoc(row.tipDocument);
    setEditTipPlata(row.tipPlata);
    setEditObs(row.observatii ?? "");
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true); setEditErr(null);
    try {
      const res = await fetch(`/api/incasari/${editRow.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data:          editData,
          serie:         editSerie,
          numarDocument: editNr ? parseInt(editNr) : undefined,
          tipDocument:   editTipDoc,
          tipPlata:      editTipPlata,
          observatii:    editObs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setEditRow(null);
      fetchData();
    } catch (e: any) { setEditErr(e.message); }
    finally { setEditSaving(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!delRow) return;
    setDeleting(true); setDelErr(null);
    try {
      const res  = await fetch(`/api/incasari/${delRow.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setDelRow(null);
      fetchData();
    } catch (e: any) { setDelErr(e.message); }
    finally { setDeleting(false); }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalIncasat = rows.reduce((s, r) => s + r.sumaIncasata, 0);

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 15mm 12mm 25mm 12mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; } }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru încasări</h1>
            <p className="page-sub">Chitanțe emise în perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!rows.length}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={async () => {
              if (!rows.length || !asociatieId) return;
              setPdfLoading(true); setError(null);
              try {
                const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
                await generateRegistruPdf(fresh, rows, dataStart, dataEnd);
              } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
              finally { setPdfLoading(false); }
            }} disabled={!rows.length || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1.5rem" }}>
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

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {rows.length > 0 && (
        <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Chitanțe</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{rows.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: "0.25rem" }}>Total încasat</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">🧾</span>
          <div className="empty-state__title">Nicio încasare în perioada selectată</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>Nr.</th>
                <th>Data</th>
                <th>Chitanță</th>
                <th style={{ width: 44, textAlign: "center" }}>Ap.</th>
                <th>Detalii încasare</th>
                <th style={{ textAlign: "right" }}>Valoare (lei)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(row.data)}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#a78bfa" }}>
                    {row.serie && row.numarDocument != null ? `${row.serie} ${row.numarDocument}` : "—"}
                  </td>
                  <td style={{ fontWeight: 700, color: "#a78bfa", textAlign: "center" }}>{row.nrApartament}</td>
                  <td style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>
                    {ceReprezinta(row)}
                    {row.proprietarNume && (
                      <span style={{ display: "block", color: "#64748b", fontSize: "0.75rem", marginTop: 2 }}>{row.proprietarNume}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(row.sumaIncasata)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <button className="btn-action" title="Editează" onClick={() => openEdit(row)}>✎</button>
                      <button className="btn-action" title="Printează chitanța" onClick={() => handlePrint(row, asoc)}>🖨</button>
                      <button className="btn-action" title="Descarcă chitanță PDF" onClick={() => handlePdf(row, asoc)}>PDF</button>
                      <button className="btn-action btn-action--danger" title="Șterge" onClick={() => { setDelRow(row); setDelErr(null); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>Total {roDate(dataStart)} — {roDate(dataEnd)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(totalIncasat)} lei</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Modal Editează ────────────────────────────────────────────────── */}
      {editRow && (
        <div className="modal-overlay" onClick={() => !editSaving && setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Editează încasare</h2>
              <button className="modal__close" onClick={() => setEditRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom: "0.75rem", fontSize: "0.82rem", color: "#64748b" }}>
                Ap. <strong style={{ color: "#e2e8f0" }}>{editRow.nrApartament}</strong>
                {editRow.proprietarNume && <> — {editRow.proprietarNume}</>}
              </div>
              {editErr && <div className="wizard__error" style={{ marginBottom: "0.75rem" }}>{editErr}</div>}
              <div className="form-grid form-grid--2">
                <div className="form-field">
                  <label className="form-field__label">Data</label>
                  <RoDate value={editData} onChange={v => setEditData(v)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Tip document</label>
                  <select className="input" value={editTipDoc} onChange={e => setEditTipDoc(e.target.value)}>
                    <option value="chitanta">Chitanță</option>
                    <option value="dispozitie_incasare">Dispoziție de încasare</option>
                    <option value="proces_verbal">Proces verbal</option>
                    <option value="extras_cont">Extras de cont</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Serie</label>
                  <input type="text" className="input" value={editSerie} onChange={e => setEditSerie(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Nr. document</label>
                  <input type="number" className="input" min="1" step="1" value={editNr} onChange={e => setEditNr(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Metodă plată</label>
                  <select className="input" value={editTipPlata} onChange={e => setEditTipPlata(e.target.value)}>
                    <option value="casa">Casă</option>
                    <option value="banca">Bancă</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Observații</label>
                  <input type="text" className="input" value={editObs} onChange={e => setEditObs(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={editSaving}>Anulează</button>
              <button className="btn btn--primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? "Se salvează..." : "Salvează"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmare ștergere ─────────────────────────────────────── */}
      {delRow && (
        <div className="modal-overlay" onClick={() => !deleting && setDelRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Șterge încasare</h2>
              <button className="modal__close" onClick={() => setDelRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                Ștergi chitanța{" "}
                {delRow.serie && delRow.numarDocument != null && <strong style={{ color: "#a78bfa" }}>{delRow.serie} {delRow.numarDocument}</strong>}
                {" "}— Ap. <strong>{delRow.nrApartament}</strong> din <strong>{roDate(delRow.data)}</strong>?
              </p>
              {delErr && <div className="wizard__error" style={{ marginTop: "0.75rem" }}>{delErr}</div>}
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setDelRow(null)} disabled={deleting}>Anulează</button>
              <button className="btn btn--primary"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                onClick={confirmDelete} disabled={deleting}>{deleting ? "Se șterge..." : "Șterge"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Print zone */}
      <div id="print-zone">
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "10pt" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: "bold" }}>{asoc?.name ?? ""}</div>
            {(asoc?.address || asoc?.city) && <div style={{ fontSize: "9pt", color: "#333" }}>{[asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ")}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9pt", color: "#666" }}>Perioada</div>
            <div style={{ fontSize: "10pt", fontWeight: "bold" }}>{roDate(dataStart)} — {roDate(dataEnd)}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 12pt" }}>Registru încasări</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>{["Nr.\ncrt.", "Data", "Seria și nr.\nchitanță", "Ap.", "Detalii încasare", "Valoare\n(lei)"].map((h, i) => (
              <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i === 5 ? "right" : i <= 3 ? "center" : "left", fontWeight: "bold", whiteSpace: "pre-line" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>{roDate(row.data)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center", whiteSpace: "nowrap" }}>
                  {row.serie && row.numarDocument != null ? `${row.serie} ${row.numarDocument}` : "—"}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>
                  <b>{row.nrApartament}</b>
                  {row.proprietarNume && <span style={{ display: "block", fontSize: "7.5pt", color: "#444", fontWeight: "normal" }}>{row.proprietarNume}</span>}
                </td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{ceReprezinta(row)}</td>
                <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right", whiteSpace: "nowrap" }}>{fmt2(row.sumaIncasata)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL ({rows.length} chitanțe)</td>
              <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(totalIncasat)}</td>
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
