"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Linie {
  label:        string;
  facturaNumar: string;
  facturaData:  string | null;
  suma:         number;
  divizor:      number | null;
  unitate:      string;
  perUnit:      number | null;
}
interface Sectiune { key: string; titlu: string; linii: Linie[]; subtotal: number; }
interface Data {
  asociatie: { id: string; name: string };
  luna:      number;
  an:        number;
  sectiuni:  Sectiune[];
  total:     number;
}
interface Banca { name: string; iban?: string; }
interface AsocInfo {
  name: string; address: string | null; city: string | null; sector: string | null;
  cui: string | null; phone: string | null; email: string | null; banci: Banca[];
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

// Format românesc: "2 734,38" (spațiu mii, virgulă zecimală).
function fmtNr(v: number, dec = 2): string {
  const s = v.toFixed(dec);
  const [int, frac] = s.split(".");
  const intSp = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac != null ? `${intSp},${frac}` : intSp;
}
// Divizorul: persoane / apartamente = întreg; restul = 2 zecimale.
function fmtDiv(l: Linie): string {
  if (l.divizor == null) return "Valori individuale";
  const intDiv = l.unitate === "Lei / pers" || l.unitate === "Lei / ap";
  return fmtNr(l.divizor, intDiv ? 0 : 2);
}
function fmtDateIso(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// ─── pdfmake (lazy, cached) ────────────────────────────────────────────────────

async function getPdfMake() {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  const pm = pdfMake.default ?? pdfMake;
  pm.vfs = pdfFonts.default ?? pdfFonts;
  return pm;
}

function buildDocDef(data: Data, asoc: AsocInfo | null) {
  const adresa = [asoc?.address, asoc?.sector ? `Sector ${asoc.sector}` : null, asoc?.city]
    .filter(Boolean).join(", ");
  const banca = asoc?.banci?.[0];
  const contact = [
    asoc?.cui   ? `CUI: ${asoc.cui}`     : null,
    asoc?.phone ? `Tel: ${asoc.phone}`   : null,
    asoc?.email ? `Email: ${asoc.email}` : null,
  ].filter(Boolean).join("   |   ");
  const bancaLine = banca ? [banca.name, banca.iban].filter(Boolean).join(": ") : "";

  const head = [
    { text: "Cheltuiala",         style: "th" },
    { text: "Numărul\nfacturii",  style: "th", alignment: "center" },
    { text: "Data\nfacturii",     style: "th", alignment: "center" },
    { text: "Suma\n(lei)",        style: "th", alignment: "right" },
    { text: "Împărțită\nla",      style: "th", alignment: "right" },
    { text: "Valoare pe\nunitate", style: "th", alignment: "right" },
  ];

  const body: any[][] = [head];

  for (const sect of data.sectiuni) {
    body.push([
      { text: sect.titlu, bold: true, fontSize: 8, colSpan: 3, fillColor: "#E4E4E4" }, {}, {},
      { text: fmtNr(sect.subtotal), bold: true, fontSize: 8, alignment: "right", fillColor: "#E4E4E4" },
      { text: "", fillColor: "#E4E4E4" },
      { text: "", fillColor: "#E4E4E4" },
    ]);
    for (const l of sect.linii) {
      body.push([
        { text: l.label, fontSize: 8, margin: [8, 0, 0, 0] },
        { text: l.facturaNumar, fontSize: 8, alignment: "center", color: "#444" },
        { text: fmtDateIso(l.facturaData), fontSize: 8, alignment: "center", color: "#444" },
        { text: fmtNr(l.suma), fontSize: 8, alignment: "right" },
        { text: fmtDiv(l), fontSize: 8, alignment: "right", color: "#444" },
        { text: l.perUnit != null ? `${fmtNr(l.perUnit)} ${l.unitate}` : "", fontSize: 8, alignment: "right" },
      ]);
    }
  }

  body.push([
    { text: "TOTAL CHELTUIELI", bold: true, fontSize: 9, colSpan: 3, alignment: "right",
      border: [true, true, false, true] }, {}, {},
    { text: fmtNr(data.total), bold: true, fontSize: 9, alignment: "right" },
    { text: "", border: [false, true, false, true] },
    { text: "", border: [false, true, true, true] },
  ]);

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 40, 30, 70],
    content: [
      {
        columns: [
          {
            stack: [
              { text: asoc?.name ?? data.asociatie.name, bold: true, fontSize: 13 },
              adresa    ? { text: adresa,    fontSize: 9, color: "#333", margin: [0, 2, 0, 0] } : {},
              contact   ? { text: contact,   fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
              bancaLine ? { text: bancaLine, fontSize: 8, color: "#555", margin: [0, 2, 0, 0] } : {},
            ],
            width: "*",
          },
          {
            stack: [
              { text: "Perioada", fontSize: 9, color: "#666" },
              { text: `${LUNI[data.luna - 1]} ${data.an}`, bold: true, fontSize: 10 },
            ],
            width: "auto",
            alignment: "right",
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 535, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 0] },
      { text: "EXPLICAȚIILE CHELTUIELILOR", style: "title", alignment: "center", margin: [0, 14, 0, 14] },
      {
        table: { headerRows: 1, widths: ["*", 58, 52, 56, 60, 78], body },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#DDDDDD" : rowIndex % 2 === 1 ? "#F5F5F5" : null,
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
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 0.5, lineColor: "#aaa" }] },
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
    defaultStyle: { font: "Roboto", fontSize: 8 },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExplicatiiClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId, perioadaCurentaLuna, perioadaCurentaAn } = useAsociatie();

  const [luna, setLuna] = useState(defaultLuna);
  const [an,   setAn]   = useState(defaultAn);
  const [data,    setData]    = useState<Data | null>(null);
  const [asoc,    setAsoc]    = useState<AsocInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (perioadaCurentaLuna && perioadaCurentaAn) {
      setLuna(perioadaCurentaLuna);
      setAn(perioadaCurentaAn);
    }
  }, [perioadaCurentaLuna, perioadaCurentaAn]);

  // Info asociație pentru antet/semnături PDF
  useEffect(() => {
    if (!asociatieId) return;
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(setAsoc).catch(() => {});
  }, [asociatieId]);

  const genereaza = useCallback(async () => {
    if (!asociatieId) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/explicatii-lista?asociatieId=${asociatieId}&luna=${luna}&an=${an}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asociatieId, luna, an]);

  // Auto-generează la prima încărcare
  const autoGenDone = useRef(false);
  useEffect(() => {
    if (!asociatieId || autoGenDone.current) return;
    autoGenDone.current = true;
    genereaza();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asociatieId]);

  // Sumar
  const linii    = data ? data.sectiuni.flatMap(s => s.linii) : [];
  const nrLinii  = linii.length;
  const nrFacturi = new Set(linii.map(l => l.facturaNumar).filter(Boolean)).size;

  async function descarcaPdf() {
    if (!data) return;
    setPdfBusy(true);
    try {
      const pm = await getPdfMake();
      pm.createPdf(buildDocDef(data, asoc)).download(`explicatii-lista-${LUNI[luna - 1].toLowerCase()}-${an}.pdf`);
    } finally { setPdfBusy(false); }
  }
  async function tiparestePdf() {
    if (!data) return;
    setPdfBusy(true);
    try {
      const pm = await getPdfMake();
      pm.createPdf(buildDocDef(data, asoc)).print();
    } finally { setPdfBusy(false); }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Explicații listă</h1>
          <p className="page-sub">
            Cum s-au calculat cheltuielile lunii — factură, sumă, bază de împărțire și valoare pe unitate
          </p>
        </div>
        {data && data.sectiuni.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn btn--secondary" onClick={tiparestePdf} disabled={pdfBusy}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={descarcaPdf} disabled={pdfBusy}>
              {pdfBusy ? "Se generează..." : "⬇ Descarcă PDF"}
            </button>
          </div>
        )}
      </div>

      {!asociatieId && (
        <div className="wizard__error" style={{ marginBottom: "1.25rem" }}>
          Selectează o asociație din antetul paginii.
        </div>
      )}

      <div className="lp-controls">
        <div className="form-field">
          <label className="form-field__label">Luna</label>
          <select className="input" value={luna} onChange={e => setLuna(parseInt(e.target.value))}>
            {LUNI.map((l, i) => {
              const m = i + 1;
              const viitoare = perioadaCurentaLuna != null && perioadaCurentaAn != null &&
                (an > perioadaCurentaAn || (an === perioadaCurentaAn && m > perioadaCurentaLuna));
              if (viitoare) return null;
              return <option key={m} value={m}>{l}</option>;
            })}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" value={an} min={2000} max={perioadaCurentaAn ?? 2100}
            style={{ width: "90px" }}
            onChange={e => setAn(parseInt(e.target.value) || an)} />
        </div>
        <button className="btn btn--primary" onClick={genereaza} disabled={loading || !asociatieId}
          style={{ alignSelf: "flex-end" }}>
          {loading ? "Se generează..." : "Generează"}
        </button>
      </div>

      {error && <div className="wizard__error">{error}</div>}

      {!data && !loading && (
        <div className="dash-panel">
          <div className="dash-panel__empty">Selectează luna, apoi apasă <strong>Generează</strong>.</div>
        </div>
      )}

      {data && data.sectiuni.length === 0 && !loading && (
        <div className="empty-state">
          <span className="empty-state__icon">🧾</span>
          <div className="empty-state__title">
            Nicio cheltuială distribuită în {LUNI[data.luna - 1]} {data.an}
          </div>
          <div className="empty-state__desc">Distribuie facturile lunii în secțiunea Facturi.</div>
        </div>
      )}

      {data && data.sectiuni.length > 0 && (
        <>
          {/* Summary */}
          <div className="dash-panel" style={{ marginBottom: "1rem", padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <div style={sumLabel}>Total cheltuieli</div>
              <div style={{ ...sumVal, color: "#a78bfa" }}>{fmtNr(data.total)} lei</div>
            </div>
            <div>
              <div style={sumLabel}>Cheltuieli</div>
              <div style={{ ...sumVal, color: "#22d3ee" }}>{nrLinii}</div>
            </div>
            <div>
              <div style={sumLabel}>Facturi</div>
              <div style={{ ...sumVal, color: "#4ade80" }}>{nrFacturi}</div>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th>Cheltuiala</th>
                  <th style={{ textAlign: "center" }}>Numărul facturii</th>
                  <th style={{ textAlign: "center" }}>Data facturii</th>
                  <th style={{ textAlign: "right" }}>Suma</th>
                  <th style={{ textAlign: "right" }}>Împărțită la</th>
                  <th style={{ textAlign: "right" }}>Valoare pe unitate</th>
                </tr>
              </thead>
              <tbody>
                {data.sectiuni.map(sect => (
                  <React.Fragment key={sect.key}>
                    <tr style={{ background: "rgba(124,58,237,0.12)" }}>
                      <td colSpan={3} style={{ fontWeight: 700, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.72rem" }}>
                        {sect.titlu}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#c4b5fd", whiteSpace: "nowrap" }}>{fmtNr(sect.subtotal)}</td>
                      <td colSpan={2} style={{ background: "rgba(124,58,237,0.12)" }} />
                    </tr>
                    {sect.linii.map((l, i) => (
                      <tr key={`${sect.key}-${i}`}>
                        <td style={{ paddingLeft: "1.5rem", color: "#e2e8f0" }}>{l.label}</td>
                        <td style={{ textAlign: "center", fontWeight: 600, color: "#a78bfa", whiteSpace: "nowrap" }}>{l.facturaNumar}</td>
                        <td style={{ textAlign: "center", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDateIso(l.facturaData)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap" }}>{fmtNr(l.suma)}</td>
                        <td style={{ textAlign: "right", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDiv(l)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#22d3ee", whiteSpace: "nowrap" }}>
                          {l.perUnit != null ? `${fmtNr(l.perUnit)} ${l.unitate}` : ""}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 800, color: "#94a3b8", textAlign: "right" }}>TOTAL CHELTUIELI</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#a78bfa", whiteSpace: "nowrap" }}>{fmtNr(data.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const sumLabel: React.CSSProperties = {
  fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem",
};
const sumVal: React.CSSProperties = { fontSize: "1.25rem", fontWeight: 800 };
