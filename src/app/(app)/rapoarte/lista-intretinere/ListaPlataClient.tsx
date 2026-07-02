"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import ListaPlataPdfModal from "./ListaPlataPdfModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConturCol {
  tip:           string;
  label:         string;
  unit:          string;
  valoareLeiKey: string | null;
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

interface ListaConfirmari {
  status:              string;
  confirmContabilAt:   string | null;
  confirmPresedinteAt: string | null;
  confirmCenzorAt:     string | null;
  inchisaAt:           string | null;
}

interface ListaData {
  asociatie: { id: string; name: string };
  luna:      number;
  an:        number;
  coloane:   Coloane;
  rows:      Row[];
  lista?:    ListaConfirmari;
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
  const sorted = [...coloane.cheltuieli].sort((a, b) =>
    (CRITERIU_ORDER[a.criteriu ?? ""] ?? 99) - (CRITERIU_ORDER[b.criteriu ?? ""] ?? 99)
  );
  for (const c of sorted) {
    cols.push({ id: `chelt:${c.key}`, kind: "chelt", cheltKey: c.key, cheltLabel: c.label, cheltCriteriu: c.criteriu });
  }
  if (coloane.hasTotalLuna) cols.push({ id: "totalLuna", kind: "totalLuna" });
  return cols;
}

// „Total lună" rămâne mereu ultima coloană mobilă (înaintea restanțelor/fondurilor)
function withTotalLast(cols: MovCol[]): MovCol[] {
  const total = cols.filter(c => c.kind === "totalLuna");
  const rest  = cols.filter(c => c.kind !== "totalLuna");
  return [...rest, ...total];
}

function ConfirmRow({ label, desc, checked, disabled, busy, onChange }: {
  label: string; desc?: string; checked: boolean; disabled?: boolean; busy?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: "0.6rem", padding: "0.6rem 0",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    }}>
      <input type="checkbox" checked={checked} disabled={disabled || busy}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, accentColor: "#7c3aed", flexShrink: 0 }} />
      <span>
        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{label}{busy ? " …" : ""}</div>
        {desc && <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{desc}</div>}
      </span>
    </label>
  );
}

function isServiciiAscensor(label?: string): boolean {
  const normalized = (label ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized.includes("servicii") && normalized.includes("ascensor");
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
  const { activeId: asociatieId, perioadaCurentaLuna, perioadaCurentaAn, refreshPerioada } = useAsociatie();

  const [luna, setLuna] = useState(defaultLuna);
  const [an,   setAn]   = useState(defaultAn);

  // Când se încarcă perioada curentă din context, setează implicit
  useEffect(() => {
    if (perioadaCurentaLuna && perioadaCurentaAn) {
      setLuna(perioadaCurentaLuna);
      setAn(perioadaCurentaAn);
    }
  }, [perioadaCurentaLuna, perioadaCurentaAn]);

  // Închidere / redeschidere listă
  const [closing, setClosing] = useState(false);
  const isCurenta = luna === perioadaCurentaLuna && an === perioadaCurentaAn;

  // Card „Închide lista" — bifele de confirmare (contabil / președinte / cenzor)
  const [showCloseCard, setShowCloseCard] = useState(false);
  const [confirmBusy,   setConfirmBusy]   = useState<string | null>(null);

  async function toggleConfirmare(field: "contabil" | "presedinte" | "cenzor", value: boolean) {
    if (!asociatieId) return;
    setConfirmBusy(field); setError(null);
    try {
      const r = await fetch(`/api/asociatii/${asociatieId}/lista-confirmari`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ luna, an, field, value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Eroare");
      setData(d => d ? {
        ...d,
        lista: {
          status: j.status,
          confirmContabilAt:   j.confirmContabilAt,
          confirmPresedinteAt: j.confirmPresedinteAt,
          confirmCenzorAt:     j.confirmCenzorAt,
          inchisaAt:           d.lista?.inchisaAt ?? null,
        },
      } : d);
    } catch (e: any) { setError(e.message); }
    finally { setConfirmBusy(null); }
  }

  async function inchideLista() {
    if (!asociatieId) return;
    const urm = luna >= 12 ? `${LUNI[0]} ${an + 1}` : `${LUNI[luna]} ${an}`;
    if (!confirm(`Închizi lista pe ${LUNI[luna - 1]} ${an}?\n\nRestanțele neachitate + întreținerea lunii se reportează în ${urm}, iar perioada curentă devine ${urm}.`)) return;
    setClosing(true); setError(null);
    try {
      const r = await fetch(`/api/asociatii/${asociatieId}/inchide-lista`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ luna, an }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Eroare");
      refreshPerioada();
      if (j.perioadaCurenta) { setLuna(j.perioadaCurenta.luna); setAn(j.perioadaCurenta.an); }
    } catch (e: any) { setError(e.message); }
    finally { setClosing(false); }
  }

  // Deschide lista efectiv afișată (nu presupune "ultima lună închisă" —
  // serverul refuză oricum dacă nu e cea mai recentă lună închisă).
  async function deschideLista() {
    if (!asociatieId) return;
    if (!confirm(`Deschizi lista pe ${LUNI[luna - 1]} ${an}? Reportarea în restanță se anulează, iar perioada curentă revine la ${LUNI[luna - 1]} ${an}.`)) return;
    setClosing(true); setError(null);
    try {
      const r = await fetch(`/api/asociatii/${asociatieId}/inchide-lista?luna=${luna}&an=${an}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Eroare");
      refreshPerioada();
      await genereaza();
    } catch (e: any) { setError(e.message); }
    finally { setClosing(false); }
  }

  const [fondMode,     setFondMode]     = useState<FondMode>("detaliat");
  const [data,         setData]         = useState<ListaData | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // ── Draggable column state (cheltuiala + totalLuna only) ──────────────────
  const [movCols,     setMovCols]     = useState<MovCol[]>([]);
  const dragIdx                        = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Restore last-used luna/an then auto-generate on first load
  const autoGenDone = useRef(false);
  useEffect(() => {
    if (!asociatieId || autoGenDone.current) return;
    autoGenDone.current = true;
    let l = luna, a = an;
    try {
      const saved = localStorage.getItem(`lp-period:${asociatieId}`);
      if (saved) { const p = JSON.parse(saved); l = p.l; a = p.a; setLuna(l); setAn(a); }
    } catch {}
    setLoading(true); setError(null);
    fetch(`/api/lista-plata?asociatieId=${asociatieId}&luna=${l}&an=${a}`)
      .then(r => r.json().then(json => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.error ?? "Eroare server");
        setData(json);
        try { localStorage.setItem(`lp-period:${asociatieId}`, JSON.stringify({ l, a })); } catch {}
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asociatieId]);

  // Rebuild movCols when data changes; try to restore saved order from localStorage
  useEffect(() => {
    if (!data || !asociatieId) return;
    const fresh = buildMovCols(data.coloane);
    const key   = `lp-col-order:${asociatieId}`;
    try {
      const savedIds: string[] = JSON.parse(localStorage.getItem(key) ?? "null") ?? [];
      const saved    = savedIds.map(id => fresh.find(c => c.id === id)).filter((c): c is MovCol => !!c);
      const newCols  = fresh.filter(c => !savedIds.includes(c.id));
      if (saved.length > 0) { setMovCols(withTotalLast([...saved, ...newCols])); return; }
    } catch {}
    setMovCols(withTotalLast(fresh));
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
      try { localStorage.setItem(`lp-period:${asociatieId}`, JSON.stringify({ l: luna, a: an })); } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asociatieId, luna, an]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const rows    = data?.rows    ?? [];
  const coloane = data?.coloane ?? null;

  const fixedStartCount = coloane
    ? 2
      + (coloane.nrPersone ? 1 : 0)
      + (coloane.cotaParte ? 1 : 0)
      + (coloane.suprafata ? 1 : 0)
      + coloane.consumuri.reduce((s, c) => s + 1 + (c.valoareLeiKey ? 1 : 0), 0)
    : 2;

  const fixedEndCount = coloane
    ? (coloane.hasRestantaIntretinere ? 1 : 0)
      + (coloane.fonduri.length > 0 ? (fondMode === "total" ? 1 : coloane.fonduri.length) : 0)
      + 2
    : 1;

  const consumGroupSpan = coloane?.consumuri.reduce((s, c) => s + 1 + (c.valoareLeiKey ? 1 : 0), 0) ?? 0;

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

  const movColTotals: Record<string, number> = {};
  for (const col of movCols) {
    movColTotals[col.id] = rows.reduce((s, r) => {
      if (col.kind === "chelt")     return s + (r.cheltuieli[col.cheltKey!] ?? 0);
      if (col.kind === "totalLuna") return s + r.totalLuna;
      return s;
    }, 0);
  }

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
  const totPers   = rows.reduce((s, r) => s + (r.nrPersone ?? 0), 0);
  const totCota   = rows.reduce((s, r) => s + (r.cotaParte  ?? 0), 0);
  const totSupraf = rows.reduce((s, r) => s + (r.suprafata  ?? 0), 0);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(idx: number) { dragIdx.current = idx; }

  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }

  function handleDrop(idx: number) {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      setMovCols(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIdx.current!, 1);
        arr.splice(idx, 0, moved);
        return withTotalLast(arr);
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
          <h1 className="page-title">Lista întreținere</h1>
          <p className="page-sub">
            Situația lunară pe apartamente — cheltuieli și restanțe
            {perioadaCurentaLuna && perioadaCurentaAn && (
              <> · <strong style={{ color: "#a78bfa" }}>Perioadă curentă: {LUNI[perioadaCurentaLuna - 1]} {perioadaCurentaAn}</strong></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {perioadaCurentaLuna && perioadaCurentaAn && isCurenta && (
            <button className="btn btn--primary" onClick={() => setShowCloseCard(true)} disabled={closing || !data}
              title="Deschide cardul de confirmare pentru închiderea lunii">
              {closing ? "Se procesează…" : `🔒 Închide lista ${LUNI[luna - 1]}`}
            </button>
          )}
          {data?.lista?.status === "inchisa" && (
            <button className="btn btn--secondary" onClick={deschideLista} disabled={closing}
              title="Deschide lista afișată (anulează reportarea) — funcționează doar pt. cea mai recentă lună închisă">
              {closing ? "Se procesează…" : `🔓 Deschide lista ${LUNI[luna - 1]}`}
            </button>
          )}
          {data && (
            <>
              <button className="btn btn--secondary" onClick={() => window.print()}>⎙ Tipărire</button>
              <button className="btn btn--primary" onClick={() => setShowPdfModal(true)}>⬇ Descarcă PDF</button>
            </>
          )}
        </div>
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
              // Nu permite liste pentru perioade viitoare (după perioada curentă)
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
            onChange={e => {
              const v = parseInt(e.target.value) || an;
              const capAn = perioadaCurentaAn ? Math.min(v, perioadaCurentaAn) : v;
              setAn(capAn);
              // dacă luna selectată devine viitoare în noul an, o aducem la perioada curentă
              if (perioadaCurentaLuna && capAn === perioadaCurentaAn && luna > perioadaCurentaLuna) setLuna(perioadaCurentaLuna);
            }} />
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
                      <th colSpan={2 + (coloane.nrPersone ? 1 : 0) + (coloane.cotaParte ? 1 : 0) + (coloane.suprafata ? 1 : 0)}
                        className="lp-th-group" />

                      {consumGroupSpan > 0 && (
                        <th colSpan={consumGroupSpan} className="lp-th-group lp-th-group--consum">
                          Consum contoare
                        </th>
                      )}

                      {movCols.length > 0 && (
                        <th colSpan={movCols.length} className="lp-th-group lp-th-group--chelt">
                          Cheltuieli lunare
                        </th>
                      )}

                      {(coloane.hasRestantaIntretinere || hasFonduri) && (
                        <th colSpan={
                          (coloane.hasRestantaIntretinere ? 1 : 0) +
                          (hasFonduri ? (fondMode === "total" ? 1 : coloane.fonduri.length) : 0)
                        } className="lp-th-group lp-th-group--rest">
                          Restanțe
                        </th>
                      )}

                      <th colSpan={2} className="lp-th-group" />
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

                    {coloane.hasRestantaIntretinere && (
                      <th className="lp-th--num lp-th--rest">Restanță / Avans</th>
                    )}
                    {hasFonduri && fondMode === "total" && (
                      <th className="lp-th--num lp-th--rest">Restanță fonduri</th>
                    )}
                    {hasFonduri && fondMode === "detaliat" && coloane.fonduri.map(f => (
                      <th key={f.id} className="lp-th--num lp-th--rest">{f.name}</th>
                    ))}
                    <th className="lp-th--num lp-th--total">TOTAL</th>
                    <th className="lp-th--nr">Nr. Ap.</th>
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
                            {col.kind === "chelt" && val === 0 && isServiciiAscensor(col.cheltLabel) ? "0" : fmt2(val)}
                          </td>
                        );
                      })}

                      {coloane.hasRestantaIntretinere && (
                        <td className={`lp-td--num${row.restantaIntretinere > 0 ? " lp-td--red" : row.restantaIntretinere < 0 ? " lp-td--green" : ""}`}>
                          {row.restantaIntretinere < 0 ? `Avans ${fmt2(Math.abs(row.restantaIntretinere))}` : fmt2(row.restantaIntretinere)}
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
                      <td className="lp-td--nr">{row.numar}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="lp-tfoot">
                    <td className="lp-tfoot__label" colSpan={2}>TOTAL</td>
                    {coloane.nrPersone && <td className="lp-td--num lp-tfoot__val">{totPers}</td>}
                    {coloane.cotaParte && <td className="lp-td--num lp-tfoot__val">{fmt4(totCota)}</td>}
                    {coloane.suprafata && <td className="lp-td--num lp-tfoot__val">{fmt2(totSupraf)}</td>}
                    {coloane.consumuri.map(c => (
                      <React.Fragment key={c.tip}>
                        <td className="lp-td--num lp-tfoot__val"><span className="lp-val--consum">{fmt3(totPerConsum[c.tip] ?? 0)}</span></td>
                        {c.valoareLeiKey && (
                          <td className="lp-td--num lp-tfoot__val lp-td--lei">{fmt2(totPerConsumLei[c.tip] ?? 0)}</td>
                        )}
                      </React.Fragment>
                    ))}
                    {movCols.map(col => (
                      <td key={col.id} className={`lp-td--num lp-tfoot__val${col.kind === "totalLuna" ? " lp-td--subtotal" : ""}`}>
                        {fmt2(movColTotals[col.id] ?? 0)}
                      </td>
                    ))}
                    {coloane.hasRestantaIntretinere && (
                      <td className={`lp-td--num lp-tfoot__val${totRestanta > 0 ? " lp-td--red" : totRestanta < 0 ? " lp-td--green" : ""}`}>
                        {totRestanta < 0 ? `Avans ${fmt2(Math.abs(totRestanta))}` : fmt2(totRestanta)}
                      </td>
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
                    <td className="lp-tfoot__val" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {showCloseCard && data && (
        <div className="modal-overlay" onClick={() => setShowCloseCard(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Închide lista {LUNI[luna - 1]} {an}</h2>
              <button className="modal__close" onClick={() => setShowCloseCard(false)}>×</button>
            </div>
            <div className="modal__body">
              <ConfirmRow
                label="Contabil"
                desc="Publică lista pentru Președinte și Cenzor și trimite email de înștiințare către aceștia."
                checked={!!data.lista?.confirmContabilAt}
                busy={confirmBusy === "contabil"}
                onChange={v => toggleConfirmare("contabil", v)}
              />
              <ConfirmRow
                label="Președinte"
                checked={!!data.lista?.confirmPresedinteAt}
                disabled={!data.lista?.confirmContabilAt}
                busy={confirmBusy === "presedinte"}
                onChange={v => toggleConfirmare("presedinte", v)}
              />
              <ConfirmRow
                label="Cenzor"
                checked={!!data.lista?.confirmCenzorAt}
                disabled={!data.lista?.confirmContabilAt}
                busy={confirmBusy === "cenzor"}
                onChange={v => toggleConfirmare("cenzor", v)}
              />
              <div style={{ borderTop: "1px solid #334155", margin: "0.25rem 0" }} />
              <ConfirmRow
                label="Șef departament contabil"
                desc="Publică lista și pentru Proprietari și închide definitiv luna — restanțele + întreținerea se reportează, iar procesul o ia de la capăt cu luna următoare."
                checked={false}
                disabled={!(data.lista?.confirmContabilAt && data.lista?.confirmPresedinteAt && data.lista?.confirmCenzorAt)}
                busy={closing}
                onChange={async v => { if (v) { await inchideLista(); setShowCloseCard(false); } }}
              />
              {error && <div className="wizard__error" style={{ marginTop: "0.75rem" }}>{error}</div>}
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn--secondary" onClick={() => setShowCloseCard(false)}>Renunță</button>
            </div>
          </div>
        </div>
      )}

      {showPdfModal && data && coloane && asociatieId && (
        <ListaPlataPdfModal
          rows={rows}
          coloane={coloane}
          movCols={movCols}
          fondMode={fondMode}
          asociatieId={asociatieId}
          luna={luna}
          an={an}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
}
