"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

interface Sub { label: string; valoare: number; }
interface Detaliu { label: string; valoare: number; sub?: Sub[]; }
interface Rand { nr: number; label: string; valoare: number; detalii: Detaliu[]; }
interface Asoc {
  name: string; address: string | null; city: string | null; sector: string | null; cui: string | null;
  bank: string | null; iban: string | null;
  adminName: string | null; presedinteName: string | null; cenzorName: string | null;
}
interface Raport { asoc: Asoc; data: string; activ: Rand[]; pasiv: Rand[]; totalActiv: number; totalPasiv: number; }

const fmt2 = (v: number) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LUNI = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
function dataLunga(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${LUNI[d.getMonth()]} ${d.getFullYear()}`;
}
function adresaLinie(a: Asoc) {
  return [a.address, a.sector ? `Sect. ${a.sector}` : null, a.city].filter(Boolean).join(" ");
}
function bancaLinie(a: Asoc) {
  if (!a.iban && !a.bank) return "";
  return [a.iban ? `IBAN: ${a.iban}` : null, a.bank ? `Banca: ${a.bank}` : null].filter(Boolean).join("  ");
}

// Aplatizează detaliile unui rând în linii cu indentare (1 = element, 2 = sub-element).
interface Linie { label: string; valoare: number; indent: 1 | 2; }
function flatten(detalii: Detaliu[]): Linie[] {
  const out: Linie[] = [];
  for (const d of detalii) {
    out.push({ label: d.label, valoare: d.valoare, indent: 1 });
    for (const s of d.sub ?? []) out.push({ label: s.label, valoare: s.valoare, indent: 2 });
  }
  return out;
}

// ─── PDF (pdfmake) ───────────────────────────────────────────────────────────────
async function downloadPdf(rap: Raport, detaliat: boolean) {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
  (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;
  const a = rap.asoc;

  const num = (v: number) => ({ text: fmt2(v), alignment: "right", noWrap: true });
  const body: any[][] = [[
    { text: "Nr.", style: "th", alignment: "center" }, { text: "Element de activ", style: "th" }, { text: "Valori (Lei)", style: "th", alignment: "right" },
    { text: "Nr.", style: "th", alignment: "center" }, { text: "Element de pasiv", style: "th" }, { text: "Valori (Lei)", style: "th", alignment: "right" },
  ]];

  for (let i = 0; i < rap.activ.length; i++) {
    const A = rap.activ[i], P = rap.pasiv[i];
    body.push([
      { text: String(A.nr), alignment: "center", bold: true, fontSize: 8 }, { text: A.label, fontSize: 8 }, { ...num(A.valoare), bold: true, fontSize: 8 },
      { text: String(P.nr), alignment: "center", bold: true, fontSize: 8 }, { text: P.label, fontSize: 8 }, { ...num(P.valoare), bold: true, fontSize: 8 },
    ]);
    if (detaliat) {
      const la = flatten(A.detalii), lp = flatten(P.detalii);
      for (let k = 0; k < Math.max(la.length, lp.length); k++) {
        const x = la[k], y = lp[k];
        body.push([
          {}, x ? { text: x.label, fontSize: 7.5, color: "#333", margin: [x.indent === 2 ? 16 : 8, 0, 0, 0] } : {}, x ? { ...num(x.valoare), fontSize: 7.5, color: "#333" } : {},
          {}, y ? { text: y.label, fontSize: 7.5, color: "#333", margin: [y.indent === 2 ? 16 : 8, 0, 0, 0] } : {}, y ? { ...num(y.valoare), fontSize: 7.5, color: "#333" } : {},
        ]);
      }
    }
  }
  body.push([
    {}, { text: "TOTAL PARTEA I:", bold: true, fontSize: 9, alignment: "right" }, { text: fmt2(rap.totalActiv), bold: true, fontSize: 9, alignment: "right" },
    {}, { text: "TOTAL PARTEA II:", bold: true, fontSize: 9, alignment: "right" }, { text: fmt2(rap.totalPasiv), bold: true, fontSize: 9, alignment: "right" },
  ]);

  const doc: any = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 30, 28, 36],
    content: [
      { text: a.name, bold: true, fontSize: 12, alignment: "center" },
      { text: adresaLinie(a), fontSize: 9, alignment: "center", color: "#333" },
      { text: a.cui ? `Cod fiscal: ${a.cui}` : "", fontSize: 9, alignment: "center", color: "#333" },
      { text: bancaLinie(a), fontSize: 9, alignment: "center", color: "#333", margin: [0, 0, 0, 8] },
      { text: `Situaţia soldurilor elementelor de activ şi pasiv  ${dataLunga(rap.data)}`, bold: true, fontSize: 11, alignment: "center", margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: [18, "*", 72, 18, "*", 72], body }, layout: {
        fillColor: (r: number) => r === 0 ? "#e8e8e8" : null,
        hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => "#888", vLineColor: () => "#888",
        paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 3, paddingRight: () => 3,
      } },
      { columns: [
        { text: `Preşedinte: ${a.presedinteName ?? ""}`, fontSize: 9, alignment: "left" },
        { text: `Cenzor: ${a.cenzorName ?? ""}`, fontSize: 9, alignment: "center" },
        { text: `Administrator: ${a.adminName ?? ""}`, fontSize: 9, alignment: "right" },
      ], margin: [0, 16, 0, 0] },
    ],
    styles: { th: { bold: true, fontSize: 8.5 } },
    defaultStyle: { font: "Roboto" },
  };
  const pm = pdfMake.default ?? pdfMake;
  pm.createPdf(doc).download(`situatia-activ-pasiv-${rap.data}.pdf`);
}

// ─── Tabel HTML reutilizat (ecran + print) ───────────────────────────────────────
function TabelDoc({ rap, detaliat, print }: { rap: Raport; detaliat: boolean; print?: boolean }) {
  const td: React.CSSProperties = print
    ? { border: "1px solid #999", padding: "2pt 4pt", verticalAlign: "top" }
    : { border: "1px solid #334155", padding: "4px 8px", verticalAlign: "top" };
  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  const th: React.CSSProperties = { ...td, background: print ? "#e8e8e8" : "#1e293b", fontWeight: 700, textAlign: "center" };
  const detLabel = (l: Linie): React.CSSProperties => ({ ...td, paddingLeft: (l.indent === 2 ? 22 : 12) + (print ? 0 : 0), color: print ? "#333" : "#94a3b8", fontSize: print ? "8pt" : "0.78rem" });
  const detNum = (): React.CSSProperties => ({ ...td, ...num, color: print ? "#333" : "#94a3b8", fontSize: print ? "8pt" : "0.78rem" });

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < rap.activ.length; i++) {
    const A = rap.activ[i], P = rap.pasiv[i];
    rows.push(
      <tr key={`m${i}`}>
        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{A.nr}</td>
        <td style={td}>{A.label}</td>
        <td style={{ ...td, ...num, fontWeight: 700 }}>{fmt2(A.valoare)}</td>
        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{P.nr}</td>
        <td style={td}>{P.label}</td>
        <td style={{ ...td, ...num, fontWeight: 700 }}>{fmt2(P.valoare)}</td>
      </tr>,
    );
    if (detaliat) {
      const la = flatten(A.detalii), lp = flatten(P.detalii);
      for (let k = 0; k < Math.max(la.length, lp.length); k++) {
        const x = la[k], y = lp[k];
        rows.push(
          <tr key={`d${i}-${k}`}>
            <td style={td} />
            <td style={x ? detLabel(x) : td}>{x?.label ?? ""}</td>
            <td style={x ? detNum() : td}>{x ? fmt2(x.valoare) : ""}</td>
            <td style={td} />
            <td style={y ? detLabel(y) : td}>{y?.label ?? ""}</td>
            <td style={y ? detNum() : td}>{y ? fmt2(y.valoare) : ""}</td>
          </tr>,
        );
      }
    }
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: print ? "8.5pt" : "0.82rem" }}>
      <thead>
        <tr>
          <th style={th}>Nr.</th><th style={th}>Element de activ</th><th style={th}>Valori (Lei)</th>
          <th style={th}>Nr.</th><th style={th}>Element de pasiv</th><th style={th}>Valori (Lei)</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
      <tfoot>
        <tr>
          <td style={td} /><td style={{ ...td, textAlign: "right", fontWeight: 800 }}>TOTAL PARTEA I:</td><td style={{ ...td, ...num, fontWeight: 800 }}>{fmt2(rap.totalActiv)}</td>
          <td style={td} /><td style={{ ...td, textAlign: "right", fontWeight: 800 }}>TOTAL PARTEA II:</td><td style={{ ...td, ...num, fontWeight: 800 }}>{fmt2(rap.totalPasiv)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function SituatiaActivPasivClient({ defaultDate }: { defaultDate: string }) {
  const { activeId: asociatieId } = useAsociatie();
  const [data, setData] = useState(defaultDate);
  const [detaliat, setDetaliat] = useState(false);
  const [rap, setRap] = useState<Raport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setRap(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/rapoarte/situatia-activ-pasiv?asociatieId=${asociatieId}&data=${data}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRap(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, data]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handlePdf() {
    if (!rap) return;
    setPdfLoading(true); setError(null);
    try { await downloadPdf(rap, detaliat); }
    catch (e: any) { setError(`Eroare PDF: ${e?.message ?? String(e)}`); }
    finally { setPdfLoading(false); }
  }

  if (!asociatieId) return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;

  const a = rap?.asoc;
  const echilibrat = rap ? Math.abs(rap.totalActiv - rap.totalPasiv) < 0.011 : true;

  return (
    <>
      <style>{`
        @media print { @page { size: A4 landscape; margin: 10mm; } body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: fixed; inset: 0; background: #fff; color: #000; font-family: "Times New Roman", serif; } }
        @media screen { #print-zone { display: none !important; } }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Situaţia activ / pasiv</h1>
            <p className="page-sub">Situaţia soldurilor elementelor de activ şi pasiv (Legea 196/2018)</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn--secondary" onClick={() => window.print()} disabled={!rap}>🖨 Printează</button>
            <button className="btn btn--primary" onClick={handlePdf} disabled={!rap || pdfLoading}>{pdfLoading ? "Se generează..." : "⬇ Descarcă PDF"}</button>
          </div>
        </div>

        <div className="lp-controls" style={{ marginBottom: "1rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">La data</label>
            <RoDate className="input" value={data} onChange={v => setData(v)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Formă</label>
            <div style={{ display: "inline-flex", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
              <button type="button" onClick={() => setDetaliat(false)} className="btn"
                style={{ borderRadius: 0, background: !detaliat ? "#7c3aed" : "transparent", color: !detaliat ? "#fff" : "#94a3b8" }}>Restrânsă</button>
              <button type="button" onClick={() => setDetaliat(true)} className="btn"
                style={{ borderRadius: 0, background: detaliat ? "#7c3aed" : "transparent", color: detaliat ? "#fff" : "#94a3b8" }}>Detaliată</button>
            </div>
          </div>
          <button className="btn btn--secondary" onClick={fetchData} disabled={loading}>{loading ? "..." : "Actualizează"}</button>
        </div>

        {error && <div className="wizard__error">{error}</div>}
        {rap && !echilibrat && (
          <div className="wizard__error" style={{ background: "rgba(251,191,36,0.12)", borderColor: "#fbbf24", color: "#fbbf24" }}>
            ⚠ Cele două părţi nu se echilibrează exact (diferenţa e absorbită la rândul &bdquo;Diferenţe din rotunjiri&rdquo;). O diferenţă mare semnalează o inconsistenţă în date.
          </div>
        )}
      </div>

      {rap && a && (
        <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#e2e8f0" }}>{a.name}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{adresaLinie(a)}</div>
            {a.cui && <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Cod fiscal: {a.cui}</div>}
            {bancaLinie(a) && <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{bancaLinie(a)}</div>}
            <div style={{ fontWeight: 700, marginTop: "0.5rem", color: "#cbd5e1" }}>
              Situaţia soldurilor elementelor de activ şi pasiv — {dataLunga(rap.data)}
            </div>
          </div>
          <TabelDoc rap={rap} detaliat={detaliat} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", color: "#cbd5e1", fontSize: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ flex: 1, textAlign: "left" }}>Preşedinte: {a.presedinteName ?? "—"}</div>
            <div style={{ flex: 1, textAlign: "center" }}>Cenzor: {a.cenzorName ?? "—"}</div>
            <div style={{ flex: 1, textAlign: "right" }}>Administrator: {a.adminName ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Print zone — documentul oficial */}
      {rap && a && (
        <div id="print-zone" style={{ padding: "0" }}>
          <div style={{ textAlign: "center", marginBottom: "8pt" }}>
            <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{a.name}</div>
            <div style={{ fontSize: "9pt" }}>{adresaLinie(a)}</div>
            {a.cui && <div style={{ fontSize: "9pt" }}>Cod fiscal: {a.cui}</div>}
            {bancaLinie(a) && <div style={{ fontSize: "9pt" }}>{bancaLinie(a)}</div>}
            <div style={{ fontWeight: "bold", fontSize: "11pt", marginTop: "8pt" }}>
              Situaţia soldurilor elementelor de activ şi pasiv {dataLunga(rap.data)}
            </div>
          </div>
          <TabelDoc rap={rap} detaliat={detaliat} print />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "18pt", fontSize: "9pt" }}>
            <div style={{ flex: 1, textAlign: "left" }}>Preşedinte: {a.presedinteName ?? ""}</div>
            <div style={{ flex: 1, textAlign: "center" }}>Cenzor: {a.cenzorName ?? ""}</div>
            <div style={{ flex: 1, textAlign: "right" }}>Administrator: {a.adminName ?? ""}</div>
          </div>
        </div>
      )}
    </>
  );
}
