"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConturCol {
  tip:           string;
  label:         string;
  unit:          string;
  valoareLeiKey: string | null; // cheltuiala key that represents lei value for this consum
}
interface FondCol       { id: string; name: string; }
interface CheltuialaCol { key: string; label: string; criteriu: string | null; }

interface Coloane {
  nrPersone:              boolean;
  cotaParte:              boolean;
  suprafata:              boolean;
  consumuri:              ConturCol[];
  cheltuieli:             CheltuialaCol[];
  hasRestantaIntretinere: boolean;
  fonduri:                FondCol[];
  hasTotalLuna:           boolean;
}

interface Row {
  apartamentId:        string;
  numar:               string;
  proprietar:          string;
  nrPersone:           number;
  cotaParte:           number | null;
  suprafata:           number | null;
  consumByTip:         Record<string, number>;
  cheltuieli:          Record<string, number>;
  totalLuna:           number;
  restantaIntretinere: number;
  totalFonduri:        number;
  restantaFonduri:     Record<string, number>;
  total:               number;
}

interface ListaData {
  asociatie: { id: string; name: string };
  luna:      number;
  an:        number;
  coloane:   Coloane;
  rows:      Row[];
}

type FondMode = "total" | "detaliat";

// ─── Moveable columns (only cheltuiala + totalLuna) ────────────────────────

type MovColKind = "chelt" | "totalLuna";

interface MovCol {
  id:             string;
  kind:           MovColKind;
  cheltKey?:      string;
  cheltLabel?:    string;
  cheltCriteriu?: string | null;
}

const CRITERIU_ORDER: Record<string, number> = {
  egal: 0, persoane: 1, cota_parte: 2, suprafata: 3, consum: 4, manual: 5,
};

function buildMovCols(coloane: Coloane): MovCol[] {
  const cols: MovCol[] = [];
  // Sort cheltuiala columns by criterion
  const sorted = [...coloane.cheltuieli].sort((a, b) =>
    (CRITERIU_ORDER[a.criteriu ?? ""] ?? 99) - (CRITERIU_ORDER[b.criteriu ?? ""] ?? 99)
  );
  for (const c of sorted) {
    cols.push({ id: `chelt:${c.key}`, kind: "chelt", cheltKey: c.key, cheltLabel: c.label, cheltCriteriu: c.criteriu });
  }
  if (coloane.hasTotalLuna) cols.push({ id: "totalLuna", kind: "totalLuna" });
  return cols;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const CRITERIU_LABELS: Record<string, string> = {
  egal:       "Egal",
  persoane:   "Nr. persoane",
  cota_parte: "Cotă parte",
  suprafata:  "Suprafață",
  consum:     "Consum",
  manual:     "Manual",
};

const fmt2 = (v: number) => v.toFixed(2);
const fmt3 = (v: number) => v.toFixed(3);
const fmt4 = (v: number) => v.toFixed(4);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ListaPlataClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId } = useAsociatie();

  const [luna,     setLuna]     = useState(defaultLuna);
  const [an,       setAn]       = useState(defaultAn);
  const [fondMode, setFondMode] = useState<FondMode>("detaliat");
  const [data,     setData]     = useState<ListaData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Draggable column state (cheltuiala + totalLuna only) ──────────────────
  const [movCols,     setMovCols]     = useState<MovCol[]>([]);
  const dragIdx                        = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Rebuild movCols when data changes; try to restore saved order from localStorage
  useEffect(() => {
    if (!data || !asociatieId) return;
    const fresh = buildMovCols(data.coloane);
    const key   = `lp-col-order:${asociatieId}`;
    try {
      const savedIds: string[] = JSON.parse(localStorage.getItem(key) ?? "null") ?? [];
      const saved    = savedIds.map(id => fresh.find(c => c.id === id)).filter((c): c is MovCol => !!c);
      const newCols  = fresh.filter(c => !savedIds.includes(c.id));
      if (saved.length > 0) { setMovCols([...saved, ...newCols]); return; }
    } catch {}
    setMovCols(fresh);
  }, [data, asociatieId]);

  // Persist order when user drags
  useEffect(() => {
    if (!asociatieId || movCols.length === 0) return;
    localStorage.setItem(`lp-col-order:${asociatieId}`, JSON.stringify(movCols.map(c => c.id)));
  }, [movCols, asociatieId]);

  const genereaza = useCallback(async () => {
    if (!asociatieId) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/lista-plata?asociatieId=${asociatieId}&luna=${luna}&an=${an}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asociatieId, luna, an]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const rows    = data?.rows    ?? [];
  const coloane = data?.coloane ?? null;

  // Fixed-start col count: Nr.Ap + Proprietar + optional info + consum (m³ + lei?)
  const fixedStartCount = coloane
    ? 2
      + (coloane.nrPersone ? 1 : 0)
      + (coloane.cotaParte ? 1 : 0)
      + (coloane.suprafata ? 1 : 0)
      + coloane.consumuri.reduce((s, c) => s + 1 + (c.valoareLeiKey ? 1 : 0), 0)
    : 2;

  // Fixed-end col count: restanta? + fonduri + TOTAL
  const fixedEndCount = coloane
    ? (coloane.hasRestantaIntretinere ? 1 : 0)
      + (coloane.fonduri.length > 0 ? (fondMode === "total" ? 1 : coloane.fonduri.length) : 0)
      + 1 // TOTAL
    : 1;

  // Consum group colspan (m³ + lei? per tip)
  const consumGroupSpan = coloane?.consumuri.reduce((s, c) => s + 1 + (c.valoareLeiKey ? 1 : 0), 0) ?? 0;

  // Compute criterion sub-groups in movCols for second header row
  const critSubGroups: { crit: string | null; span: number }[] = [];
  for (const col of movCols) {
    const crit = col.kind === "chelt" ? (col.cheltCriteriu ?? null) : null;
    if (critSubGroups.length > 0 && critSubGroups[critSubGroups.length - 1].crit === crit) {
      critSubGroups[critSubGroups.length - 1].span++;
    } else {
      critSubGroups.push({ crit, span: 1 });
    }
  }
  const hasCritSubGroups = coloane && coloane.cheltuieli.some(c => c.criteriu);

  // Pre-compute movCol totals
  const movColTotals: Record<string, number> = {};
  for (const col of movCols) {
    movColTotals[col.id] = rows.reduce((s, r) => {
      if (col.kind === "chelt")     return s + (r.cheltuieli[col.cheltKey!] ?? 0);
      if (col.kind === "totalLuna") return s + r.totalLuna;
      return s;
    }, 0);
  }

  // Pre-compute restante totals
  const totRestanta     = rows.reduce((s, r) => s + r.restantaIntretinere, 0);
  const totTotalFonduri = rows.reduce((s, r) => s + r.totalFonduri, 0);
  const totTotal        = rows.reduce((s, r) => s + r.total, 0);
  const totPerFond: Record<string, number> = {};
  coloane?.fonduri.forEach(f => {
    totPerFond[f.id] = rows.reduce((s, r) => s + (r.restantaFonduri[f.id] ?? 0), 0);
  });
  const totPerConsum: Record<string, number> = {};
  coloane?.consumuri.forEach(c => {
    totPerConsum[c.tip] = rows.reduce((s, r) => s + (r.consumByTip[c.tip] ?? 0), 0);
  });
  const totPerConsumLei: Record<string, number> = {};
  coloane?.consumuri.filter(c => c.valoareLeiKey).forEach(c => {
    totPerConsumLei[c.tip] = rows.reduce((s, r) => s + (r.cheltuieli[c.valoareLeiKey!] ?? 0), 0);
  });

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(idx: number) { dragIdx.current = idx; }

  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }

  function handleDrop(idx: number) {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      setMovCols(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIdx.current!, 1);
        arr.splice(idx, 0, moved);
        return arr;
      });
    }
    dragIdx.current = null; setDragOverIdx(null);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function movColHeader(col: MovCol) {
    if (col.kind === "totalLuna") return "Total lună";
    return (
      <>
        {col.cheltLabel}
        {col.cheltCriteriu && (
          <span className="lp-th__criteriu">{CRITERIU_LABELS[col.cheltCriteriu] ?? col.cheltCriteriu}</span>
        )}
      </>
    );
  }

  function movColClass(col: MovCol): string {
    if (col.kind === "totalLuna") return "lp-th--subtotal";
    return "lp-th--chelt";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasFonduri         = (coloane?.fonduri.length ?? 0) > 0;
  const showGroupHeader    = coloane && (consumGroupSpan > 0 || movCols.length > 0 ||
    coloane.hasRestantaIntretinere || hasFonduri);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Listă de plată</h1>
          <p className="page-sub">Situația lunară pe apartamente — cheltuieli și restanțe</p>
        </div>
        {data && (
          <button className="btn btn--secondary" onClick={() => window.print()}>⎙ Tipărire</button>
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
            {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" value={an} min={2000} max={2100}
            style={{ width: "90px" }} onChange={e => setAn(parseInt(e.target.value) || an)} />
        </div>
        <button className="btn btn--primary" onClick={genereaza}
          disabled={loading || !asociatieId} style={{ alignSelf: "flex-end" }}>
          {loading ? "Se generează..." : "Generează"}
        </button>
      </div>

      {error && <div className="wizard__error">{error}</div>}

      {!data && !loading && (
        <div className="dash-panel">
          <div className="dash-panel__empty">
            Selectează luna, apoi apasă <strong>Generează</strong>.
          </div>
        </div>
      )}

      {data && coloane && (
        <>
          <div className="lp-meta">
            <span className="lp-meta__title">{data.asociatie.name}</span>
            <span className="lp-meta__period">{LUNI[data.luna - 1]} {data.an}</span>
            <span className="lp-meta__count">{rows.length} apartamente</span>

            {hasFonduri && (
              <div className="lp-toggle" style={{ marginLeft: "auto" }}>
                <span className="lp-toggle__label">Fonduri:</span>
                <button className={`lp-toggle__btn${fondMode === "total" ? " lp-toggle__btn--active" : ""}`}
                  onClick={() => setFondMode("total")}>Total</button>
                <button className={`lp-toggle__btn${fondMode === "detaliat" ? " lp-toggle__btn--active" : ""}`}
                  onClick={() => setFondMode("detaliat")}>Detaliat</button>
              </div>
            )}

            {movCols.length > 1 && (
              <span className="lp-meta__hint">⇄ Trage coloanele pentru a le reordona</span>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="dash-panel"><div className="dash-panel__empty">Niciun apartament.</div></div>
          ) : (
            <div className="table-wrap lp-table-wrap">
              <table className="data-table lp-table">
                <thead>
                  {/* Row 1: group headers */}
                  {showGroupHeader && (
                    <tr className="lp-thead-groups">
                      {/* Fixed info block */}
                      <th colSpan={2 + (coloane.nrPersone ? 1 : 0) + (coloane.cotaParte ? 1 : 0) + (coloane.suprafata ? 1 : 0)}
                        className="lp-th-group" />

                      {/* Consum contoare (m³ + lei) */}
                      {consumGroupSpan > 0 && (
                        <th colSpan={consumGroupSpan} className="lp-th-group lp-th-group--consum">
                          Consum contoare
                        </th>
                      )}

                      {/* Cheltuieli lunare — all draggable cols */}
                      {movCols.length > 0 && (
                        <th colSpan={movCols.length} className="lp-th-group lp-th-group--chelt">
                          Cheltuieli lunare
                        </th>
                      )}

                      {/* Restanțe — fixed end */}
                      {(coloane.hasRestantaIntretinere || hasFonduri) && (
                        <th colSpan={
                          (coloane.hasRestantaIntretinere ? 1 : 0) +
                          (hasFonduri ? (fondMode === "total" ? 1 : coloane.fonduri.length) : 0)
                        } className="lp-th-group lp-th-group--rest">
                          Restanțe
                        </th>
                      )}

                      {/* TOTAL */}
                      <th className="lp-th-group" />
                    </tr>
                  )}

                  {/* Row 2: criterion sub-groups within Cheltuieli lunare */}
                  {hasCritSubGroups && movCols.length > 0 && (
                    <tr className="lp-thead-criteria">
                      <th colSpan={fixedStartCount} className="lp-th-group" />
                      {critSubGroups.map((g, i) => (
                        <th key={i} colSpan={g.span}
                          className={`lp-th-crit${g.crit ? ` lp-th-crit--active` : ""}`}>
                          {g.crit ? (CRITERIU_LABELS[g.crit] ?? g.crit) : ""}
                        </th>
                      ))}
                      <th colSpan={fixedEndCount} className="lp-th-group" />
                    </tr>
                  )}

                  {/* Row 3: column headers */}
                  <tr>
                    {/* Fixed start */}
                    <th className="lp-th--nr">Nr. Ap.</th>
                    <th className="lp-th--prop">Proprietar</th>
                    {coloane.nrPersone && <th className="lp-th--num" title="Nr. persoane">Pers.</th>}
                    {coloane.cotaParte && <th className="lp-th--num" title="Cotă parte indivizibilă">CPI</th>}
                    {coloane.suprafata && <th className="lp-th--num">Supraf. (m²)</th>}

                    {coloane.consumuri.map(c => (
                      <React.Fragment key={c.tip}>
                        <th className="lp-th--num lp-th--consum">
                          {c.label}<br /><span className="lp-th__unit">({c.unit})</span>
                        </th>
                        {c.valoareLeiKey && (
                          <th className="lp-th--num lp-th--consum-lei">
                            {c.label}<br /><span className="lp-th__unit">(lei)</span>
                          </th>
                        )}
                      </React.Fragment>
                    ))}

                    {/* Draggable cols */}
                    {movCols.map((col, idx) => (
                      <th key={col.id}
                        className={`lp-th--num lp-th--draggable ${movColClass(col)}${dragOverIdx === idx ? " lp-th--drag-over" : ""}`}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={() => handleDrop(idx)}
                      >
                        <span className="lp-th__drag-handle" title="Trage pentru a reordona">⠿</span>
                        {movColHeader(col)}
                      </th>
                    ))}

                    {/* Fixed end */}
                    {coloane.hasRestantaIntretinere && (
                      <th className="lp-th--num lp-th--rest">Restanță întreținere</th>
                    )}
                    {hasFonduri && fondMode === "total" && (
                      <th className="lp-th--num lp-th--rest">Restanță fonduri</th>
                    )}
                    {hasFonduri && fondMode === "detaliat" && coloane.fonduri.map(f => (
                      <th key={f.id} className="lp-th--num lp-th--rest">{f.name}</th>
                    ))}
                    <th className="lp-th--num lp-th--total">TOTAL</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(row => (
                    <tr key={row.apartamentId}>
                      <td className="lp-td--nr">{row.numar}</td>
                      <td className="lp-td--prop">{row.proprietar || <span className="lp-td--empty">—</span>}</td>

                      {coloane.nrPersone && <td className="lp-td--num">{row.nrPersone}</td>}
                      {coloane.cotaParte && (
                        <td className="lp-td--num">{row.cotaParte != null ? fmt4(row.cotaParte) : "—"}</td>
                      )}
                      {coloane.suprafata && (
                        <td className="lp-td--num">{row.suprafata != null ? fmt2(row.suprafata) : "—"}</td>
                      )}

                      {coloane.consumuri.map(c => (
                        <React.Fragment key={c.tip}>
                          <td className="lp-td--num">
                            {row.consumByTip[c.tip] !== undefined
                              ? <span className="lp-val--consum">{fmt3(row.consumByTip[c.tip])}</span>
                              : <span className="lp-td--empty">—</span>}
                          </td>
                          {c.valoareLeiKey && (
                            <td className="lp-td--num lp-td--lei">
                              {fmt2(row.cheltuieli[c.valoareLeiKey] ?? 0)}
                            </td>
                          )}
                        </React.Fragment>
                      ))}

                      {movCols.map(col => {
                        let val = 0;
                        if (col.kind === "chelt")     val = row.cheltuieli[col.cheltKey!] ?? 0;
                        if (col.kind === "totalLuna") val = row.totalLuna;
                        return (
                          <td key={col.id}
                            className={`lp-td--num${col.kind === "totalLuna" ? " lp-td--subtotal" : ""}`}>
                            {fmt2(val)}
                          </td>
                        );
                      })}

                      {coloane.hasRestantaIntretinere && (
                        <td className={`lp-td--num${row.restantaIntretinere > 0 ? " lp-td--red" : ""}`}>
                          {fmt2(row.restantaIntretinere)}
                        </td>
                      )}
                      {hasFonduri && fondMode === "total" && (
                        <td className={`lp-td--num${row.totalFonduri > 0 ? " lp-td--red" : ""}`}>
                          {fmt2(row.totalFonduri)}
                        </td>
                      )}
                      {hasFonduri && fondMode === "detaliat" && coloane.fonduri.map(f => (
                        <td key={f.id}
                          className={`lp-td--num${(row.restantaFonduri[f.id] ?? 0) > 0 ? " lp-td--red" : ""}`}>
                          {fmt2(row.restantaFonduri[f.id] ?? 0)}
                        </td>
                      ))}

                      <td className={`lp-td--num lp-td--total${row.total > 0 ? " lp-td--total--pos" : ""}`}>
                        {fmt2(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="lp-tfoot">
                    <td className="lp-tfoot__label" colSpan={fixedStartCount}>TOTAL</td>
                    {movCols.map(col => (
                      <td key={col.id} className={`lp-td--num lp-tfoot__val${col.kind === "totalLuna" ? " lp-td--subtotal" : ""}`}>
                        {fmt2(movColTotals[col.id] ?? 0)}
                      </td>
                    ))}
                    {coloane.hasRestantaIntretinere && (
                      <td className="lp-td--num lp-tfoot__val lp-td--red">{fmt2(totRestanta)}</td>
                    )}
                    {hasFonduri && fondMode === "total" && (
                      <td className="lp-td--num lp-tfoot__val lp-td--red">{fmt2(totTotalFonduri)}</td>
                    )}
                    {hasFonduri && fondMode === "detaliat" && coloane.fonduri.map(f => (
                      <td key={f.id} className="lp-td--num lp-tfoot__val lp-td--red">
                        {fmt2(totPerFond[f.id] ?? 0)}
                      </td>
                    ))}
                    <td className="lp-td--num lp-tfoot__val lp-tfoot__val--total">{fmt2(totTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
