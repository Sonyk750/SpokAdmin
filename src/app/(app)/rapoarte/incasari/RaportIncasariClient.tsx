"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pozitie      { tip: string; denumire: string; suma: number; fondId?: string; }
interface AvansDisplay { tip?: string; denumire?: string; suma: number; }

interface IncasareRow {
  id: string; nrApartament: string; proprietarNume: string | null;
  serie: string | null; numarDocument: number | null;
  tipDocument: string; tipPlata: string;
  data: string; sumaIncasata: number; observatii: string | null;
  pozitii: Pozitie[]; avans: AvansDisplay[] | { suma: number } | null;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

// Form-specific types
interface DebtRow      { tip: string; fondId?: string; denumire: string; datorat: number; }
interface SelectedDebt extends DebtRow { suma: string; }
interface SoldCurent   { restantaIntretinere: number; intretinereCurenta: number; fonduri: { id: string; name: string; restanta: number }[]; }
interface ApOption     { id: string; numar: string; proprietar: string; }
interface BancaOption  { name: string; iban?: string; }
interface FondOption   { id: string; name: string; }
interface FormAvansItem { tip: "intretinere" | "fond"; fondId?: string; denumire: string; suma: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (v: number) => v.toFixed(2);

const TIP_DOC_LABEL: Record<string, string> = {
  chitanta: "Chitanță", dispozitie_incasare: "Dispoziție de încasare",
  proces_verbal: "Proces verbal", extras_cont: "Extras de cont",
};

const TIP_PLATA_LABEL: Record<string, string> = { casa: "Casă", banca: "Bancă", online: "Online" };

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
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const docLabel = TIP_DOC_LABEL[inc.tipDocument] ?? inc.tipDocument;
  const docNr    = inc.serie && inc.numarDocument != null ? ` ${inc.serie} ${inc.numarDocument}` : "";
  const pozitiiLines: any[] = inc.pozitii.map(p => ({
    columns: [{ text: p.denumire, width: "*", fontSize: 10, color: "#333" }, { text: `${fmt2(p.suma)} lei`, width: "auto", fontSize: 10, alignment: "right" }],
    margin: [0, 2, 0, 0],
  }));
  const avansArr: any[] = Array.isArray(inc.avans)
    ? (inc.avans as any[]).map(a => ({ columns: [{ text: a.denumire ?? "Avans", width: "*", fontSize: 10, color: "#555", italics: true }, { text: `− ${fmt2(a.suma)} lei`, width: "auto", fontSize: 10, alignment: "right", color: "#555", italics: true }], margin: [0, 2, 0, 0] }))
    : (!Array.isArray(inc.avans) && (inc.avans as any)?.suma > 0
        ? [{ columns: [{ text: "Avans", width: "*", fontSize: 10, color: "#555", italics: true }, { text: `− ${fmt2((inc.avans as any).suma)} lei`, width: "auto", fontSize: 10, alignment: "right", color: "#555", italics: true }], margin: [0, 2, 0, 0] }]
        : []);
  return {
    pageSize: "A5", pageOrientation: "landscape", pageMargins: [30, 28, 30, 28],
    content: [
      { text: asoc?.name ?? "", bold: true, fontSize: 13, margin: [0, 0, 0, 2] },
      adresa ? { text: adresa, fontSize: 8.5, color: "#444", margin: [0, 0, 0, 1] } : {},
      asoc?.cui ? { text: `CUI: ${asoc.cui}`, fontSize: 8, color: "#666" } : {},
      { canvas: [{ type: "line", x1: 0, y1: 4, x2: 530, y2: 4, lineWidth: 1, lineColor: "#aaa" }], margin: [0, 6, 0, 10] },
      { text: `${docLabel}${docNr}`, fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 4] },
      { text: `Data: ${roDate(inc.data)}`, fontSize: 10, alignment: "center", color: "#555", margin: [0, 0, 0, 14] },
      { text: `Am primit de la: ${inc.proprietarNume ?? "—"}`, fontSize: 10, margin: [0, 0, 0, 4] },
      { text: `Apartament nr.: ${inc.nrApartament}`, fontSize: 10, margin: [0, 0, 0, 10] },
      { text: "Detaliu plată:", fontSize: 9, bold: true, color: "#555", margin: [0, 0, 0, 4] },
      ...pozitiiLines,
      ...avansArr,
      { canvas: [{ type: "line", x1: 0, y1: 4, x2: 530, y2: 4, lineWidth: 0.5, lineColor: "#ccc" }], margin: [0, 8, 0, 6] },
      { columns: [{ text: "TOTAL ÎNCASAT:", bold: true, fontSize: 11 }, { text: `${fmt2(inc.sumaIncasata)} lei`, bold: true, fontSize: 13, alignment: "right" }] },
      { columns: [
        { text: `Administrator,\n\n\n${asoc?.adminName ?? ""}`, fontSize: 9, color: "#555", alignment: "center" },
        { text: "Casier,\n\n\n", fontSize: 9, color: "#555", alignment: "center" },
        { text: "Am primit,\n\n\n", fontSize: 9, color: "#555", alignment: "center" },
      ], margin: [0, 20, 0, 0] },
    ],
    styles: {}, defaultStyle: { font: "Roboto" },
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
      { stack: [
        { text: ceReprezinta(row), fontSize: 8 },
        ...(row.proprietarNume ? [{ text: row.proprietarNume, fontSize: 7.5, color: "#555", margin: [0, 2, 0, 0], italics: true }] : []),
      ] },
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

  // ── List state ────────────────────────────────────────────────────────────
  const [asoc,       setAsoc]       = useState<AsocInfo | null>(null);
  const [dataStart,  setDataStart]  = useState(defaultStart);
  const [dataEnd,    setDataEnd]    = useState(defaultEnd);
  const [rows,       setRows]       = useState<IncasareRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editRow,      setEditRow]      = useState<IncasareRow | null>(null);
  const [editData,     setEditData]     = useState("");
  const [editSerie,    setEditSerie]    = useState("");
  const [editNr,       setEditNr]       = useState("");
  const [editTipDoc,   setEditTipDoc]   = useState("chitanta");
  const [editTipPlata, setEditTipPlata] = useState("casa");
  const [editObs,      setEditObs]      = useState("");
  const [editSaving,   setEditSaving]   = useState(false);
  const [editErr,      setEditErr]      = useState<string | null>(null);

  // ── Delete state ──────────────────────────────────────────────────────────
  const [delRow,   setDelRow]   = useState<IncasareRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delErr,   setDelErr]   = useState<string | null>(null);

  // ── Add form state ────────────────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [formErr,      setFormErr]      = useState<string | null>(null);
  const apRef = useRef<HTMLDivElement>(null);

  const [apOptions,     setApOptions]     = useState<ApOption[]>([]);
  const [apSearch,      setApSearch]      = useState("");
  const [selectedApId,  setSelectedApId]  = useState("");
  const [showDropdown,  setShowDropdown]  = useState(false);

  const [soldLoading,   setSoldLoading]   = useState(false);
  const [allDebts,      setAllDebts]      = useState<DebtRow[]>([]);
  const [rightDebts,    setRightDebts]    = useState<SelectedDebt[]>([]);
  const [leftSelected,  setLeftSelected]  = useState<Set<number>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<number>>(new Set());

  const [sumaPlatita,   setSumaPlatita]   = useState("");
  const [dataDoc,       setDataDoc]       = useState(new Date().toISOString().slice(0, 10));
  const [serieDoc,      setSerieDoc]      = useState("CH");
  const [nrDocManual,   setNrDocManual]   = useState("");
  const [tipDocument,   setTipDocument]   = useState("chitanta");
  const [whereCollect,  setWhereCollect]  = useState("casa");
  const [banci,         setBanci]         = useState<BancaOption[]>([]);
  const [fonduri,       setFonduri]       = useState<FondOption[]>([]);
  const [avansItems,    setAvansItems]    = useState<FormAvansItem[]>([]);
  const [observatii,    setObservatii]    = useState("");
  const [idTranzactie,  setIdTranzactie]  = useState("");

  // ── Derived form values ───────────────────────────────────────────────────
  const sumaPlatitaNum = parseFloat(sumaPlatita) || 0;
  const totalDatorat   = allDebts.reduce((s, d) => s + d.datorat, 0);
  const totalAchitat   = rightDebts.reduce((s, d) => s + (parseFloat(d.suma) || 0), 0);
  const sumaRamasa     = Math.max(0, totalDatorat - totalAchitat);
  const avans          = sumaPlatitaNum > 0
    ? Math.max(0, Math.round((sumaPlatitaNum - totalAchitat) * 100) / 100)
    : Math.max(0, totalAchitat - rightDebts.reduce((s, d) => s + d.datorat, 0));
  const insuficient    = sumaPlatitaNum > 0 && totalAchitat > sumaPlatitaNum
    ? Math.round((totalAchitat - sumaPlatitaNum) * 100) / 100 : 0;

  const filteredAps = apOptions.filter(ap => {
    const q = apSearch.toLowerCase();
    return !q || ap.numar.includes(q) || ap.proprietar.toLowerCase().includes(q);
  });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then((d: any) => { setAsoc(d); setBanci(d.banci ?? []); setFonduri(d.fonduri ?? []); })
      .catch(() => {});
  }, [asociatieId]);

  useEffect(() => {
    if (!asociatieId) { setApOptions([]); return; }
    fetch(`/api/asociatii/${asociatieId}/apartamente`)
      .then(r => r.json())
      .then((d: { apartamente: any[] }) =>
        setApOptions((d.apartamente ?? []).map(ap => ({ id: ap.id, numar: ap.numar, proprietar: ap.proprietar || "" })))
      ).catch(() => {});
  }, [asociatieId]);

  useEffect(() => {
    if (!selectedApId || !asociatieId) { setAllDebts([]); setRightDebts([]); return; }
    setSoldLoading(true);
    fetch(`/api/incasari/sold-curent?apartamentId=${selectedApId}&asociatieId=${asociatieId}`)
      .then(r => r.json())
      .then((data: SoldCurent) => {
        const dRows: DebtRow[] = [];
        if (data.intretinereCurenta > 0) dRows.push({ tip: "intretinere_curenta", denumire: "Întreținere luna curentă", datorat: data.intretinereCurenta });
        if (data.restantaIntretinere > 0) dRows.push({ tip: "intretinere", denumire: "Restanță întreținere", datorat: data.restantaIntretinere });
        for (const f of data.fonduri) if (f.restanta > 0) dRows.push({ tip: "fond", fondId: f.id, denumire: f.name, datorat: f.restanta });
        setAllDebts(dRows); setRightDebts([]); setLeftSelected(new Set()); setRightSelected(new Set());
      })
      .catch(() => { setAllDebts([]); setRightDebts([]); })
      .finally(() => setSoldLoading(false));
  }, [selectedApId, asociatieId]);

  useEffect(() => {
    if (whereCollect !== "casa") setTipDocument("extras_cont");
    else setTipDocument(prev => prev === "extras_cont" ? "chitanta" : prev);
  }, [whereCollect]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (apRef.current && !apRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

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

  // ── Dual-list helpers ─────────────────────────────────────────────────────
  function distribute(debts: DebtRow[], existing: SelectedDebt[]): SelectedDebt[] {
    const already = existing.reduce((s, d) => s + (parseFloat(d.suma) || 0), 0);
    let remaining = sumaPlatitaNum > 0 ? Math.max(0, sumaPlatitaNum - already) : Infinity;
    return debts.map(d => {
      const allocated = Math.min(remaining, d.datorat);
      remaining = Math.max(0, remaining - allocated);
      return { ...d, suma: fmt2(sumaPlatitaNum > 0 ? allocated : d.datorat) };
    });
  }

  function moveAllToRight() { setRightDebts(distribute(allDebts, [])); setLeftSelected(new Set()); setRightSelected(new Set()); }

  function moveSelectedToRight() {
    const toMove = allDebts.filter((_, i) => leftSelected.has(i));
    const existingKeys = new Set(rightDebts.map(d => `${d.tip}:${d.fondId ?? ""}`));
    const newOnes = toMove.filter(d => !existingKeys.has(`${d.tip}:${d.fondId ?? ""}`));
    setRightDebts(prev => [...prev, ...distribute(newOnes, prev)]);
    setLeftSelected(new Set());
  }

  function removeFromRight() { setRightDebts(prev => prev.filter((_, i) => !rightSelected.has(i))); setRightSelected(new Set()); }
  function toggleLeft(i: number)  { setLeftSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; }); }
  function toggleRight(i: number) { setRightSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; }); }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openModal() {
    setSelectedApId(""); setApSearch(""); setShowDropdown(false);
    setAllDebts([]); setRightDebts([]); setLeftSelected(new Set()); setRightSelected(new Set());
    setSumaPlatita(""); setAvansItems([]);
    setDataDoc(new Date().toISOString().slice(0, 10));
    setSerieDoc("CH"); setNrDocManual(""); setTipDocument("chitanta");
    setWhereCollect("casa"); setObservatii(""); setIdTranzactie(""); setFormErr(null);
    setModalOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!asociatieId || !selectedApId) { setFormErr("Selectează un apartament."); return; }
    const payload = rightDebts.filter(d => parseFloat(d.suma) > 0);
    if (payload.length === 0) { setFormErr("Adaugă cel puțin o datorie în lista de achitat."); return; }

    const avansRepartizat = avansItems
      .map(a => ({ ...a, suma: Math.round((parseFloat(a.suma) || 0) * 100) / 100 }))
      .filter(a => a.suma > 0);

    const totalAvansRepartizat = avansRepartizat.reduce((s, a) => s + a.suma, 0);
    if (avans > 0 && Math.abs(totalAvansRepartizat - avans) > 0.01) {
      setFormErr(`Avansul de ${fmt2(avans)} lei nu este complet repartizat (repartizat: ${fmt2(totalAvansRepartizat)} lei).`);
      return;
    }

    const tipPlata = whereCollect === "casa" ? "casa" : "banca";
    setSaving(true); setFormErr(null);
    try {
      const res = await fetch("/api/incasari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asociatieId, apartamentId: selectedApId,
          tipDocument, tipPlata,
          bancaName: whereCollect !== "casa" ? whereCollect : undefined,
          data: dataDoc,
          serieOverride: whereCollect === "casa" ? (serieDoc || undefined) : undefined,
          nrDocManual: whereCollect === "casa" && nrDocManual ? parseInt(nrDocManual) : undefined,
          observatii: whereCollect !== "casa" && idTranzactie
            ? `ID tranzacție: ${idTranzactie}${observatii ? " | " + observatii : ""}`
            : observatii,
          pozitii: payload.map(d => ({ tip: d.tip, fondId: d.fondId, denumire: d.denumire, suma: Math.round(parseFloat(d.suma) * 100) / 100 })),
          avansRepartizat: avansRepartizat.length > 0 ? avansRepartizat : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setModalOpen(false); fetchData();
    } catch (e: any) { setFormErr(e.message); }
    finally { setSaving(false); }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: editData, serie: editSerie, numarDocument: editNr ? parseInt(editNr) : undefined, tipDocument: editTipDoc, tipPlata: editTipPlata, observatii: editObs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setEditRow(null); fetchData();
    } catch (e: any) { setEditErr(e.message); }
    finally { setEditSaving(false); }
  }

  // ── Delete handler ────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!delRow) return;
    setDeleting(true); setDelErr(null);
    try {
      const res  = await fetch(`/api/incasari/${delRow.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setDelRow(null); fetchData();
    } catch (e: any) { setDelErr(e.message); }
    finally { setDeleting(false); }
  }

  const totalIncasat = rows.reduce((s, r) => s + r.sumaIncasata, 0);

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 15mm 12mm 25mm 12mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 10pt; } }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Registru încasări</h1>
            <p className="page-sub">Chitanțe emise în perioada selectată</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!rows.length}>🖨 Printează</button>
            <button className="btn btn--secondary" onClick={async () => {
              if (!rows.length || !asociatieId) return;
              setPdfLoading(true); setError(null);
              try {
                const fresh: AsocInfo = await fetch(`/api/asociatii/${asociatieId}`).then(r => r.json());
                await generateRegistruPdf(fresh, rows, dataStart, dataEnd);
              } catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
              finally { setPdfLoading(false); }
            }} disabled={!rows.length || pdfLoading}>
              {pdfLoading ? "Se generează..." : "⬇ PDF registru"}
            </button>
            <button className="btn btn--primary" onClick={openModal}>+ Adaugă încasare</button>
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

      {/* ── Summary ────────────────────────────────────────────────────────── */}
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

      {/* ── Table ──────────────────────────────────────────────────────────── */}
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
                    {row.proprietarNume && <span style={{ display: "block", color: "#64748b", fontSize: "0.75rem", marginTop: 2 }}>{row.proprietarNume}</span>}
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

      {/* ── Modal Adaugă încasare ───────────────────────────────────────────── */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "62rem", width: "96vw" }}>
            <div className="modal__header">
              <span className="modal__title">Adaugă încasare</span>
              <button className="modal__close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Apartament */}
              <div ref={apRef} style={{ position: "relative" }}>
                <label className="form-field__label" style={{ marginBottom: "0.375rem", display: "block" }}>Plătitor — Apartament *</label>
                <input type="text" className="input" placeholder="Caută după număr sau proprietar..."
                  value={apSearch} autoComplete="off"
                  onChange={e => { setApSearch(e.target.value); setSelectedApId(""); setShowDropdown(true); setAllDebts([]); setRightDebts([]); }}
                  onFocus={() => { if (apSearch) setShowDropdown(true); }}
                />
                {showDropdown && apSearch && filteredAps.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", background: "#0d1325", zIndex: 20, maxHeight: "200px", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {filteredAps.slice(0, 20).map(ap => (
                      <div key={ap.id} style={{ padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                        onMouseDown={() => { setSelectedApId(ap.id); setApSearch(`Ap. ${ap.numar}${ap.proprietar ? ` — ${ap.proprietar}` : ""}`); setShowDropdown(false); }}>
                        <span style={{ fontWeight: 700, color: "#a78bfa" }}>Ap. {ap.numar}</span>
                        {ap.proprietar && <span style={{ color: "#94a3b8", marginLeft: "0.625rem" }}>{ap.proprietar}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && apSearch && !selectedApId && filteredAps.length === 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, padding: "0.5rem 1rem", fontSize: "0.8125rem", color: "#64748b", background: "#0d1325", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", zIndex: 20 }}>
                    Niciun apartament găsit.
                  </div>
                )}
              </div>

              {/* Dată / tip document / serie+nr / unde se încasează */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr", gap: "1rem" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Data încasării</label>
                  <input type="date" className="input" value={dataDoc}
                    onChange={e => setDataDoc(e.target.value)}
                    onClick={e => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Tip document</label>
                  {whereCollect !== "casa" ? (
                    <div className="input" style={{ color: "#a78bfa", display: "flex", alignItems: "center" }}>Extras de cont</div>
                  ) : (
                    <select className="input" value={tipDocument} onChange={e => setTipDocument(e.target.value)}>
                      <option value="chitanta">Chitanță</option>
                      <option value="dispozitie_incasare">Dispoziție de încasare</option>
                      <option value="proces_verbal">Proces verbal</option>
                    </select>
                  )}
                </div>
                {whereCollect === "casa" ? (
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label className="form-field__label">Serie / Nr. document</label>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <input type="text" className="input" value={serieDoc} onChange={e => setSerieDoc(e.target.value)} style={{ width: "54px" }} maxLength={6} placeholder="CH" />
                      <input type="number" className="input" value={nrDocManual} onChange={e => setNrDocManual(e.target.value)} style={{ flex: 1 }} placeholder="auto" min={1} />
                    </div>
                  </div>
                ) : (
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label className="form-field__label">ID Tranzacție</label>
                    <input type="text" className="input" value={idTranzactie} onChange={e => setIdTranzactie(e.target.value)} placeholder="ex: TXN-123456..." />
                  </div>
                )}
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Se încasează în</label>
                  <select className="input" value={whereCollect} onChange={e => setWhereCollect(e.target.value)}>
                    <option value="casa">🏠 Casă (numerar)</option>
                    {banci.map((b, i) => <option key={i} value={b.name}>🏦 {b.name}{b.iban ? ` — ${b.iban}` : ""}</option>)}
                  </select>
                </div>
              </div>

              {/* Suma plătită */}
              {selectedApId && (
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1rem 1.25rem", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-field__label" style={{ marginBottom: "0.375rem", display: "block", color: "#4ade80" }}>Suma plătită de proprietar (lei)</label>
                    <input type="number" className="input" value={sumaPlatita} step="0.01" min="0" placeholder="0.00"
                      style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "right", maxWidth: "200px" }}
                      onChange={e => setSumaPlatita(e.target.value)} />
                  </div>
                  {sumaPlatitaNum > 0 && (
                    <div style={{ display: "flex", gap: "2rem", flexShrink: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Total datorat</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f87171", marginTop: "0.25rem" }}>{fmt2(totalDatorat)} lei</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Se achită</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#4ade80", marginTop: "0.25rem" }}>{fmt2(totalAchitat)} lei</div>
                      </div>
                      {avans > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "0.7rem", color: "#a78bfa", fontWeight: 700, textTransform: "uppercase" }}>Avans</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#a78bfa", marginTop: "0.25rem" }}>+{fmt2(avans)} lei</div>
                        </div>
                      )}
                      {insuficient > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "0.7rem", color: "#f87171", fontWeight: 700, textTransform: "uppercase" }}>Insuficient</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f87171", marginTop: "0.25rem" }}>-{fmt2(insuficient)} lei</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Dual-list datorii */}
              {soldLoading && <div style={{ fontSize: "0.875rem", color: "#64748b", padding: "0.5rem 0" }}>Se încarcă datoriile...</div>}

              {selectedApId && !soldLoading && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: "0.75rem", alignItems: "start" }}>
                  {/* Left — datorii disponibile */}
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "0.5rem" }}>Datorii curente</div>
                    <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", minHeight: "140px", overflow: "hidden" }}>
                      {allDebts.length === 0 ? (
                        <div style={{ padding: "1.5rem 1rem", fontSize: "0.8125rem", color: "#4ade80", textAlign: "center" }}>✓ Fără restanțe</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "0.7rem" }}>Datorie</th>
                              <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#64748b", fontWeight: 600, fontSize: "0.7rem" }}>Sumă</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDebts.map((d, i) => {
                              const sel = leftSelected.has(i);
                              const inRight = rightDebts.some(r => r.tip === d.tip && (r.fondId ?? "") === (d.fondId ?? ""));
                              return (
                                <tr key={i} onClick={() => !inRight && toggleLeft(i)}
                                  style={{ cursor: inRight ? "default" : "pointer", background: sel ? "rgba(124,58,237,0.12)" : inRight ? "rgba(255,255,255,0.02)" : "", opacity: inRight ? 0.4 : 1, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "0.5rem 0.75rem", color: sel ? "#a78bfa" : "#e2e8f0" }}>
                                    {sel && <span style={{ marginRight: "0.375rem", color: "#a78bfa" }}>✓</span>}{d.denumire}
                                  </td>
                                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#f87171", whiteSpace: "nowrap" }}>{fmt2(d.datorat)} lei</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {totalDatorat > 0 && (
                            <tfoot>
                              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Total datorat</td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 800, color: "#f87171" }}>{fmt2(totalDatorat)} lei</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Butoane transfer */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1.75rem", alignItems: "center" }}>
                    <button type="button" title="Mută toate" onClick={moveAllToRight}
                      style={{ width: "38px", height: "30px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "6px", color: "#a78bfa", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>⇒</button>
                    <button type="button" title="Mută selecția" onClick={moveSelectedToRight} disabled={leftSelected.size === 0}
                      style={{ width: "38px", height: "30px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "6px", color: leftSelected.size > 0 ? "#a78bfa" : "#475569", cursor: leftSelected.size > 0 ? "pointer" : "default", fontSize: "0.75rem", fontWeight: 700 }}>→</button>
                    <button type="button" title="Elimină selecția" onClick={removeFromRight} disabled={rightSelected.size === 0}
                      style={{ width: "38px", height: "30px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", color: rightSelected.size > 0 ? "#f87171" : "#475569", cursor: rightSelected.size > 0 ? "pointer" : "default", fontSize: "0.75rem", fontWeight: 700 }}>←</button>
                  </div>

                  {/* Right — se achită */}
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "0.5rem" }}>Se achită cu această chitanță</div>
                    <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", minHeight: "140px", overflow: "hidden" }}>
                      {rightDebts.length === 0 ? (
                        <div style={{ padding: "1.5rem 1rem", fontSize: "0.8125rem", color: "#475569", textAlign: "center" }}>← Selectează datorii</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "0.7rem" }}>Datorie</th>
                              <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#64748b", fontWeight: 600, fontSize: "0.7rem" }}>Sumă (lei)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rightDebts.map((d, i) => {
                              const sel = rightSelected.has(i);
                              return (
                                <tr key={i} style={{ background: sel ? "rgba(239,68,68,0.07)" : "", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "#e2e8f0", cursor: "pointer", userSelect: "none" }} onClick={() => toggleRight(i)}>
                                    {sel && <span style={{ marginRight: "0.375rem", color: "#f87171" }}>✓</span>}{d.denumire}
                                  </td>
                                  <td style={{ padding: "0.375rem 0.75rem 0.375rem 0.25rem", textAlign: "right" }}>
                                    <input type="number" className="input input--sm" value={d.suma} step="0.01" min="0"
                                      style={{ width: "100px", textAlign: "right" }}
                                      onChange={e => setRightDebts(prev => prev.map((r, j) => j === i ? { ...r, suma: e.target.value } : r))} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Total</td>
                              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>{fmt2(totalAchitat)} lei</td>
                            </tr>
                            {sumaRamasa > 0 && (
                              <tr><td colSpan={2} style={{ padding: "0.25rem 0.75rem 0.5rem", fontSize: "0.75rem", color: "#f87171", textAlign: "right" }}>Rămâne neachitat: {fmt2(sumaRamasa)} lei</td></tr>
                            )}
                            {avans > 0 && (
                              <tr><td colSpan={2} style={{ padding: "0.25rem 0.75rem 0.5rem", fontSize: "0.75rem", color: "#a78bfa", textAlign: "right" }}>Avans: {fmt2(avans)} lei</td></tr>
                            )}
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Repartizare avans */}
              {selectedApId && avans > 0 && (
                <div style={{ padding: "1rem 1.25rem", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a78bfa" }}>
                      Repartizare avans — {fmt2(avans)} lei
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: (() => { const rep = avansItems.reduce((s, a) => s + (parseFloat(a.suma) || 0), 0); return Math.abs(rep - avans) < 0.01 ? "#4ade80" : "#f87171"; })() }}>
                      Repartizat: {fmt2(avansItems.reduce((s, a) => s + (parseFloat(a.suma) || 0), 0))} / {fmt2(avans)} lei
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {(() => {
                      const idx = avansItems.findIndex(a => a.tip === "intretinere");
                      const val = idx >= 0 ? avansItems[idx].suma : "";
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ flex: 1, fontSize: "0.875rem", color: "#e2e8f0" }}>Întreținere</div>
                          <input type="number" step="0.01" min="0" className="input input--sm" style={{ width: "110px", textAlign: "right" }} placeholder="0.00" value={val}
                            onChange={e => setAvansItems(prev => { const next = prev.filter(a => a.tip !== "intretinere"); if (e.target.value) next.push({ tip: "intretinere", denumire: "Întreținere (avans)", suma: e.target.value }); return next; })} />
                          <span style={{ fontSize: "0.75rem", color: "#64748b", width: "24px" }}>lei</span>
                        </div>
                      );
                    })()}
                    {fonduri.map(f => {
                      const idx = avansItems.findIndex(a => a.tip === "fond" && a.fondId === f.id);
                      const val = idx >= 0 ? avansItems[idx].suma : "";
                      return (
                        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ flex: 1, fontSize: "0.875rem", color: "#e2e8f0" }}>{f.name}</div>
                          <input type="number" step="0.01" min="0" className="input input--sm" style={{ width: "110px", textAlign: "right" }} placeholder="0.00" value={val}
                            onChange={e => setAvansItems(prev => { const next = prev.filter(a => !(a.tip === "fond" && a.fondId === f.id)); if (e.target.value) next.push({ tip: "fond", fondId: f.id, denumire: `${f.name} (avans)`, suma: e.target.value }); return next; })} />
                          <span style={{ fontSize: "0.75rem", color: "#64748b", width: "24px" }}>lei</span>
                        </div>
                      );
                    })}
                    <button type="button"
                      style={{ alignSelf: "flex-start", marginTop: "0.25rem", fontSize: "0.75rem", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onClick={() => {
                        let remaining = avans;
                        const next: FormAvansItem[] = [];
                        for (const f of fonduri) { if (remaining <= 0) break; next.push({ tip: "fond", fondId: f.id, denumire: `${f.name} (avans)`, suma: fmt2(remaining) }); remaining = 0; }
                        if (remaining > 0) next.push({ tip: "intretinere", denumire: "Întreținere (avans)", suma: fmt2(remaining) });
                        setAvansItems(next);
                      }}>
                      → Repartizează tot la primul fond disponibil
                    </button>
                  </div>
                </div>
              )}

              {/* Observații */}
              {selectedApId && (
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Observații</label>
                  <input type="text" className="input" value={observatii} placeholder="Opțional..." onChange={e => setObservatii(e.target.value)} />
                </div>
              )}

              {formErr && <div className="wizard__error">{formErr}</div>}

              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={() => setModalOpen(false)}>Anulare</button>
                <button className="btn btn--primary" onClick={handleSave}
                  disabled={saving || !selectedApId || totalAchitat <= 0 || (avans > 0 && Math.abs(avansItems.reduce((s, a) => s + (parseFloat(a.suma) || 0), 0) - avans) > 0.01)}>
                  {saving ? "Se salvează..." : `Salvează chitanța${totalAchitat > 0 ? ` — ${fmt2(sumaPlatitaNum > 0 ? sumaPlatitaNum : totalAchitat)} lei` : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editează ─────────────────────────────────────────────────── */}
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

      {/* ── Modal Confirmare ștergere ───────────────────────────────────────── */}
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

      {/* ── Print zone ─────────────────────────────────────────────────────── */}
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
