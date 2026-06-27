"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const LUNI_SCURT = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];

const TIP_LABEL: Record<string, string> = {
  apa_rece: "Apă rece", apa_calda: "Apă caldă", electric: "Electric", gaz: "Gaz",
};
const SURSA_LABEL: Record<string, string> = { manual: "Manual", import: "Import", ai: "AI" };

interface Citire { luna: number; an: number; indexVechi: number; indexNou: number; consum: number; data: string | null; sursa: string; }
interface Contor { contorId: string; tip: string; locatie: string | null; denumire: string | null; numarSerie: string; citiri: Citire[]; totalConsum: number; }
interface ApIstoric { apartamentId: string; numar: string; proprietar: string; contoare: Contor[]; }
interface ApOption { id: string; numar: string; proprietar?: string; }

const fmt2 = (v: number) => v.toFixed(2);

export default function IstoricCitiriClient() {
  const { activeId: asociatieId } = useAsociatie();
  const now = new Date();

  // perioadă implicită: ultimele 12 luni
  const [anEnd,   setAnEnd]   = useState(now.getFullYear());
  const [lunaEnd, setLunaEnd] = useState(now.getMonth() + 1);
  const startDefault = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [anStart,   setAnStart]   = useState(startDefault.getFullYear());
  const [lunaStart, setLunaStart] = useState(startDefault.getMonth() + 1);

  const [apId, setApId] = useState("all");
  const [apOptions, setApOptions] = useState<ApOption[]>([]);

  const [data, setData] = useState<ApIstoric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asoc, setAsoc] = useState<{ name?: string; address?: string | null; city?: string | null } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // info asociație (pentru antet PDF)
  useEffect(() => {
    if (!asociatieId) { setAsoc(null); return; }
    fetch(`/api/asociatii/${asociatieId}`).then(r => r.json()).then(setAsoc).catch(() => setAsoc(null));
  }, [asociatieId]);

  // listă apartamente pentru dropdown
  useEffect(() => {
    if (!asociatieId) { setApOptions([]); return; }
    fetch(`/api/asociatii/${asociatieId}/apartamente`)
      .then(r => r.json())
      .then(d => {
        const list = (d.apartamente ?? []).map((a: any) => ({
          id: a.id, numar: a.numar,
          proprietar: a.proprietari?.[0]?.proprietar
            ? [a.proprietari[0].proprietar.prenume, a.proprietari[0].proprietar.nume].filter(Boolean).join(" ")
            : "",
        }));
        setApOptions(list);
      })
      .catch(() => setApOptions([]));
  }, [asociatieId]);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setData([]); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({
      asociatieId, apartamentId: apId,
      lunaStart: String(lunaStart), anStart: String(anStart),
      lunaEnd: String(lunaEnd), anEnd: String(anEnd),
    });
    try {
      const res = await fetch(`/api/contoare/istoric?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setData(json.apartamente ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, apId, lunaStart, anStart, lunaEnd, anEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCitiri = useMemo(() =>
    data.reduce((s, ap) => s + ap.contoare.reduce((t, c) => t + c.citiri.length, 0), 0), [data]);

  async function handlePdf() {
    if (totalCitiri === 0) return;
    setPdfLoading(true);
    try {
      const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any;
      const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
      (pdfMake.default ?? pdfMake).vfs = pdfFonts.default ?? pdfFonts;

      const perioada = `${LUNI[lunaStart - 1]} ${anStart} — ${LUNI[lunaEnd - 1]} ${anEnd}`;
      const content: any[] = [
        { columns: [
          { stack: [{ text: asoc?.name ?? "", bold: true, fontSize: 13 }, { text: [asoc?.address, asoc?.city].filter(Boolean).join(", "), fontSize: 9, color: "#333" }], width: "*" },
          { stack: [{ text: "Perioada", fontSize: 9, color: "#666" }, { text: perioada, bold: true, fontSize: 10 }], width: "auto", alignment: "right" },
        ] },
        { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1.5, lineColor: "#222" }], margin: [0, 4, 0, 10] },
        { text: "RAPORT INDEX CONTOARE", fontSize: 15, bold: true, alignment: "center", margin: [0, 2, 0, 12] },
      ];

      for (const ap of data) {
        const conts = ap.contoare.filter(c => c.citiri.length > 0);
        if (conts.length === 0) continue;
        content.push({ text: `Ap. ${ap.numar}${ap.proprietar ? " — " + ap.proprietar : ""}`, bold: true, fontSize: 11, margin: [0, 8, 0, 4] });
        for (const c of conts) {
          content.push({ text: `${TIP_LABEL[c.tip] ?? c.tip}${c.denumire ? " · " + c.denumire : ""}${c.numarSerie ? " · serie " + c.numarSerie : ""}  (total: ${fmt2(c.totalConsum)})`, fontSize: 9, color: "#444", margin: [0, 4, 0, 2] });
          const body = [
            [ { text: "Perioadă", style: "th" }, { text: "Index vechi", style: "th", alignment: "right" }, { text: "Index nou", style: "th", alignment: "right" }, { text: "Consum", style: "th", alignment: "right" } ],
            ...[...c.citiri].reverse().map(r => [
              { text: `${LUNI_SCURT[r.luna - 1]} ${r.an}`, fontSize: 8 },
              { text: fmt2(r.indexVechi), alignment: "right", fontSize: 8 },
              { text: fmt2(r.indexNou), alignment: "right", fontSize: 8 },
              { text: fmt2(r.consum), alignment: "right", fontSize: 8, bold: true },
            ]),
          ];
          content.push({ table: { headerRows: 1, widths: ["*", 70, 70, 70], body },
            layout: { fillColor: (r: number) => r === 0 ? "#DDDDDD" : r % 2 === 0 ? "#F5F5F5" : null, hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999", vLineColor: () => "#999", paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4 } });
        }
      }

      const doc = { pageSize: "A4", pageMargins: [30, 40, 30, 40], content, styles: { th: { bold: true, fontSize: 9 } }, defaultStyle: { font: "Roboto" } };
      const pm = pdfMake.default ?? pdfMake;
      pm.createPdf(doc).download(`raport-index-${anStart}-${anEnd}.pdf`);
    } catch (e: any) {
      setError(`Eroare PDF: ${e?.message ?? String(e)}`);
    } finally {
      setPdfLoading(false);
    }
  }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Istoric citiri</h1>
          <p className="page-sub">Citirile contoarelor pe apartament, în perioada selectată</p>
        </div>
        <button className="btn btn--primary" onClick={handlePdf} disabled={pdfLoading || totalCitiri === 0}>
          {pdfLoading ? "Se generează..." : "⬇ Descarcă raport PDF"}
        </button>
      </div>

      {/* Filtre */}
      <div className="lp-controls" style={{ marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Apartament</label>
          <select className="input" style={{ minWidth: "220px" }} value={apId} onChange={e => setApId(e.target.value)}>
            <option value="all">Toate apartamentele</option>
            {apOptions.map(a => (
              <option key={a.id} value={a.id}>Ap. {a.numar}{a.proprietar ? ` — ${a.proprietar}` : ""}</option>
            ))}
          </select>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">De la</label>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <select className="input" value={lunaStart} onChange={e => setLunaStart(parseInt(e.target.value))}>
              {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
            </select>
            <input type="number" className="input" style={{ width: "90px" }} value={anStart} onChange={e => setAnStart(parseInt(e.target.value) || anStart)} min={2000} max={2100} />
          </div>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Până la</label>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <select className="input" value={lunaEnd} onChange={e => setLunaEnd(parseInt(e.target.value))}>
              {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
            </select>
            <input type="number" className="input" style={{ width: "90px" }} value={anEnd} onChange={e => setAnEnd(parseInt(e.target.value) || anEnd)} min={2000} max={2100} />
          </div>
        </div>
        <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>
          {loading ? "..." : "Actualizează"}
        </button>
      </div>

      {error && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {!loading && totalCitiri === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon">📊</span>
          <div className="empty-state__title">Nicio citire în perioada selectată</div>
        </div>
      )}

      {/* Conținut per apartament */}
      {data.map(ap => {
        const hasAny = ap.contoare.some(c => c.citiri.length > 0);
        if (!hasAny) return null;
        return (
          <div key={ap.apartamentId} style={{ marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#e2e8f0", marginBottom: "0.75rem" }}>
              Ap. {ap.numar}{ap.proprietar ? <span style={{ color: "#94a3b8", fontWeight: 500 }}> — {ap.proprietar}</span> : null}
            </div>

            {ap.contoare.filter(c => c.citiri.length > 0).map(c => (
              <div key={c.contorId} style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#a78bfa" }}>{TIP_LABEL[c.tip] ?? c.tip}</span>
                  {c.denumire && <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>· {c.denumire}</span>}
                  {c.numarSerie && <span style={{ color: "#64748b", fontSize: "0.78rem", fontFamily: "monospace" }}>· serie {c.numarSerie}</span>}
                  <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "0.82rem" }}>
                    Total consum: <strong style={{ color: "#a78bfa" }}>{fmt2(c.totalConsum)}</strong>
                  </span>
                </div>
                <div className="table-wrap">
                  <table className="data-table" style={{ fontSize: "0.82rem" }}>
                    <thead>
                      <tr>
                        <th>Perioadă</th>
                        <th style={{ textAlign: "right" }}>Index vechi</th>
                        <th style={{ textAlign: "right" }}>Index nou</th>
                        <th style={{ textAlign: "right" }}>Consum</th>
                        <th style={{ textAlign: "center" }}>Sursă</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...c.citiri].reverse().map(r => (
                        <tr key={`${r.an}-${r.luna}`}>
                          <td style={{ whiteSpace: "nowrap", color: "#cbd5e1" }}>{LUNI_SCURT[r.luna - 1]} {r.an}</td>
                          <td style={{ textAlign: "right", color: "#94a3b8" }}>{fmt2(r.indexVechi)}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#e2e8f0" }}>{fmt2(r.indexNou)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa" }}>{fmt2(r.consum)}</td>
                          <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.72rem" }}>{SURSA_LABEL[r.sursa] ?? r.sursa}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
