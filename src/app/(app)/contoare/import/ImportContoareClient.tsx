"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const TIP_LABEL: Record<string, string> = {
  apa_rece: "Apă rece", apa_calda: "Apă caldă", electric: "Electric", gaz: "Gaz",
};

interface ContorInfo { contorId: string; tip: string; numarSerie: string; indexVechi: number; apNumar: string; }

function colLetter(i: number): string {
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function normSerie(s: string): string {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function parseNum(s: string): number {
  let v = String(s ?? "").trim().replace(/\s/g, "");
  if (v === "") return NaN;
  if (v.includes(",") && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  return parseFloat(v);
}

export default function ImportContoareClient() {
  const { activeId: asociatieId } = useAsociatie();
  const now = new Date();

  const [luna, setLuna] = useState(now.getMonth() + 1);
  const [an, setAn]     = useState(now.getFullYear());

  const [rows, setRows]       = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [serieCol, setSerieCol]           = useState<number>(-1);
  const [indexCol, setIndexCol]           = useState<number>(-1);
  const [indexVechiCol, setIndexVechiCol] = useState<number>(-1); // -1 = automat (din ultima citire)
  const [headerRow, setHeaderRow]         = useState(true);

  const [format, setFormat]       = useState<string>("");
  const [contoare, setContoare] = useState<ContorInfo[]>([]);
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState<string | null>(null);

  // ── Contoarele asociației (pentru potrivire după serie) ───────────────────
  const loadContoare = useCallback(async () => {
    if (!asociatieId) { setContoare([]); return; }
    try {
      const res = await fetch(`/api/contoare/citiri?asociatieId=${asociatieId}&luna=${luna}&an=${an}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      const flat: ContorInfo[] = [];
      for (const ap of json.apartamente ?? [])
        for (const c of ap.contoare ?? [])
          flat.push({ contorId: c.contorId, tip: c.tip, numarSerie: c.numarSerie ?? "", indexVechi: c.indexVechi ?? 0, apNumar: ap.numar });
      setContoare(flat);
    } catch { setContoare([]); }
  }, [asociatieId, luna, an]);

  useEffect(() => { loadContoare(); }, [loadContoare]);

  const serieMap = useMemo(() => {
    const m = new Map<string, ContorInfo>();
    for (const c of contoare) { const k = normSerie(c.numarSerie); if (k) m.set(k, c); }
    return m;
  }, [contoare]);

  // ── Coloane disponibile ────────────────────────────────────────────────────
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, r.length), 0), [rows]);
  const header = headerRow ? (rows[0] ?? []) : [];
  const columns = useMemo(() =>
    Array.from({ length: nCols }, (_, i) => ({
      idx: i,
      label: (header[i]?.trim()) ? header[i].trim() : `Coloana ${colLetter(i)}`,
    })), [nCols, header]);

  const dataRows = headerRow ? rows.slice(1) : rows;

  // ── Upload + parse ──────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setParsing(true); setError(null); setDone(null); setRows([]); setFormat("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/contoare/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la import");
      const r: string[][] = json.rows ?? [];
      const fmt: string = json.format ?? "generic";
      setRows(r); setFileName(file.name); setFormat(fmt);
      // Salvează furnizorul detectat în localStorage (per asociație) — pentru meniul lateral
      if (fmt !== "generic" && asociatieId) {
        try { localStorage.setItem(`furnizorCitiri-${asociatieId}`, fmt); } catch {}
      }
      // auto-detect coloane din antet (funcționează și pentru formate pre-procesate)
      const hdr = (r[0] ?? []).map(x => (x ?? "").toLowerCase());
      const findCol = (re: RegExp) => hdr.findIndex(h => re.test(h));
      const sCol = findCol(/serie|seria|nr\.?\s*contor|nr\.?\s*apometru|series/);
      const iCol = findCol(/index\s*(nou|actual|curent)|citire|reading|current|actual/);
      const ivCol = findCol(/index\s*(vechi|anterior|prev)|vechi|anterior|previous/);
      setSerieCol(sCol);
      setIndexCol(iCol >= 0 ? iCol : -1);
      setIndexVechiCol(ivCol);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  // ── Previzualizare potriviri ───────────────────────────────────────────────
  const preview = useMemo(() => {
    if (serieCol < 0 || indexCol < 0) return [];
    return dataRows.map((row, i) => {
      const serieRaw = row[serieCol] ?? "";
      const serie = normSerie(serieRaw);
      const indexNou = parseNum(row[indexCol] ?? "");
      const contor = serie ? serieMap.get(serie) : undefined;
      const indexVechi = indexVechiCol >= 0 ? parseNum(row[indexVechiCol] ?? "") : (contor?.indexVechi ?? 0);
      const validNou = !isNaN(indexNou);
      const consum = (validNou && !isNaN(indexVechi)) ? Math.max(0, indexNou - indexVechi) : null;
      return {
        key: i, serieRaw, serie,
        contor,
        apNumar: contor?.apNumar ?? "",
        tip: contor ? (TIP_LABEL[contor.tip] ?? contor.tip) : "",
        indexVechi: isNaN(indexVechi) ? 0 : indexVechi,
        indexNou: validNou ? indexNou : null,
        consum,
        status: !serie ? "gol" : !contor ? "negasit" : !validNou ? "fara_index" : "ok",
      };
    }).filter(r => r.serie !== "" || r.indexNou !== null);
  }, [dataRows, serieCol, indexCol, indexVechiCol, serieMap]);

  const okRows       = preview.filter(p => p.status === "ok");
  const negasite     = preview.filter(p => p.status === "negasit");
  const faraIndex    = preview.filter(p => p.status === "fara_index");

  // ── Salvare ────────────────────────────────────────────────────────────────
  async function importa() {
    if (!asociatieId || okRows.length === 0) return;
    setSaving(true); setError(null); setDone(null);
    try {
      const citiri = okRows.map(p => ({
        contorId: p.contor!.contorId,
        indexVechi: p.indexVechi,
        indexNou: p.indexNou!,
      }));
      const res = await fetch("/api/contoare/citiri", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asociatieId, luna, an, citiri }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la salvare");
      setDone(`${json.salvate ?? citiri.length} citiri importate pentru ${LUNI[luna - 1]} ${an}.`);
      loadContoare();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setRows([]); setFileName(""); setSerieCol(-1); setIndexCol(-1); setIndexVechiCol(-1);
    setError(null); setDone(null); setFormat("");
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!asociatieId) {
    return <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>;
  }

  const statusPill = (s: string) =>
    s === "ok" ? { bg: "#16331f", c: "#4ade80", t: "OK" }
    : s === "negasit" ? { bg: "#3a1d1d", c: "#f87171", t: "Serie negăsită" }
    : s === "fara_index" ? { bg: "#3a331d", c: "#fbbf24", t: "Fără index" }
    : { bg: "#1e293b", c: "#64748b", t: "—" };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Import citiri contoare</h1>
          <p className="page-sub">Importă indexul apometrelor din Excel (Cagero, Techem, ISTA…) — potrivire după seria contorului</p>
        </div>
        {rows.length > 0 && <button className="btn btn--secondary" onClick={reset}>Alt fișier</button>}
      </div>

      {/* Perioadă + upload */}
      <div className="lp-controls" style={{ marginBottom: "1.25rem" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Luna</label>
          <select className="input" value={luna} onChange={e => setLuna(parseInt(e.target.value))}>
            {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" style={{ width: "100px" }} value={an} onChange={e => setAn(parseInt(e.target.value) || an)} min={2000} max={2100} />
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-field__label">Fișier</label>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button className="btn btn--primary" disabled={parsing} onClick={() => fileRef.current?.click()}>
            {parsing ? "Se citește..." : "📄 Alege fișier Excel"}
          </button>
        </div>
        {fileName && <span style={{ alignSelf: "flex-end", color: "#94a3b8", fontSize: "0.85rem", paddingBottom: "0.5rem" }}>{fileName}</span>}
      </div>

      {error && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {done  && <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: "1rem" }}>✓ {done}</div>}

      {format && format !== "generic" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "#1a2e1a", border: "1px solid #166534", borderRadius: "0.5rem", padding: "0.35rem 0.75rem", marginBottom: "1rem", fontSize: "0.82rem", color: "#4ade80" }}>
          <span style={{ fontWeight: 700 }}>Format detectat:</span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{format}</span>
          <span style={{ color: "#86efac" }}>— coloane mapate automat</span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Mapare coloane */}
          <div className="dash-panel" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
            <div className="form-field__label" style={{ marginBottom: "0.75rem" }}>Potrivire coloane</div>
            <div className="form-grid form-grid--2">
              <div className="form-field">
                <label className="form-field__label">Coloana cu seria contorului *</label>
                <select className="input" value={serieCol} onChange={e => setSerieCol(parseInt(e.target.value))}>
                  <option value={-1}>— alege —</option>
                  {columns.map(c => <option key={c.idx} value={c.idx}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">Coloana cu indexul nou *</label>
                <select className="input" value={indexCol} onChange={e => setIndexCol(parseInt(e.target.value))}>
                  <option value={-1}>— alege —</option>
                  {columns.map(c => <option key={c.idx} value={c.idx}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">Coloana index vechi (opțional)</label>
                <select className="input" value={indexVechiCol} onChange={e => setIndexVechiCol(parseInt(e.target.value))}>
                  <option value={-1}>Automat (din ultima citire)</option>
                  {columns.map(c => <option key={c.idx} value={c.idx}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">Primul rând e antet</label>
                <select className="input" value={headerRow ? "1" : "0"} onChange={e => setHeaderRow(e.target.value === "1")}>
                  <option value="1">Da</option>
                  <option value="0">Nu</option>
                </select>
              </div>
            </div>
          </div>

          {serieCol >= 0 && indexCol >= 0 && (
            <>
              {/* Sumar */}
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <Badge label="De importat" value={okRows.length} color="#4ade80" />
                <Badge label="Serii negăsite" value={negasite.length} color={negasite.length ? "#f87171" : "#64748b"} />
                <Badge label="Fără index" value={faraIndex.length} color={faraIndex.length ? "#fbbf24" : "#64748b"} />
              </div>

              {/* Previzualizare */}
              <div className="table-wrap" style={{ marginBottom: "1.25rem", maxHeight: "460px", overflowY: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Serie (fișier)</th>
                      <th>Apartament</th>
                      <th>Contor</th>
                      <th style={{ textAlign: "right" }}>Index vechi</th>
                      <th style={{ textAlign: "right" }}>Index nou</th>
                      <th style={{ textAlign: "right" }}>Consum</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: "center", color: "#475569", padding: "1.5rem" }}>Niciun rând de procesat.</td></tr>
                    )}
                    {preview.map(p => {
                      const pill = statusPill(p.status);
                      return (
                        <tr key={p.key}>
                          <td style={{ fontFamily: "monospace", color: "#cbd5e1" }}>{p.serieRaw || "—"}</td>
                          <td>{p.apNumar ? `Ap. ${p.apNumar}` : "—"}</td>
                          <td style={{ color: "#94a3b8" }}>{p.tip || "—"}</td>
                          <td style={{ textAlign: "right", color: "#94a3b8" }}>{p.contor || p.indexVechi ? p.indexVechi.toFixed(2) : "—"}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>{p.indexNou != null ? p.indexNou.toFixed(2) : "—"}</td>
                          <td style={{ textAlign: "right", color: "#a78bfa", fontWeight: 600 }}>{p.consum != null ? p.consum.toFixed(2) : "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ background: pill.bg, color: pill.c, fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "0.4rem" }}>{pill.t}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {negasite.length > 0 && (
                <div style={{ fontSize: "0.8rem", color: "#fca5a5", marginBottom: "1rem" }}>
                  ⚠ {negasite.length} serii din fișier nu există în asociație: {negasite.slice(0, 10).map(p => p.serieRaw).join(", ")}{negasite.length > 10 ? "…" : ""}.
                  {" "}Verifică seria contoarelor în „Aparate înregistrate" sau corectează în fișier.
                </div>
              )}

              <button className="btn btn--primary" disabled={saving || okRows.length === 0} onClick={importa}>
                {saving ? "Se importă..." : `Importă ${okRows.length} citiri (${LUNI[luna - 1]} ${an})`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
