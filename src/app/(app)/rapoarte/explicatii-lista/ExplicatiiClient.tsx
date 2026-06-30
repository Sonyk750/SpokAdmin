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
  cui: string | null; banci: Banca[];
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
  const bancaLine = banca ? [banca.name, banca.iban].filter(Boolean).join(": ") : "";

  const head = [
    { text: "Cheltuiala", bold: true },
    { text: "Numărul facturii", bold: true, alignment: "center" },
    { text: "Data facturii", bold: true, alignment: "center" },
    { text: "Suma", bold: true, alignment: "right" },
    { text: "Împărțită la", bold: true, alignment: "right" },
    { text: "Valoare pe unitate", bold: true, alignment: "right" },
  ];

  const body: any[] = [head];

  for (const sect of data.sectiuni) {
    body.push([
      { text: sect.titlu, bold: true, colSpan: 3, fillColor: "#E4E4E4" }, {}, {},
      { text: fmtNr(sect.subtotal), bold: true, alignment: "right", fillColor: "#E4E4E4" },
      { text: "", fillColor: "#E4E4E4" },
      { text: "", fillColor: "#E4E4E4" },
    ]);
    for (const l of sect.linii) {
      body.push([
        { text: l.label, margin: [8, 0, 0, 0] },
        { text: l.facturaNumar, alignment: "center", color: "#444" },
        { text: fmtDateIso(l.facturaData), alignment: "center", color: "#444" },
        { text: fmtNr(l.suma), alignment: "right" },
        { text: fmtDiv(l), alignment: "right", color: "#444" },
        { text: l.perUnit != null ? `${fmtNr(l.perUnit)} ${l.unitate}` : "", alignment: "right" },
      ]);
    }
  }

  body.push([
    { text: "TOTAL CHELTUIELI", bold: true, colSpan: 3, fillColor: "#CFCFCF" }, {}, {},
    { text: fmtNr(data.total), bold: true, alignment: "right", fillColor: "#CFCFCF" },
    { text: "", fillColor: "#CFCFCF" },
    { text: "", fillColor: "#CFCFCF" },
  ]);

  return {
    pageSize: "A4",
    pageMargins: [32, 36, 32, 70],
    content: [
      { text: asoc?.name ?? data.asociatie.name, bold: true, fontSize: 12 },
      adresa ? { text: adresa, fontSize: 9, margin: [0, 1, 0, 0] } : {},
      asoc?.cui ? { text: `Cod fiscal: ${asoc.cui}`, fontSize: 9, margin: [0, 1, 0, 0] } : {},
      bancaLine ? { text: bancaLine, fontSize: 9, margin: [0, 1, 0, 0] } : {},
      {
        text: `Explicațiile cheltuielilor pe luna ${LUNI[data.luna - 1]} ${data.an}`,
        bold: true, fontSize: 12, alignment: "center", margin: [0, 12, 0, 8],
      },
      {
        table: { headerRows: 1, widths: ["*", 72, 56, 60, 64, 80], body },
        layout: {
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => "#999",
          vLineColor: () => "#999",
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
      },
    ],
    footer: () => ({
      margin: [32, 8, 32, 0],
      columns: [
        { stack: [
          { text: "PREȘEDINTE", bold: true, fontSize: 8, alignment: "center" },
          { text: asoc?.presedinteName ?? "", fontSize: 8, alignment: "center", margin: [0, 10, 0, 0] },
        ], width: "*" },
        { stack: [
          { text: "ADMINISTRATOR", bold: true, fontSize: 8, alignment: "center" },
          { text: asoc?.adminName ?? "", fontSize: 8, alignment: "center", margin: [0, 10, 0, 0] },
        ], width: "*" },
        { stack: [
          { text: "CENZOR", bold: true, fontSize: 8, alignment: "center" },
          { text: asoc?.cenzorName ?? "", fontSize: 8, alignment: "center", margin: [0, 10, 0, 0] },
        ], width: "*" },
      ],
    }),
    defaultStyle: { fontSize: 9 },
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
