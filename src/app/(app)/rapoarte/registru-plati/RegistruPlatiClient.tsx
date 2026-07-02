"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import { useAccess } from "@/lib/AccessContext";
import RoDate from "@/components/RoDate";

interface PlataRow {
  id:           string;
  data:         string;
  document:     string;
  furnizor:     string;
  categorie:    string | null;
  metoda:       string;
  suma:         number;
  notes:        string | null;
  idTranzactie: string | null;
  serieCh:      string | null;
  nrCh:         number | null;
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
  const { isAdmin } = useAccess();

  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [metoda, setMetoda] = useState<"" | "casa" | "banca">("");
  const [rows, setRows] = useState<PlataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit
  const [editRow,      setEditRow]      = useState<PlataRow | null>(null);
  const [editData,     setEditData]     = useState("");
  const [editSuma,     setEditSuma]     = useState("");
  const [editMetoda,   setEditMetoda]   = useState("casa");
  const [editNotes,    setEditNotes]    = useState("");
  const [editTranz,    setEditTranz]    = useState("");
  const [editSerieCh,  setEditSerieCh]  = useState("");
  const [editNrCh,     setEditNrCh]     = useState("");
  const [editSaving,   setEditSaving]   = useState(false);
  const [editErr,      setEditErr]      = useState<string | null>(null);

  // Delete
  const [delRow,   setDelRow]   = useState<PlataRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delErr,   setDelErr]   = useState<string | null>(null);

  // Adaugă plată (avans liber la furnizor)
  const [showAdd,      setShowAdd]      = useState(false);
  const [furnizori,    setFurnizori]    = useState<{ id: string; nume: string }[]>([]);
  const [addFurnizorId, setAddFurnizorId] = useState("");
  const [addData,      setAddData]      = useState("");
  const [addSuma,      setAddSuma]      = useState("");
  const [addMetoda,    setAddMetoda]    = useState("banca");
  const [addNotes,     setAddNotes]     = useState("");
  const [addTranz,     setAddTranz]     = useState("");
  const [addSerieCh,   setAddSerieCh]   = useState("");
  const [addNrCh,      setAddNrCh]      = useState("");
  const [addSaving,    setAddSaving]    = useState(false);
  const [addErr,       setAddErr]       = useState<string | null>(null);
  const [avansSold,    setAvansSold]    = useState<number | null>(null);

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

  const filtered   = metoda ? rows.filter(r => r.metoda === metoda) : rows;
  const total      = filtered.reduce((s, r) => s + r.suma, 0);
  const totalCasa  = rows.filter(r => r.metoda === "casa").reduce((s, r) => s + r.suma, 0);
  const totalBanca = rows.filter(r => r.metoda !== "casa").reduce((s, r) => s + r.suma, 0);

  async function handleDownloadPdf() {
    if (!filtered.length || !asociatieId) return;
    setPdfLoading(true); setError(null);
    try {
      const res = await fetch(`/api/asociatii/${asociatieId}`);
      const freshAsoc: AsocInfo = await res.json();
      await generateAndDownloadPdf(freshAsoc, filtered, dataStart, dataEnd);
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  function handlePrint() { window.print(); }

  function openEdit(row: PlataRow) {
    setEditRow(row);
    setEditData(new Date(row.data).toISOString().slice(0, 10));
    setEditSuma(row.suma.toFixed(2));
    setEditMetoda(row.metoda);
    setEditNotes(row.notes ?? "");
    setEditTranz(row.idTranzactie ?? "");
    setEditSerieCh(row.serieCh ?? "");
    setEditNrCh(row.nrCh != null ? String(row.nrCh) : "");
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true); setEditErr(null);
    try {
      const body: Record<string, any> = {
        data:   editData,
        suma:   parseFloat(editSuma),
        metoda: editMetoda,
        notes:  editNotes || null,
      };
      if (editMetoda === "banca") body.idTranzactie = editTranz || null;
      if (editMetoda === "casa")  { body.serieCh = editSerieCh || null; body.nrCh = editNrCh ? parseInt(editNrCh) : null; }
      const res  = await fetch(`/api/plati/${editRow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setEditRow(null);
      fetchData();
    } catch (e: any) { setEditErr(e.message); }
    finally { setEditSaving(false); }
  }

  function openAdd() {
    setAddFurnizorId(""); setAddData(new Date().toISOString().slice(0, 10));
    setAddSuma(""); setAddMetoda("banca"); setAddNotes("");
    setAddTranz(""); setAddSerieCh(""); setAddNrCh("");
    setAvansSold(null); setAddErr(null);
    setShowAdd(true);
    if (asociatieId) {
      fetch(`/api/furnizori?asociatieId=${asociatieId}`).then(r => r.json()).then(setFurnizori).catch(() => setFurnizori([]));
    }
  }

  useEffect(() => {
    if (!showAdd || !asociatieId || !addFurnizorId) { setAvansSold(null); return; }
    fetch(`/api/avans-furnizor?asociatieId=${asociatieId}&furnizorId=${addFurnizorId}`)
      .then(r => r.json()).then(d => setAvansSold(d.sold ?? 0)).catch(() => setAvansSold(null));
  }, [showAdd, asociatieId, addFurnizorId]);

  async function saveAdd() {
    if (!asociatieId || !addFurnizorId) { setAddErr("Selectează un furnizor."); return; }
    setAddSaving(true); setAddErr(null);
    try {
      const body: Record<string, any> = {
        asociatieId,
        suma:   parseFloat(addSuma),
        metoda: addMetoda,
        data:   addData,
        notes:  addNotes || null,
      };
      if (addMetoda === "banca") body.idTranzactie = addTranz || null;
      if (addMetoda === "casa")  { body.serieCh = addSerieCh || null; body.nrCh = addNrCh ? parseInt(addNrCh) : null; }
      const res  = await fetch(`/api/furnizori/${addFurnizorId}/plati`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setShowAdd(false);
      fetchData();
    } catch (e: any) { setAddErr(e.message); }
    finally { setAddSaving(false); }
  }

  async function confirmDelete() {
    if (!delRow) return;
    setDeleting(true); setDelErr(null);
    try {
      const res  = await fetch(`/api/plati/${delRow.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setDelRow(null);
      fetchData();
    } catch (e: any) { setDelErr(e.message); }
    finally { setDeleting(false); }
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
            <h1 className="page-title">Registru plăți</h1>
            <p className="page-sub">Plăți către furnizori în perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {isAdmin && (
              <button className="btn btn--primary" onClick={openAdd}>＋ Adaugă plată</button>
            )}
            <button className="btn btn--secondary" onClick={handlePrint}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={filtered.length === 0 || pdfLoading}>
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
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Metodă</label>
            <select className="input" value={metoda} onChange={e => setMetoda(e.target.value as any)}>
              <option value="">Toate</option>
              <option value="casa">Casă</option>
              <option value="banca">Bancă</option>
            </select>
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

      {filtered.length === 0 && !loading ? (
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
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
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
                  <td onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                        <button className="btn-action" title="Editează" onClick={() => openEdit(r)}>✎</button>
                        <button className="btn-action btn-action--danger" title="Șterge" onClick={() => { setDelRow(r); setDelErr(null); }}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>
                  Total {roDate(dataStart)} — {roDate(dataEnd)}{metoda ? ` · ${metodaLabel(metoda)}` : ""}
                </td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(total)} lei</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Modal Adaugă plată (avans furnizor) ──────────────────────────── */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "480px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Adaugă plată</h2>
              <button className="modal__close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="modal__body">
              {addErr && <div className="wizard__error" style={{ marginBottom: "0.75rem" }}>{addErr}</div>}
              <div className="form-field">
                <label className="form-field__label">Furnizor</label>
                <select className="input" value={addFurnizorId} onChange={e => setAddFurnizorId(e.target.value)}>
                  <option value="">— Selectează furnizor —</option>
                  {furnizori.map(f => <option key={f.id} value={f.id}>{f.nume}</option>)}
                </select>
              </div>
              {addFurnizorId && avansSold !== null && (
                <div style={{ fontSize: "0.8rem", color: "#64748b", margin: "0.5rem 0 0.75rem" }}>
                  Sold avans curent: <strong style={{ color: "#e2e8f0" }}>{fmt2(avansSold)} lei</strong>
                </div>
              )}
              <div className="form-grid form-grid--2" style={{ marginTop: "0.75rem" }}>
                <div className="form-field">
                  <label className="form-field__label">Data</label>
                  <RoDate value={addData} onChange={v => setAddData(v)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Suma (lei)</label>
                  <input type="number" className="input" step="0.01" min="0.01" value={addSuma} onChange={e => setAddSuma(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Metodă plată</label>
                  <select className="input" value={addMetoda} onChange={e => setAddMetoda(e.target.value)}>
                    <option value="casa">Casă</option>
                    <option value="banca">Bancă</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Observații</label>
                  <input type="text" className="input" value={addNotes} onChange={e => setAddNotes(e.target.value)} />
                </div>
                {addMetoda === "banca" && (
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-field__label">ID Tranzacție</label>
                    <input type="text" className="input" value={addTranz} onChange={e => setAddTranz(e.target.value)} />
                  </div>
                )}
                {addMetoda === "casa" && (<>
                  <div className="form-field">
                    <label className="form-field__label">Serie chitanță</label>
                    <input type="text" className="input" value={addSerieCh} onChange={e => setAddSerieCh(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Nr. chitanță</label>
                    <input type="number" className="input" min="1" step="1" value={addNrCh} onChange={e => setAddNrCh(e.target.value)} />
                  </div>
                </>)}
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.5rem" }}>
                Suma stinge întâi facturile restante ale furnizorului; ce rămâne devine avans disponibil pentru facturile viitoare.
              </p>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setShowAdd(false)} disabled={addSaving}>Anulează</button>
              <button className="btn btn--primary" onClick={saveAdd} disabled={addSaving || !addFurnizorId || !addSuma}>
                {addSaving ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editează ─────────────────────────────────────────────── */}
      {editRow && (
        <div className="modal-overlay" onClick={() => !editSaving && setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Editează plată</h2>
              <button className="modal__close" onClick={() => setEditRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom: "0.75rem", fontSize: "0.82rem", color: "#64748b" }}>
                <strong style={{ color: "#e2e8f0" }}>{editRow.furnizor}</strong>
                {" · "}{editRow.document}
              </div>
              {editErr && <div className="wizard__error" style={{ marginBottom: "0.75rem" }}>{editErr}</div>}
              <div className="form-grid form-grid--2">
                <div className="form-field">
                  <label className="form-field__label">Data</label>
                  <RoDate value={editData} onChange={v => setEditData(v)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Suma (lei)</label>
                  <input type="number" className="input" step="0.01" min="0.01" value={editSuma} onChange={e => setEditSuma(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Metodă plată</label>
                  <select className="input" value={editMetoda} onChange={e => setEditMetoda(e.target.value)}>
                    <option value="casa">Casă</option>
                    <option value="banca">Bancă</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Observații</label>
                  <input type="text" className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>
                {editMetoda === "banca" && (
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-field__label">ID Tranzacție</label>
                    <input type="text" className="input" value={editTranz} onChange={e => setEditTranz(e.target.value)} />
                  </div>
                )}
                {editMetoda === "casa" && (<>
                  <div className="form-field">
                    <label className="form-field__label">Serie chitanță</label>
                    <input type="text" className="input" value={editSerieCh} onChange={e => setEditSerieCh(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Nr. chitanță</label>
                    <input type="number" className="input" min="1" step="1" value={editNrCh} onChange={e => setEditNrCh(e.target.value)} />
                  </div>
                </>)}
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={editSaving}>Anulează</button>
              <button className="btn btn--primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? "Se salvează..." : "Salvează"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmare ștergere ────────────────────────────────────── */}
      {delRow && (
        <div className="modal-overlay" onClick={() => !deleting && setDelRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Șterge plată</h2>
              <button className="modal__close" onClick={() => setDelRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                Ștergi plata de <strong style={{ color: "#f87171" }}>{fmt2(delRow.suma)} lei</strong> către{" "}
                <strong style={{ color: "#e2e8f0" }}>{delRow.furnizor}</strong> din <strong>{roDate(delRow.data)}</strong>?
              </p>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.5rem" }}>
                Dacă plata a generat un avans care nu a fost utilizat, acesta va fi anulat automat.
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
