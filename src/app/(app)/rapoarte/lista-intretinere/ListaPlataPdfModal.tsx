"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConturCol  { tip: string; label: string; unit: string; valoareLeiKey: string | null; }
interface FondCol    { id: string; name: string; }
interface CheltuialaCol { key: string; label: string; criteriu: string | null; }

interface Coloane {
  nrPersone: boolean; cotaParte: boolean; suprafata: boolean;
  consumuri: ConturCol[]; cheltuieli: CheltuialaCol[];
  hasRestantaIntretinere: boolean; fonduri: FondCol[]; hasTotalLuna: boolean;
}

interface Row {
  apartamentId: string; numar: string; proprietar: string;
  nrPersone: number; cotaParte: number | null; suprafata: number | null;
  consumByTip: Record<string, number>; cheltuieli: Record<string, number>;
  totalLuna: number; restantaIntretinere: number; totalFonduri: number;
  restantaFonduri: Record<string, number>; total: number;
}

interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

interface MovCol {
  id: string; kind: "chelt" | "totalLuna"; cheltKey?: string; cheltLabel?: string;
}

export interface PdfOptions {
  pageSize: string;
  orientation: "portrait" | "landscape";
  fontSize: number;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  showNrPersone: boolean;
  showCotaParte: boolean;
  showSuprafata: boolean;
  consumViz: Record<string, boolean>;
  consumLeiViz: Record<string, boolean>;
  cheltViz: Record<string, boolean>;
  showTotalLuna: boolean;
  showRestanta: boolean;
  showFonduri: boolean;
  fondMode: "total" | "detaliat";
  fondViz: Record<string, boolean>;
  colWidths: Record<string, number>; // key → lățime în pt
}

interface Props {
  rows: Row[];
  coloane: Coloane;
  movCols: MovCol[];
  fondMode: "total" | "detaliat";
  asociatieId: string;
  luna: number;
  an: number;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MM = 2.8346;
const pt = (mm: number) => Math.round(mm * MM);

const LUNI = [
  "Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
  "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie",
];

// Portrait dimensions (width × height) in pt
const PAGE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A3:     { w: 841.89,  h: 1190.55, label: "A3" },
  A4:     { w: 595.28,  h: 841.89,  label: "A4" },
  A5:     { w: 419.53,  h: 595.28,  label: "A5" },
  LETTER: { w: 612,     h: 792,     label: "Letter" },
  LEGAL:  { w: 612,     h: 1008,    label: "Legal" },
};

const FONT_OPTIONS = [
  { value: "Roboto",    label: "Roboto" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times",     label: "Times" },
  { value: "Courier",   label: "Courier" },
];

const FONT_SIZES = [6, 7, 8, 9, 10, 11];

const fmt2 = (v: number) => v.toFixed(2);
const fmt3 = (v: number) => v.toFixed(3);
const fmt4 = (v: number) => v.toFixed(4);

// ─── Column width helpers ──────────────────────────────────────────────────────

// Default lățimi (pt) per cheie coloană
const DEFAULT_WIDTHS: Record<string, number> = {
  nr: 22, pers: 24, cpi: 28, sup: 34,
  totalLuna: 36, rest: 42, fond: 40, total: 44,
};

function initColWidths(coloane: Coloane, movCols: MovCol[]): Record<string, number> {
  const w: Record<string, number> = { ...DEFAULT_WIDTHS };
  for (const c of coloane.consumuri) {
    w[`c:${c.tip}`]  = 36;
    if (c.valoareLeiKey) w[`cl:${c.tip}`] = 36;
  }
  for (const col of movCols) {
    if (col.kind === "chelt") w[`ch:${col.cheltKey!}`] = 40;
  }
  for (const f of coloane.fonduri) {
    w[`f:${f.id}`] = 40;
  }
  return w;
}

interface ColDef { key: string; label: string; defaultW: number; }

function getVisibleColDefs(opts: PdfOptions, coloane: Coloane, movCols: MovCol[]): ColDef[] {
  const defs: ColDef[] = [];
  defs.push({ key: "nr", label: "Nr. Ap.", defaultW: 22 });
  // Proprietar e întotdeauna "*" (auto)
  if (coloane.nrPersone && opts.showNrPersone)  defs.push({ key: "pers", label: "Nr. persoane", defaultW: 24 });
  if (coloane.cotaParte && opts.showCotaParte)   defs.push({ key: "cpi",  label: "Cotă parte",   defaultW: 28 });
  if (coloane.suprafata && opts.showSuprafata)   defs.push({ key: "sup",  label: "Suprafață",     defaultW: 34 });

  for (const c of coloane.consumuri) {
    if (opts.consumViz[c.tip])                        defs.push({ key: `c:${c.tip}`,  label: `${c.label} (${c.unit})`, defaultW: 36 });
    if (c.valoareLeiKey && opts.consumLeiViz[c.tip])  defs.push({ key: `cl:${c.tip}`, label: `${c.label} (lei)`,        defaultW: 36 });
  }

  for (const col of movCols) {
    if (col.kind === "chelt" && opts.cheltViz[col.cheltKey!]) defs.push({ key: `ch:${col.cheltKey!}`, label: col.cheltLabel ?? "", defaultW: 40 });
    if (col.kind === "totalLuna" && opts.showTotalLuna)        defs.push({ key: "totalLuna", label: "Total lună", defaultW: 36 });
  }

  if (coloane.hasRestantaIntretinere && opts.showRestanta) defs.push({ key: "rest", label: "Rest. întreținere", defaultW: 42 });

  if (coloane.fonduri.length > 0 && opts.showFonduri) {
    if (opts.fondMode === "total") {
      defs.push({ key: "fond", label: "Fonduri rest.", defaultW: 40 });
    } else {
      for (const f of coloane.fonduri) {
        if (opts.fondViz[f.id] !== false) defs.push({ key: `f:${f.id}`, label: f.name, defaultW: 40 });
      }
    }
  }

  defs.push({ key: "total", label: "TOTAL", defaultW: 44 });
  return defs;
}

// ─── Init options from current table state ────────────────────────────────────

function initOpts(coloane: Coloane, fondMode: "total" | "detaliat", movCols: MovCol[]): PdfOptions {
  const consumViz: Record<string, boolean> = {};
  const consumLeiViz: Record<string, boolean> = {};
  for (const c of coloane.consumuri) {
    consumViz[c.tip] = true;
    if (c.valoareLeiKey) consumLeiViz[c.tip] = true;
  }
  const cheltViz: Record<string, boolean> = {};
  for (const c of coloane.cheltuieli) cheltViz[c.key] = true;
  const fondViz: Record<string, boolean> = {};
  for (const f of coloane.fonduri) fondViz[f.id] = true;

  return {
    pageSize: "A4",
    orientation: "landscape",
    fontSize: 7,
    fontFamily: "Roboto",
    marginLeft: 10,
    marginRight: 10,
    marginTop: 14,
    marginBottom: 24,
    showNrPersone: coloane.nrPersone,
    showCotaParte: coloane.cotaParte,
    showSuprafata: coloane.suprafata,
    consumViz,
    consumLeiViz,
    cheltViz,
    showTotalLuna: coloane.hasTotalLuna,
    showRestanta: coloane.hasRestantaIntretinere,
    showFonduri: coloane.fonduri.length > 0,
    fondMode,
    fondViz,
    colWidths: initColWidths(coloane, movCols),
  };
}

// ─── PDF document builder ─────────────────────────────────────────────────────

function buildDocDef(
  opts: PdfOptions,
  rows: Row[],
  coloane: Coloane,
  movCols: MovCol[],
  asoc: AsocInfo | null,
  luna: number,
  an: number,
) {
  const fs = opts.fontSize;
  const th = (text: string, al = "right"): any => ({
    text, bold: true, fontSize: fs + 1, alignment: al,
  });

  const widths: (number | string)[] = [];
  const hdr: any[] = [];

  const cw = (key: string, def: number) => opts.colWidths[key] ?? def;

  hdr.push(th("Nr.\nAp.", "center")); widths.push(cw("nr", 22));
  hdr.push(th("Proprietar", "left")); widths.push("*");
  if (coloane.nrPersone && opts.showNrPersone)  { hdr.push(th("Pers.", "center"));          widths.push(cw("pers", 24)); }
  if (coloane.cotaParte && opts.showCotaParte)   { hdr.push(th("CPI", "center"));            widths.push(cw("cpi",  28)); }
  if (coloane.suprafata && opts.showSuprafata)   { hdr.push(th("Supraf.\n(m²)", "center")); widths.push(cw("sup",  34)); }

  for (const c of coloane.consumuri) {
    if (opts.consumViz[c.tip])                        { hdr.push(th(`${c.label}\n(${c.unit})`, "right")); widths.push(cw(`c:${c.tip}`,  36)); }
    if (c.valoareLeiKey && opts.consumLeiViz[c.tip])  { hdr.push(th(`${c.label}\n(lei)`, "right"));       widths.push(cw(`cl:${c.tip}`, 36)); }
  }

  for (const col of movCols) {
    if (col.kind === "chelt" && opts.cheltViz[col.cheltKey!])  { hdr.push(th(col.cheltLabel ?? "", "right")); widths.push(cw(`ch:${col.cheltKey!}`, 40)); }
    if (col.kind === "totalLuna" && opts.showTotalLuna)         { hdr.push(th("Total\nlună", "right"));        widths.push(cw("totalLuna", 36)); }
  }

  if (coloane.hasRestantaIntretinere && opts.showRestanta) { hdr.push(th("Rest.\nîntrețin.", "right")); widths.push(cw("rest", 42)); }

  if (coloane.fonduri.length > 0 && opts.showFonduri) {
    if (opts.fondMode === "total") {
      hdr.push(th("Fond.\nrest.", "right")); widths.push(cw("fond", 40));
    } else {
      for (const f of coloane.fonduri) {
        if (opts.fondViz[f.id] !== false) { hdr.push(th(f.name, "right")); widths.push(cw(`f:${f.id}`, 40)); }
      }
    }
  }

  hdr.push(th("TOTAL\n(lei)", "right")); widths.push(cw("total", 44));

  // Count fixed-left columns (for TOTAL row colSpan)
  let fixN = 2;
  if (coloane.nrPersone && opts.showNrPersone) fixN++;
  if (coloane.cotaParte && opts.showCotaParte) fixN++;
  if (coloane.suprafata && opts.showSuprafata) fixN++;

  // Data rows
  const dataRows: any[][] = rows.map((row) => {
    const cells: any[] = [];
    const cell = (text: string | number, al = "right", bold = false, color?: string): any => {
      const obj: any = { text: String(text), alignment: al, bold, fontSize: fs };
      if (color) obj.color = color;
      return obj;
    };

    cells.push({ text: row.numar, alignment: "center", bold: true, fontSize: fs });
    cells.push({ text: row.proprietar || "—", fontSize: fs });

    if (coloane.nrPersone && opts.showNrPersone)  cells.push(cell(row.nrPersone, "center"));
    if (coloane.cotaParte && opts.showCotaParte)  cells.push(cell(row.cotaParte != null ? fmt4(row.cotaParte) : "—", "center"));
    if (coloane.suprafata && opts.showSuprafata)  cells.push(cell(row.suprafata != null ? fmt2(row.suprafata) : "—", "right"));

    for (const c of coloane.consumuri) {
      if (opts.consumViz[c.tip]) {
        const v = row.consumByTip[c.tip];
        cells.push(cell(v !== undefined ? fmt3(v) : "—", "right"));
      }
      if (c.valoareLeiKey && opts.consumLeiViz[c.tip])
        cells.push(cell(fmt2(row.cheltuieli[c.valoareLeiKey] ?? 0), "right"));
    }

    for (const col of movCols) {
      if (col.kind === "chelt" && opts.cheltViz[col.cheltKey!]) {
        const v = row.cheltuieli[col.cheltKey!] ?? 0;
        cells.push(cell(v ? fmt2(v) : "", "right"));
      }
      if (col.kind === "totalLuna" && opts.showTotalLuna)
        cells.push(cell(fmt2(row.totalLuna), "right", true));
    }

    if (coloane.hasRestantaIntretinere && opts.showRestanta) {
      const v = row.restantaIntretinere;
      cells.push(cell(v ? fmt2(v) : "", "right", false, v > 0 ? "#b91c1c" : undefined));
    }

    if (coloane.fonduri.length > 0 && opts.showFonduri) {
      if (opts.fondMode === "total") {
        const v = row.totalFonduri;
        cells.push(cell(v ? fmt2(v) : "", "right", false, v > 0 ? "#b91c1c" : undefined));
      } else {
        for (const f of coloane.fonduri) {
          if (opts.fondViz[f.id] !== false) {
            const v = row.restantaFonduri[f.id] ?? 0;
            cells.push(cell(v ? fmt2(v) : "", "right", false, v > 0 ? "#b91c1c" : undefined));
          }
        }
      }
    }

    cells.push(cell(fmt2(row.total), "right", true));
    return cells;
  });

  // Totals row
  const totRow: any[] = [];
  totRow.push({
    text: `TOTAL (${rows.length} ap.)`,
    colSpan: fixN,
    alignment: "right",
    bold: true,
    fontSize: fs,
    border: [true, true, false, true],
  });
  for (let i = 1; i < fixN; i++) totRow.push({});

  for (const c of coloane.consumuri) {
    if (opts.consumViz[c.tip]) {
      const t = rows.reduce((s, r) => s + (r.consumByTip[c.tip] ?? 0), 0);
      totRow.push({ text: fmt3(t), alignment: "right", bold: true, fontSize: fs });
    }
    if (c.valoareLeiKey && opts.consumLeiViz[c.tip]) {
      const t = rows.reduce((s, r) => s + (r.cheltuieli[c.valoareLeiKey!] ?? 0), 0);
      totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs });
    }
  }

  for (const col of movCols) {
    if (col.kind === "chelt" && opts.cheltViz[col.cheltKey!]) {
      const t = rows.reduce((s, r) => s + (r.cheltuieli[col.cheltKey!] ?? 0), 0);
      totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs });
    }
    if (col.kind === "totalLuna" && opts.showTotalLuna) {
      const t = rows.reduce((s, r) => s + r.totalLuna, 0);
      totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs });
    }
  }

  if (coloane.hasRestantaIntretinere && opts.showRestanta) {
    const t = rows.reduce((s, r) => s + r.restantaIntretinere, 0);
    totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs, color: "#b91c1c" });
  }

  if (coloane.fonduri.length > 0 && opts.showFonduri) {
    if (opts.fondMode === "total") {
      const t = rows.reduce((s, r) => s + r.totalFonduri, 0);
      totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs, color: "#b91c1c" });
    } else {
      for (const f of coloane.fonduri) {
        if (opts.fondViz[f.id] !== false) {
          const t = rows.reduce((s, r) => s + (r.restantaFonduri[f.id] ?? 0), 0);
          totRow.push({ text: fmt2(t), alignment: "right", bold: true, fontSize: fs, color: "#b91c1c" });
        }
      }
    }
  }

  const totTotal = rows.reduce((s, r) => s + r.total, 0);
  totRow.push({ text: fmt2(totTotal), alignment: "right", bold: true, fontSize: fs + 1, fillColor: "#E8E8E8" });

  const body = [hdr, ...dataRows, totRow];

  // Header block
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city].filter(Boolean).join(", ");
  const contact = [
    asoc?.cui   ? `CUI: ${asoc.cui}` : null,
    asoc?.phone ? `Tel: ${asoc.phone}` : null,
    asoc?.email ? `Email: ${asoc.email}` : null,
  ].filter(Boolean).join("   |   ");

  const size = PAGE_SIZES[opts.pageSize] ?? PAGE_SIZES.A4;
  const pageW = opts.orientation === "landscape" ? size.h : size.w;
  const lineW = pageW - pt(opts.marginLeft) - pt(opts.marginRight);

  return {
    pageSize: opts.pageSize,
    pageOrientation: opts.orientation,
    pageMargins: [pt(opts.marginLeft), pt(opts.marginTop), pt(opts.marginRight), pt(opts.marginBottom)],
    content: [
      {
        columns: [
          {
            stack: [
              { text: asoc?.name ?? "", bold: true, fontSize: 13 },
              adresa ? { text: adresa, fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
              contact ? { text: contact, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
            ],
            width: "*",
          },
          {
            stack: [
              { text: "Lista întreținere", fontSize: 9, color: "#666" },
              { text: `${LUNI[luna - 1]} ${an}`, bold: true, fontSize: 10 },
            ],
            width: "auto",
            alignment: "right",
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 6, x2: lineW, y2: 6, lineWidth: 1.5, lineColor: "#222" }],
        margin: [0, 4, 0, 0],
      },
      { text: "LISTĂ ÎNTREȚINERE", style: "title", alignment: "center", margin: [0, 10, 0, 10] },
      {
        table: { headerRows: 1, widths, body },
        layout: {
          fillColor: (rowIdx: number) => {
            if (rowIdx === 0)               return "#DDDDDD";
            if (rowIdx === body.length - 1) return "#EEEEEE";
            return rowIdx % 2 === 1 ? "#F5F5F5" : null;
          },
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => "#999",
          vLineColor: () => "#999",
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 3,
          paddingRight: () => 3,
        },
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [pt(opts.marginLeft), 6, pt(opts.marginRight), 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: lineW, y2: 0, lineWidth: 0.5, lineColor: "#aaa" }] },
        {
          margin: [0, 5, 0, 0],
          columns: [
            {
              stack: [
                { text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 16, x2: 120, y2: 16, lineWidth: 0.5 }] },
                { text: asoc?.adminName ?? "", fontSize: 7, alignment: "center", margin: [0, 3, 0, 0] },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "CENZOR", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 16, x2: 120, y2: 16, lineWidth: 0.5 }] },
                { text: asoc?.cenzorName ?? "", fontSize: 7, alignment: "center", margin: [0, 3, 0, 0] },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" },
                { canvas: [{ type: "line", x1: 10, y1: 16, x2: 120, y2: 16, lineWidth: 0.5 }] },
                { text: asoc?.presedinteName ?? "", fontSize: 7, alignment: "center", margin: [0, 3, 0, 0] },
              ],
              width: "*",
            },
          ],
        },
        { text: `Pagina ${currentPage} din ${pageCount}`, fontSize: 7, alignment: "right", margin: [0, 3, 0, 0] },
      ],
    }),
    styles: { title: { fontSize: 14, bold: true, characterSpacing: 1 } },
    defaultStyle: { font: opts.fontFamily },
  };
}

// ─── Setup pdfmake (cached across calls) ──────────────────────────────────────

async function getPdfMake() {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  const pm = pdfMake.default ?? pdfMake;
  pm.vfs = pdfFonts.default ?? pdfFonts;
  // Add standard PDF fonts without replacing Roboto defaults
  if (!pm.fonts) pm.fonts = {};
  pm.fonts.Helvetica = { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique",  bolditalics: "Helvetica-BoldOblique" };
  pm.fonts.Times     = { normal: "Times-Roman", bold: "Times-Bold", italics: "Times-Italic",         bolditalics: "Times-BoldItalic" };
  pm.fonts.Courier   = { normal: "Courier",    bold: "Courier-Bold", italics: "Courier-Oblique",     bolditalics: "Courier-BoldOblique" };
  return pm;
}

// ─── Checkbox helper ──────────────────────────────────────────────────────────

function ChkRow({ label, checked, onChange, indent }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; indent?: boolean;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      cursor: "pointer", marginBottom: "0.3rem",
      paddingLeft: indent ? "1.25rem" : 0, fontSize: "0.8rem",
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: "#7c3aed", flexShrink: 0 }} />
      <span style={{ color: "#e2e8f0" }}>{label}</span>
    </label>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color: "#94a3b8", marginBottom: "0.5rem",
    }}>
      {children}
    </div>
  );
}

// ─── Main modal component ─────────────────────────────────────────────────────

export default function ListaPlataPdfModal({
  rows, coloane, movCols, fondMode, asociatieId, luna, an, onClose,
}: Props) {
  const [opts, setOpts] = useState<PdfOptions>(() => initOpts(coloane, fondMode, movCols));
  const [asoc, setAsoc] = useState<AsocInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [previewError, setPreviewError] = useState<string | null>(null);
  const genIdRef    = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch association info
  useEffect(() => {
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then(setAsoc)
      .catch(() => {});
  }, [asociatieId]);

  // Generate preview (debounced)
  // pdfmake 0.3.x: getDataUrl() / getBlob() / getBase64() sunt async — returnează Promise, fără callback
  const generatePreview = useCallback(async (currentOpts: PdfOptions, currentAsoc: AsocInfo | null) => {
    const myId = ++genIdRef.current;
    setLoadingPdf(true);
    setPreviewError(null);
    try {
      const pm = await getPdfMake();
      if (myId !== genIdRef.current) return;
      const docDef = buildDocDef(currentOpts, rows, coloane, movCols, currentAsoc, luna, an);
      const dataUrl: string = await pm.createPdf(docDef).getDataUrl();
      if (myId !== genIdRef.current) return;
      setPreviewUrl(dataUrl);
    } catch (e: any) {
      if (myId === genIdRef.current) setPreviewError(e?.message ?? String(e));
    } finally {
      if (myId === genIdRef.current) setLoadingPdf(false);
    }
  }, [rows, coloane, movCols, luna, an]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generatePreview(opts, asoc), 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [opts, asoc, generatePreview]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleDownload() {
    setActionLoading(true);
    try {
      const pm = await getPdfMake();
      const docDef = buildDocDef(opts, rows, coloane, movCols, asoc, luna, an);
      const fileName = `lista-intretinere-${LUNI[luna - 1].toLowerCase()}-${an}.pdf`;
      pm.createPdf(docDef).download(fileName);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePrint() {
    setActionLoading(true);
    try {
      const pm = await getPdfMake();
      const docDef = buildDocDef(opts, rows, coloane, movCols, asoc, luna, an);
      pm.createPdf(docDef).print();
    } finally {
      setActionLoading(false);
    }
  }

  // ── Option updaters ────────────────────────────────────────────────────────

  function upd<K extends keyof PdfOptions>(key: K, val: PdfOptions[K]) {
    setOpts(prev => ({ ...prev, [key]: val }));
  }

  function updMap(key: "consumViz" | "consumLeiViz" | "cheltViz" | "fondViz", subKey: string, val: boolean) {
    setOpts(prev => ({ ...prev, [key]: { ...prev[key], [subKey]: val } }));
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasConsumuri   = coloane.consumuri.length > 0;
  const hasCheltuieli  = coloane.cheltuieli.length > 0;
  const hasFonduri     = coloane.fonduri.length > 0;
  const busy           = loadingPdf || actionLoading;

  const marginKeys: { key: keyof PdfOptions; label: string }[] = [
    { key: "marginLeft",   label: "Stânga" },
    { key: "marginRight",  label: "Dreapta" },
    { key: "marginTop",    label: "Sus" },
    { key: "marginBottom", label: "Jos" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", flexDirection: "column",
      background: "#080A0F",
    }}>
      {/* Top toolbar */}
      <div style={{
        background: "#111820", borderBottom: "1px solid #1E2733",
        padding: "0.625rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f1f5f9" }}>
          Preview PDF — Listă întreținere {LUNI[luna - 1]} {an}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn--secondary"
            onClick={handlePrint}
            disabled={busy}
            style={{ fontSize: "0.8125rem", padding: "0.5rem 1rem" }}
          >
            🖨 Printează
          </button>
          <button
            className="btn btn--primary"
            onClick={handleDownload}
            disabled={busy}
            style={{ fontSize: "0.8125rem", padding: "0.5rem 1rem" }}
          >
            {actionLoading ? "Se generează..." : "⬇ Salvează PDF"}
          </button>
          <button
            className="btn btn--secondary"
            onClick={onClose}
            style={{ fontSize: "0.8125rem", padding: "0.5rem 0.75rem" }}
          >
            ✕ Închide
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{
          width: 272, flexShrink: 0,
          background: "#111820", borderRight: "1px solid #1E2733",
          overflowY: "auto", padding: "1rem",
          color: "#f1f5f9", fontSize: "0.8125rem",
        }}>

          {/* Format pagină */}
          <div style={{ marginBottom: "1.25rem" }}>
            <SectionLabel>Format pagină</SectionLabel>

            {/* Dimensiune hârtie */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.6rem" }}>
              {Object.entries(PAGE_SIZES).map(([key, ps]) => (
                <button
                  key={key}
                  onClick={() => upd("pageSize", key)}
                  className={opts.pageSize === key ? "btn btn--primary" : "btn btn--secondary"}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", minWidth: 44 }}
                >
                  {ps.label}
                </button>
              ))}
            </div>

            {/* Orientare */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["landscape", "portrait"] as const).map(o => (
                <button
                  key={o}
                  onClick={() => upd("orientation", o)}
                  className={opts.orientation === o ? "btn btn--primary" : "btn btn--secondary"}
                  style={{ flex: 1, fontSize: "0.75rem", padding: "0.375rem 0.5rem" }}
                >
                  {o === "landscape" ? "⬌ Peisaj" : "⬍ Portret"}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div style={{ marginBottom: "1.25rem" }}>
            <SectionLabel>Font</SectionLabel>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Caracter</div>
                <select
                  className="input"
                  value={opts.fontFamily}
                  onChange={e => upd("fontFamily", e.target.value)}
                  style={{ width: "100%", fontSize: "0.8rem" }}
                >
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Mărime</div>
                <select
                  className="input"
                  value={opts.fontSize}
                  onChange={e => upd("fontSize", Number(e.target.value))}
                  style={{ width: 64, fontSize: "0.8rem" }}
                >
                  {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Margini */}
          <div style={{ marginBottom: "1.25rem" }}>
            <SectionLabel>Margini (mm)</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              {marginKeys.map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem" }}>{label}</div>
                  <input
                    type="number"
                    className="input"
                    value={opts[key] as number}
                    min={3}
                    max={50}
                    style={{ width: "100%", fontSize: "0.8rem" }}
                    onChange={e => upd(key, Number(e.target.value) || (opts[key] as number))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Coloane */}
          <div>
            <SectionLabel>Coloane în PDF</SectionLabel>

            {coloane.nrPersone && (
              <ChkRow label="Nr. persoane"  checked={opts.showNrPersone}  onChange={v => upd("showNrPersone", v)} />
            )}
            {coloane.cotaParte && (
              <ChkRow label="Cotă parte"    checked={opts.showCotaParte}  onChange={v => upd("showCotaParte", v)} />
            )}
            {coloane.suprafata && (
              <ChkRow label="Suprafață"     checked={opts.showSuprafata}  onChange={v => upd("showSuprafata", v)} />
            )}

            {hasConsumuri && (
              <>
                <div style={{ fontSize: "0.7rem", color: "#64748b", margin: "0.6rem 0 0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Contoare
                </div>
                {coloane.consumuri.map(c => (
                  <div key={c.tip}>
                    <ChkRow
                      label={`${c.label} (${c.unit})`}
                      checked={opts.consumViz[c.tip] !== false}
                      onChange={v => updMap("consumViz", c.tip, v)}
                    />
                    {c.valoareLeiKey && (
                      <ChkRow
                        label={`${c.label} — valoare (lei)`}
                        checked={opts.consumLeiViz[c.tip] !== false}
                        onChange={v => updMap("consumLeiViz", c.tip, v)}
                        indent
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {hasCheltuieli && (
              <>
                <div style={{ fontSize: "0.7rem", color: "#64748b", margin: "0.6rem 0 0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cheltuieli
                </div>
                {movCols.filter(c => c.kind === "chelt").map(col => (
                  <ChkRow
                    key={col.id}
                    label={col.cheltLabel ?? col.id}
                    checked={opts.cheltViz[col.cheltKey!] !== false}
                    onChange={v => updMap("cheltViz", col.cheltKey!, v)}
                  />
                ))}
                {coloane.hasTotalLuna && (
                  <ChkRow
                    label="Total lună"
                    checked={opts.showTotalLuna}
                    onChange={v => upd("showTotalLuna", v)}
                  />
                )}
              </>
            )}

            {coloane.hasRestantaIntretinere && (
              <>
                <div style={{ fontSize: "0.7rem", color: "#64748b", margin: "0.6rem 0 0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Restanțe
                </div>
                <ChkRow
                  label="Restanță întreținere"
                  checked={opts.showRestanta}
                  onChange={v => upd("showRestanta", v)}
                />
              </>
            )}

            {hasFonduri && (
              <>
                {!coloane.hasRestantaIntretinere && (
                  <div style={{ fontSize: "0.7rem", color: "#64748b", margin: "0.6rem 0 0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Fonduri
                  </div>
                )}
                <ChkRow
                  label="Fonduri"
                  checked={opts.showFonduri}
                  onChange={v => upd("showFonduri", v)}
                />
                {opts.showFonduri && (
                  <div style={{ marginLeft: "1.25rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", margin: "0.25rem 0 0.35rem" }}>
                      {(["total", "detaliat"] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => upd("fondMode", m)}
                          className={opts.fondMode === m ? "btn btn--primary" : "btn btn--secondary"}
                          style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                        >
                          {m === "total" ? "Total" : "Detaliat"}
                        </button>
                      ))}
                    </div>
                    {opts.fondMode === "detaliat" && coloane.fonduri.map(f => (
                      <ChkRow
                        key={f.id}
                        label={f.name}
                        checked={opts.fondViz[f.id] !== false}
                        onChange={v => updMap("fondViz", f.id, v)}
                        indent
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Lățimi coloane */}
          <div style={{ marginTop: "0.5rem" }}>
            <SectionLabel>Lățimi coloane (pt)</SectionLabel>
            <div style={{ fontSize: "0.7rem", color: "#475569", marginBottom: "0.5rem" }}>
              Proprietar — lățime automată
            </div>
            {getVisibleColDefs(opts, coloane, movCols).map(col => (
              <div key={col.key} style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                marginBottom: "0.25rem",
              }}>
                <span style={{
                  flex: 1, fontSize: "0.75rem", color: "#cbd5e1",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {col.label}
                </span>
                <input
                  type="number"
                  min={8}
                  max={400}
                  value={opts.colWidths[col.key] ?? col.defaultW}
                  className="input"
                  style={{ width: 54, fontSize: "0.75rem", padding: "0.2rem 0.35rem", textAlign: "right" }}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    if (v >= 8 && v <= 400) {
                      setOpts(prev => ({ ...prev, colWidths: { ...prev.colWidths, [col.key]: v } }));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          flex: 1, background: "#1a1a2e",
          display: "flex", alignItems: "stretch", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {loadingPdf && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 10,
              background: "rgba(8,10,15,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#94a3b8", fontSize: "0.875rem", gap: "0.5rem",
            }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              Se generează preview...
            </div>
          )}

          {previewError ? (
            <div style={{ color: "#f87171", textAlign: "center", alignSelf: "center", padding: "2rem", maxWidth: 420 }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Eroare generare PDF</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", wordBreak: "break-word" }}>{previewError}</div>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Preview PDF"
            />
          ) : !loadingPdf ? (
            <div style={{ color: "#4b5563", textAlign: "center", alignSelf: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📄</div>
              <div>Pregătire preview...</div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
