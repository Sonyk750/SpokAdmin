"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface ContorRow {
  contorId:   string;
  tip:        string;
  locatie:    string | null;
  denumire:   string | null;
  numarSerie: string;
  indexVechi: string;
  indexNou:   string;
}
interface ApBlock { apartamentId: string; numar: string; proprietar: string; contoare: ContorRow[]; }

const LUNI = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const TIP_LABEL: Record<string, string> = { apa_rece: "Apă rece", apa_calda: "Apă caldă", electric: "Electric", gaz: "Gaz" };
const TIP_ICON: Record<string, string> = { apa_rece: "💧", apa_calda: "🔥", electric: "⚡", gaz: "🔵" };
const LOC_LABEL: Record<string, string> = { bucatarie: "Bucătărie", baie: "Baie", baie_mica: "Baie mică", general: "General", gradina: "Grădină" };

function locText(c: ContorRow) {
  if (c.denumire) return c.denumire;
  if (c.locatie) return LOC_LABEL[c.locatie] ?? c.locatie;
  return "—";
}

function consumOf(c: ContorRow): { val: number; text: string; neg: boolean } {
  const v = parseFloat(c.indexVechi), n = parseFloat(c.indexNou);
  if (isNaN(v) || isNaN(n) || c.indexNou === "") return { val: 0, text: "—", neg: false };
  const cons = n - v;
  return { val: cons, text: cons.toFixed(3), neg: cons < 0 };
}

export default function CitiriClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId, perioadaCurentaLuna, perioadaCurentaAn } = useAsociatie();

  const [luna, setLuna] = useState(defaultLuna);
  const [an,   setAn]   = useState(defaultAn);

  useEffect(() => {
    if (perioadaCurentaLuna && perioadaCurentaAn) {
      setLuna(perioadaCurentaLuna);
      setAn(perioadaCurentaAn);
    }
  }, [perioadaCurentaLuna, perioadaCurentaAn]);
  const [data, setData] = useState<ApBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setData([]); return; }
    setLoading(true); setError(null); setOkMsg(null);
    try {
      const res = await fetch(`/api/contoare/citiri?asociatieId=${asociatieId}&luna=${luna}&an=${an}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      const aps: ApBlock[] = (json.apartamente ?? []).map((ap: any) => ({
        apartamentId: ap.apartamentId, numar: ap.numar, proprietar: ap.proprietar ?? "",
        contoare: ap.contoare.map((c: any) => ({
          contorId: c.contorId, tip: c.tip, locatie: c.locatie, denumire: c.denumire,
          numarSerie: c.numarSerie ?? "",
          indexVechi: c.indexVechi !== null && c.indexVechi !== undefined ? String(c.indexVechi) : "",
          indexNou: c.indexNou !== null && c.indexNou !== undefined ? String(c.indexNou) : "",
        })),
      }));
      setData(aps);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, luna, an]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function update(apIdx: number, cIdx: number, field: keyof ContorRow, val: string) {
    setData(prev => prev.map((ap, i) => i !== apIdx ? ap : {
      ...ap, contoare: ap.contoare.map((c, j) => j !== cIdx ? c : { ...c, [field]: val }),
    }));
    setOkMsg(null);
  }

  const totalContoare = data.reduce((s, ap) => s + ap.contoare.length, 0);
  const completate = data.reduce((s, ap) => s + ap.contoare.filter(c => c.indexNou !== "").length, 0);

  async function handleSave() {
    if (!asociatieId) return;
    setSaving(true); setError(null); setOkMsg(null);
    const citiri = data.flatMap(ap => ap.contoare.map(c => ({
      contorId: c.contorId, numarSerie: c.numarSerie, indexVechi: c.indexVechi, indexNou: c.indexNou,
    })));
    try {
      const res = await fetch("/api/contoare/citiri", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asociatieId, luna, an, citiri }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la salvare");
      setOkMsg(`Salvat — ${json.salvate} citiri pentru ${LUNI[luna - 1]} ${an}.`);
      await fetchData();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Citiri manuale contoare</h1>
          <p className="page-sub">Introdu indexul nou pentru fiecare contor — consumul se calculează automat</p>
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving || totalContoare === 0}>
          {saving ? "Se salvează..." : "💾 Salvează citirile"}
        </button>
      </div>

      <div className="lp-controls" style={{ marginBottom: "1rem" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Luna</label>
          <select className="input" value={luna} onChange={e => setLuna(parseInt(e.target.value))} style={{ minWidth: "150px" }}>
            {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" style={{ width: "100px" }} value={an} min={2000} max={2100} onChange={e => setAn(parseInt(e.target.value) || an)} />
        </div>
        <button className="btn btn--secondary" onClick={fetchData} disabled={loading} style={{ alignSelf: "flex-end" }}>{loading ? "..." : "Actualizează"}</button>
        {totalContoare > 0 && (
          <span className="page-sub" style={{ alignSelf: "flex-end", marginLeft: "auto" }}>
            {completate} / {totalContoare} contoare citite
          </span>
        )}
      </div>

      {error && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {okMsg && <div className="wizard__error" style={{ marginBottom: "1rem", background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)", color: "#4ade80" }}>{okMsg}</div>}

      {totalContoare === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">⏱️</span>
          <div className="empty-state__title">Niciun contor configurat</div>
          <p className="page-sub" style={{ marginTop: "0.5rem" }}>Adaugă contoare în inițializarea asociației (pasul Contoare).</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {data.map((ap, apIdx) => (
            <div key={ap.apartamentId || ap.numar} className="dash-panel" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                Ap. {ap.numar}{ap.proprietar ? <span style={{ color: "#94a3b8", fontWeight: 500 }}> — {ap.proprietar}</span> : ""}
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                  <thead>
                    <tr>
                      <th>Contor</th>
                      <th>Locație</th>
                      <th style={{ width: 130 }}>Serie</th>
                      <th style={{ textAlign: "right", width: 120 }}>Index vechi</th>
                      <th style={{ textAlign: "right", width: 120 }}>Index nou</th>
                      <th style={{ textAlign: "right", width: 100 }}>Consum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ap.contoare.map((c, cIdx) => {
                      const cons = consumOf(c);
                      return (
                        <tr key={c.contorId}>
                          <td style={{ whiteSpace: "nowrap" }}>{TIP_ICON[c.tip] ?? "•"} {TIP_LABEL[c.tip] ?? c.tip}</td>
                          <td style={{ color: "#94a3b8" }}>{locText(c)}</td>
                          <td>
                            <input type="text" className="input input--sm" value={c.numarSerie}
                              onChange={e => update(apIdx, cIdx, "numarSerie", e.target.value)} style={{ width: "120px" }} placeholder="serie" />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input type="number" className="input input--sm" value={c.indexVechi} step="0.001"
                              onChange={e => update(apIdx, cIdx, "indexVechi", e.target.value)} style={{ width: "108px", textAlign: "right" }} />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input type="number" className="input input--sm" value={c.indexNou} step="0.001"
                              onChange={e => update(apIdx, cIdx, "indexNou", e.target.value)} style={{ width: "108px", textAlign: "right" }} placeholder="—" />
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: cons.neg ? "#f87171" : cons.text === "—" ? "#475569" : "#4ade80" }}>
                            {cons.neg ? `⚠ ${cons.text}` : cons.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Se salvează..." : "💾 Salvează citirile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
