"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

interface Operatiune {
  id:            string;
  data:          string;
  fel:           "contributie" | "transfer" | "plata";
  document:      string;
  detalii:       string;
  intrare:       number;
  iesire:        number;
  apartamentId?: string;
  nrApartament?: string;
}

interface DetaliatItem {
  apartamentId:       string;
  numar:              string;
  scara:              string | null;
  proprietar:         string;
  sold:               number;
  restanta:           number;
  contributiiPerioda: number;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
  fonduri?: { id: string; name: string }[];
}

interface ApartamentItem {
  id: string;
  numar: string;
  scara: string | null;
  proprietar: string;
}

const fmt2 = (v: number) => v.toFixed(2);

const felLabel = (fel: Operatiune["fel"]) => fel === "contributie" ? "Contribuție" : fel === "plata" ? "Plată" : "Transfer";
const felColor = (fel: Operatiune["fel"]) => fel === "contributie" ? "#4ade80" : fel === "plata" ? "#f87171" : "#22d3ee";
const felColorPdf = (fel: Operatiune["fel"]) => fel === "contributie" ? "#1a7f37" : fel === "plata" ? "#b91c1c" : "#0e7490";

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function withRunningBalance(soldInitial: number, ops: Operatiune[]) {
  let sold = soldInitial;
  return ops.map(op => { sold += op.intrare - op.iesire; return { ...op, sold }; });
}

// PDF pentru modul detaliat (tabel sumar per apartament)
async function generatePdfDetaliat(
  asoc: AsocInfo | null, fondName: string,
  data: DetaliatItem[], dataStart: string, dataEnd: string,
) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const adresa  = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const totalSold     = data.reduce((s, a) => s + a.sold, 0);
  const totalRestanta = data.reduce((s, a) => s + a.restanta, 0);
  const totalContrib  = data.reduce((s, a) => s + a.contributiiPerioda, 0);

  const tableBody: any[][] = [
    [
      { text: "Nr.", style: "th", alignment: "center" },
      { text: "Ap.", style: "th", alignment: "center" },
      { text: "Proprietar", style: "th" },
      { text: "Sold\n(lei)", style: "th", alignment: "right" },
      { text: "Restanță\n(lei)", style: "th", alignment: "right" },
      { text: `Contribuții\n${roDate(dataStart)}–${roDate(dataEnd)}`, style: "th", alignment: "right" },
    ],
    ...data.map((a, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: `${a.numar}${a.scara ? `/${a.scara}` : ""}`, alignment: "center", fontSize: 8 },
      { text: a.proprietar, fontSize: 8 },
      { text: fmt2(a.sold),    alignment: "right", fontSize: 8 },
      { text: fmt2(a.restanta), alignment: "right", fontSize: 8, color: a.restanta > 0 ? "#c0392b" : undefined },
      { text: a.contributiiPerioda ? fmt2(a.contributiiPerioda) : "—", alignment: "right", fontSize: 8 },
    ]),
    [
      { text: "TOTAL", colSpan: 3, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {},
      { text: fmt2(totalSold),    alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(totalRestanta), alignment: "right", bold: true, fontSize: 9, color: totalRestanta > 0 ? "#c0392b" : undefined },
      { text: fmt2(totalContrib), alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const docDefinition: any = {
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
      { text: "SITUAȚIE FOND — TOATE APARTAMENTELE", style: "title", alignment: "center", margin: [0, 14, 0, 4] },
      { text: fondName, alignment: "center", fontSize: 11, bold: true, color: "#333", margin: [0, 0, 0, 12] },
      {
        table: { headerRows: 1, widths: [20, 30, "*", 55, 55, 70], body: tableBody },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 1 ? "#F5F5F5" : null,
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
    styles: { title: { fontSize: 13, bold: true, characterSpacing: 1 }, th: { bold: true, fontSize: 9 } },
    defaultStyle: { font: "Roboto" },
  };

  const safe = fondName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(`situatie-fond-${safe}-detaliat-${dataStart}-${dataEnd}.pdf`);
}

// PDF pentru modul normal / per apartament
async function generatePdfNormal(
  asoc: AsocInfo | null, fondName: string, soldInitial: number,
  ops: Operatiune[], dataStart: string, dataEnd: string,
  apartamentLabel?: string,
) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

  const rows = withRunningBalance(soldInitial, ops);
  const totalIntrari = ops.reduce((s, o) => s + o.intrare, 0);
  const totalIesiri  = ops.reduce((s, o) => s + o.iesire, 0);
  const soldFinal    = soldInitial + totalIntrari - totalIesiri;

  const adresa  = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [asoc?.cui ? `CUI: ${asoc.cui}` : null, asoc?.phone ? `Tel: ${asoc.phone}` : null, asoc?.email ? `Email: ${asoc.email}` : null].filter(Boolean).join("   |   ");

  const tableBody: any[][] = [
    [
      { text: "Nr.\ncrt.", style: "th", alignment: "center" },
      { text: "Data", style: "th", alignment: "center" },
      { text: "Document", style: "th", alignment: "center" },
      { text: "Explicație", style: "th" },
      { text: "Intrări\n(lei)", style: "th", alignment: "right" },
      { text: "Ieșiri\n(lei)", style: "th", alignment: "right" },
      { text: "Sold\n(lei)", style: "th", alignment: "right" },
    ],
    [
      { text: "", fontSize: 8 }, { text: roDate(dataStart), alignment: "center", fontSize: 8 }, { text: "—", alignment: "center", fontSize: 8 },
      { text: "Sold inițial", italics: true, fontSize: 8 }, { text: "", fontSize: 8 }, { text: "", fontSize: 8 },
      { text: fmt2(soldInitial), alignment: "right", bold: true, fontSize: 8 },
    ],
    ...rows.map((row, idx) => [
      { text: String(idx + 1), alignment: "center", fontSize: 8 },
      { text: roDate(row.data), alignment: "center", fontSize: 8 },
      { text: row.document, alignment: "center", fontSize: 8 },
      { stack: [{ text: felLabel(row.fel), fontSize: 7, color: felColorPdf(row.fel), bold: true }, { text: row.detalii, fontSize: 8, margin: [0, 1, 0, 0] }] },
      { text: row.intrare ? fmt2(row.intrare) : "", alignment: "right", fontSize: 8 },
      { text: row.iesire  ? fmt2(row.iesire)  : "", alignment: "right", fontSize: 8 },
      { text: fmt2(row.sold), alignment: "right", fontSize: 8 },
    ]),
    [
      { text: "TOTAL", colSpan: 4, alignment: "right", bold: true, fontSize: 9, border: [true, true, false, true] }, {}, {}, {},
      { text: fmt2(totalIntrari), alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(totalIesiri),  alignment: "right", bold: true, fontSize: 9 },
      { text: fmt2(soldFinal),    alignment: "right", bold: true, fontSize: 9 },
    ],
  ];

  const docDefinition: any = {
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
      { text: "REGISTRU FOND", style: "title", alignment: "center", margin: [0, 14, 0, 4] },
      { text: fondName, alignment: "center", fontSize: 11, bold: true, color: "#333", margin: [0, 0, 0, apartamentLabel ? 4 : 12] },
      ...(apartamentLabel ? [{ text: apartamentLabel, alignment: "center" as const, fontSize: 10, color: "#444", margin: [0, 0, 0, 12] }] : []),
      {
        table: { headerRows: 1, widths: [22, 48, 55, "*", 50, 50, 55], body: tableBody },
        layout: {
          fillColor: (r: number) => r === 0 ? "#DDDDDD" : r === 1 ? "#EFEFEF" : r % 2 === 1 ? "#F5F5F5" : null,
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

  const safe  = fondName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const apSafe = apartamentLabel ? "-" + apartamentLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() : "";
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(docDefinition).download(`registru-fond-${safe}${apSafe}-${dataStart}-${dataEnd}.pdf`);
}

export default function RegistruFonduriClient({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const { activeId: asociatieId } = useAsociatie();

  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [fonduri, setFonduri] = useState<{ id: string; name: string }[]>([]);
  const [fondId, setFondId] = useState("");
  const [apartamente, setApartamente] = useState<ApartamentItem[]>([]);
  const [apartamentId, setApartamentId] = useState("");
  const [dataStart, setDataStart] = useState(defaultStart);
  const [dataEnd, setDataEnd] = useState(defaultEnd);
  const [fondName, setFondName] = useState("");
  // mod normal
  const [soldInitial, setSoldInitial] = useState(0);
  const [soldAp, setSoldAp] = useState<number | null>(null);
  const [restantaAp, setRestantaAp] = useState<number | null>(null);
  const [ops, setOps] = useState<Operatiune[]>([]);
  // mod detaliat
  const [detaliatData, setDetaliatData] = useState<DetaliatItem[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asociatieId) {
      setAsoc(null); setFonduri([]); setFondId(""); setApartamente([]); setApartamentId(""); return;
    }
    Promise.all([
      fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()),
      fetch(`/api/asociatii/${asociatieId}/apartamente`).then(r => r.json()),
    ]).then(([d, apsResp]: [AsocInfo, { apartamente: ApartamentItem[] }]) => {
      setAsoc(d);
      const f = Array.isArray(d.fonduri) ? d.fonduri : [];
      setFonduri(f);
      setFondId(prev => (prev && f.some(x => x.id === prev)) ? prev : (f[0]?.id ?? ""));
      setApartamente(Array.isArray(apsResp?.apartamente) ? apsResp.apartamente : []);
      setApartamentId("");
    }).catch(() => { setFonduri([]); setFondId(""); setApartamente([]); setApartamentId(""); });
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId || !fondId) { setOps([]); setSoldInitial(0); setDetaliatData(null); return; }
    setLoading(true); setError(null);

    try {
      if (apartamentId === "detaliat") {
        // ── Mod detaliat: sumar per apartament ──
        const params = new URLSearchParams({ asociatieId, fondId, dataStart, dataEnd, detaliat: "true" });
        const res  = await fetch(`/api/rapoarte/registru-fonduri?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Eroare server");
        setFondName(json.fondName ?? "");
        setDetaliatData(json.detaliat ?? []);
        setOps([]); setSoldInitial(0); setSoldAp(null); setRestantaAp(null);
      } else {
        // ── Mod normal / per apartament ──
        setDetaliatData(null);
        const params = new URLSearchParams({ asociatieId, fondId, dataStart, dataEnd });
        if (apartamentId) params.set("apartamentId", apartamentId);
        const res  = await fetch(`/api/rapoarte/registru-fonduri?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Eroare server");
        setFondName(json.fondName ?? "");
        setSoldInitial(json.soldInitial ?? 0);
        setSoldAp(json.soldAp ?? null);
        setRestantaAp(json.restantaAp ?? null);
        setOps(json.operatiuni ?? []);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, fondId, apartamentId, dataStart, dataEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = withRunningBalance(soldInitial, ops);
  const totalIntrari = ops.reduce((s, o) => s + o.intrare, 0);
  const totalIesiri  = ops.reduce((s, o) => s + o.iesire, 0);
  const soldFinal    = soldInitial + totalIntrari - totalIesiri;
  const numeFond     = fondName || fonduri.find(f => f.id === fondId)?.name || "";

  const apartamentLabel = (() => {
    if (!apartamentId || apartamentId === "detaliat") return "";
    const a = apartamente.find(x => x.id === apartamentId);
    if (!a) return "";
    return `Ap. ${a.numar}${a.scara ? `/${a.scara}` : ""}${a.proprietar ? ` — ${a.proprietar}` : ""}`;
  })();

  async function handleDownloadPdf() {
    if (!asociatieId || !fondId) return;
    setPdfLoading(true); setError(null);
    try {
      const freshAsoc: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
      if (detaliatData) {
        await generatePdfDetaliat(freshAsoc, numeFond, detaliatData, dataStart, dataEnd);
      } else {
        await generatePdfNormal(freshAsoc, numeFond, soldInitial, ops, dataStart, dataEnd, apartamentLabel || undefined);
      }
    } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  function handlePrint() { window.print(); }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  if (fonduri.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-header"><div><h1 className="page-title">Registru fonduri</h1><p className="page-sub">Mișcările fondului selectat</p></div></div>
        <div className="empty-state">
          <span className="empty-state__icon">💼</span>
          <div className="empty-state__title">Niciun fond activ configurat</div>
          <p className="page-sub" style={{ marginTop: "0.5rem" }}>Activează fonduri în inițializarea asociației (pasul Fonduri).</p>
        </div>
      </div>
    );
  }

  // Totaluri pentru modul detaliat (sumar)
  const detTotalSold     = detaliatData?.reduce((s, a) => s + a.sold, 0) ?? 0;
  const detTotalRestanta = detaliatData?.reduce((s, a) => s + a.restanta, 0) ?? 0;
  const detTotalContrib  = detaliatData?.reduce((s, a) => s + a.contributiiPerioda, 0) ?? 0;

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
            <h1 className="page-title">Registru fonduri</h1>
            <p className="page-sub">Contribuții și transferuri pentru fondul selectat</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={handlePrint} disabled={!fondId}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handleDownloadPdf} disabled={pdfLoading || !fondId}>
              {pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Fond</label>
            <select className="input" value={fondId} onChange={e => setFondId(e.target.value)} style={{ minWidth: "200px" }}>
              {fonduri.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Apartament</label>
            <select className="input" value={apartamentId} onChange={e => setApartamentId(e.target.value)} style={{ minWidth: "240px" }}>
              <option value="">Asociație</option>
              {apartamente.map(a => (
                <option key={a.id} value={a.id}>
                  {`Ap. ${a.numar}${a.scara ? `/${a.scara}` : ""}${a.proprietar ? ` — ${a.proprietar}` : ""}`}
                </option>
              ))}
              <option value="detaliat">Toate apartamentele (detaliat)</option>
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

        {error && <div className="wizard__error">{error}</div>}
      </div>

      {/* ── Panou sumar ── */}
      <div className="dash-panel" style={{ margin: "0 1.5rem 1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Fond</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#e2e8f0" }}>{numeFond}</div>
        </div>
        {apartamentLabel && (
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Apartament</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>{apartamentLabel}</div>
          </div>
        )}
        {detaliatData ? (
          <>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total sold</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>{fmt2(detTotalSold)} lei</div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total restanță</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f87171" }}>{fmt2(detTotalRestanta)} lei</div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Contribuții perioadă</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(detTotalContrib)} lei</div>
            </div>
          </>
        ) : (
          <>
            {soldAp !== null && (
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Sold fond</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>{fmt2(soldAp)} lei</div>
              </div>
            )}
            {restantaAp !== null && (
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Restanță fond</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f87171" }}>{fmt2(restantaAp)} lei</div>
              </div>
            )}
            {soldAp === null && (
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Sold inițial</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>{fmt2(soldInitial)} lei</div>
              </div>
            )}
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
          </>
        )}
      </div>

      {/* ── Tabel detaliat: sumar per apartament ── */}
      {detaliatData && (
        <div className="table-wrap" style={{ margin: "0 0 1.5rem" }}>
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>Nr.</th>
                <th>Ap.</th>
                <th>Proprietar</th>
                <th style={{ textAlign: "right" }}>Sold (lei)</th>
                <th style={{ textAlign: "right" }}>Restanță (lei)</th>
                <th style={{ textAlign: "right" }}>Contribuții perioadă (lei)</th>
              </tr>
            </thead>
            <tbody>
              {detaliatData.map((a, idx) => (
                <tr key={a.apartamentId}>
                  <td style={{ color: "#64748b", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: "#a78bfa" }}>{a.numar}{a.scara ? `/${a.scara}` : ""}</td>
                  <td style={{ color: "#e2e8f0" }}>{a.proprietar || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap" }}>{fmt2(a.sold)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: a.restanta > 0 ? "#f87171" : "#64748b", whiteSpace: "nowrap" }}>{fmt2(a.restanta)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: a.contributiiPerioda > 0 ? "#4ade80" : "#64748b", whiteSpace: "nowrap" }}>
                    {a.contributiiPerioda > 0 ? fmt2(a.contributiiPerioda) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>TOTAL</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#a78bfa", whiteSpace: "nowrap" }}>{fmt2(detTotalSold)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(detTotalRestanta)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(detTotalContrib)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Tabel normal / per apartament ── */}
      {!detaliatData && (
        ops.length === 0 && !loading ? (
          <div className="empty-state">
            <span className="empty-state__icon">💼</span>
            <div className="empty-state__title">Nicio mișcare pentru acest fond în perioada selectată</div>
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
                  <td /><td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(dataStart)}</td><td style={{ color: "#64748b" }}>—</td>
                  <td style={{ fontStyle: "italic", color: "#94a3b8" }}>Sold inițial</td><td /><td />
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
        )
      )}

      {/* ── Print zone ── */}
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

        {detaliatData ? (
          <>
            <div style={{ textAlign: "center", fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 2pt" }}>Situație fond — toate apartamentele</div>
            <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", color: "#333", marginBottom: "12pt" }}>{numeFond}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr>
                  {["Nr.", "Ap.", "Proprietar", "Sold (lei)", "Restanță (lei)", "Contribuții perioadă (lei)"].map((h, i) => (
                    <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i >= 3 ? "right" : i <= 1 ? "center" : "left", fontWeight: "bold" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detaliatData.map((a, idx) => (
                  <tr key={a.apartamentId} style={{ background: idx % 2 === 1 ? "#f5f5f5" : "#fff" }}>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{a.numar}{a.scara ? `/${a.scara}` : ""}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}>{a.proprietar || "—"}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(a.sold)}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(a.restanta)}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{a.contributiiPerioda > 0 ? fmt2(a.contributiiPerioda) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ borderTop: "2px solid #000", padding: "4pt 8pt", textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
                  <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(detTotalSold)}</td>
                  <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(detTotalRestanta)}</td>
                  <td style={{ borderTop: "2px solid #000", padding: "4pt 5pt", textAlign: "right", fontWeight: "bold" }}>{fmt2(detTotalContrib)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase", margin: "10pt 0 2pt" }}>Registru fond</div>
            <div style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", color: "#333", marginBottom: apartamentLabel ? "4pt" : "12pt" }}>{numeFond}</div>
            {apartamentLabel && <div style={{ textAlign: "center", fontSize: "10pt", color: "#444", marginBottom: "12pt" }}>{apartamentLabel}</div>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr>
                  {["Nr.\ncrt.", "Data", "Document", "Explicație", "Intrări\n(lei)", "Ieșiri\n(lei)", "Sold\n(lei)"].map((h, i) => (
                    <th key={i} style={{ background: "#e8e8e8", border: "1px solid #555", padding: "4pt 5pt", textAlign: i >= 4 ? "right" : i <= 2 ? "center" : "left", fontWeight: "bold", whiteSpace: "pre-line" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "#efefef" }}>
                  <td style={{ border: "1px solid #999", padding: "3pt 5pt" }} />
                  <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "center" }}>{roDate(dataStart)}</td>
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
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt" }}><b>{felLabel(row.fel)}:</b> {row.detalii}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{row.intrare ? fmt2(row.intrare) : ""}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{row.iesire ? fmt2(row.iesire) : ""}</td>
                    <td style={{ border: "1px solid #999", padding: "3pt 5pt", textAlign: "right" }}>{fmt2(row.sold)}</td>
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
          </>
        )}

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
