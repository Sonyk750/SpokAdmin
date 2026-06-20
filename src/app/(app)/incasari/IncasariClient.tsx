"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebtRow {
  tip:      string;
  fondId?:  string;
  denumire: string;
  datorat:  number;
}

interface SelectedDebt extends DebtRow {
  suma: string;
}

interface SoldCurent {
  numar:               string;
  proprietarNume:      string | null;
  restantaIntretinere: number;
  intretinereCurenta:  number;
  fonduri: { id: string; name: string; restanta: number }[];
}

interface IncasareRow {
  id:             string;
  nrApartament:   string;
  proprietarNume: string | null;
  serie:          string;
  numarDocument:  number;
  tipDocument:    string;
  tipPlata:       string;
  data:           string;
  sumaIncasata:   number;
  observatii:     string | null;
  pozitii:        { tip: string; denumire: string; suma: number; fondId?: string }[];
  avans:          { suma: number } | null;
}

interface ApOption { id: string; numar: string; proprietar: string; }
interface BancaOption { name: string; iban?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const LUNI = [
  "Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
  "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie",
];

const TIP_DOC_LABEL: Record<string, string> = {
  chitanta:            "Chitanță",
  dispozitie_incasare: "Dispoziție de încasare",
  proces_verbal:       "Proces verbal",
};

const TIP_PLATA_LABEL: Record<string, string> = {
  casa:   "Casă",
  banca:  "Bancă",
  online: "Online",
};

const fmt2 = (v: number) => v.toFixed(2);

// ─── Component ────────────────────────────────────────────────────────────────

export default function IncasariClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId } = useAsociatie();

  // ── List filters ─────────────────────────────────────────────────────────
  const [fLuna, setFLuna] = useState(String(defaultLuna));
  const [fAn,   setFAn]   = useState(String(defaultAn));

  // ── Data ─────────────────────────────────────────────────────────────────
  const [incasari, setIncasari] = useState<IncasareRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState<string | null>(null);

  // Apartment lookup
  const [apOptions,    setApOptions]    = useState<ApOption[]>([]);
  const [apSearch,     setApSearch]     = useState("");
  const [selectedApId, setSelectedApId] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const apRef = useRef<HTMLDivElement>(null);

  // Sold + debts
  const [soldLoading, setSoldLoading] = useState(false);
  const [allDebts,    setAllDebts]    = useState<DebtRow[]>([]);
  const [rightDebts,  setRightDebts]  = useState<SelectedDebt[]>([]);
  const [leftSelected, setLeftSelected] = useState<Set<number>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<number>>(new Set());

  // Form fields
  const [dataDoc,      setDataDoc]      = useState(new Date().toISOString().slice(0, 10));
  const [serieDoc,     setSerieDoc]     = useState("CH");
  const [nrDocManual,  setNrDocManual]  = useState("");
  const [tipDocument,  setTipDocument]  = useState("chitanta");
  const [whereCollect, setWhereCollect] = useState("casa"); // "casa" | bank name
  const [banci,        setBanci]        = useState<BancaOption[]>([]);
  const [observatii,   setObservatii]   = useState("");

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detail,     setDetail]     = useState<IncasareRow | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [deleteErr,  setDeleteErr]  = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalDatorat  = allDebts.reduce((s, d) => s + d.datorat, 0);
  const totalAchitat  = rightDebts.reduce((s, d) => s + (parseFloat(d.suma) || 0), 0);
  const sumaRamasa    = Math.max(0, totalDatorat - totalAchitat);
  const avans         = Math.max(0, totalAchitat - rightDebts.reduce((s, d) => s + d.datorat, 0));

  const filteredAps = apOptions.filter(ap => {
    const q = apSearch.toLowerCase();
    return !q || ap.numar.includes(q) || ap.proprietar.toLowerCase().includes(q);
  });

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (apRef.current && !apRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Fetch incasari ────────────────────────────────────────────────────────
  const fetchIncasari = useCallback(async () => {
    if (!asociatieId) { setIncasari([]); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId });
    if (fLuna) params.set("luna", fLuna);
    if (fAn)   params.set("an",   fAn);
    try {
      const res  = await fetch(`/api/incasari?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setIncasari(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, fLuna, fAn]);

  useEffect(() => { fetchIncasari(); }, [fetchIncasari]);

  // ── Fetch apartment options ───────────────────────────────────────────────
  useEffect(() => {
    if (!asociatieId) { setApOptions([]); return; }
    fetch(`/api/asociatii/${asociatieId}/apartamente`)
      .then(r => r.json())
      .then((data: { apartamente: any[] }) =>
        setApOptions((data.apartamente ?? []).map(ap => ({ id: ap.id, numar: ap.numar, proprietar: ap.proprietar || "" })))
      ).catch(() => {});
  }, [asociatieId]);

  // ── Fetch association banks ───────────────────────────────────────────────
  useEffect(() => {
    if (!asociatieId) { setBanci([]); return; }
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then((data: { banci: BancaOption[] }) => setBanci(data.banci ?? []))
      .catch(() => {});
  }, [asociatieId]);

  // ── Load sold curent when apartment changes ───────────────────────────────
  useEffect(() => {
    if (!selectedApId || !asociatieId) { setAllDebts([]); setRightDebts([]); return; }
    setSoldLoading(true);
    fetch(`/api/incasari/sold-curent?apartamentId=${selectedApId}&asociatieId=${asociatieId}`)
      .then(r => r.json())
      .then((data: SoldCurent) => {
        const rows: DebtRow[] = [];
        if (data.intretinereCurenta > 0) rows.push({ tip: "intretinere_curenta", denumire: "Întreținere luna curentă", datorat: data.intretinereCurenta });
        if (data.restantaIntretinere > 0) rows.push({ tip: "intretinere", denumire: "Restanță întreținere", datorat: data.restantaIntretinere });
        for (const f of data.fonduri) {
          if (f.restanta > 0) rows.push({ tip: "fond", fondId: f.id, denumire: f.name, datorat: f.restanta });
        }
        setAllDebts(rows);
        setRightDebts([]);
        setLeftSelected(new Set());
        setRightSelected(new Set());
      })
      .catch(() => { setAllDebts([]); setRightDebts([]); })
      .finally(() => setSoldLoading(false));
  }, [selectedApId, asociatieId]);

  // ── Dual-list helpers ─────────────────────────────────────────────────────
  function moveAllToRight() {
    setRightDebts(allDebts.map(d => ({ ...d, suma: fmt2(d.datorat) })));
    setLeftSelected(new Set());
    setRightSelected(new Set());
  }

  function moveSelectedToRight() {
    const toMove = allDebts.filter((_, i) => leftSelected.has(i));
    const existingKeys = new Set(rightDebts.map(d => `${d.tip}:${d.fondId ?? ""}`));
    const newOnes = toMove.filter(d => !existingKeys.has(`${d.tip}:${d.fondId ?? ""}`));
    setRightDebts(prev => [...prev, ...newOnes.map(d => ({ ...d, suma: fmt2(d.datorat) }))]);
    setLeftSelected(new Set());
  }

  function removeFromRight() {
    setRightDebts(prev => prev.filter((_, i) => !rightSelected.has(i)));
    setRightSelected(new Set());
  }

  function toggleLeft(i: number) {
    setLeftSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  function toggleRight(i: number) {
    setRightSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openModal() {
    setSelectedApId(""); setApSearch(""); setShowDropdown(false);
    setAllDebts([]); setRightDebts([]); setLeftSelected(new Set()); setRightSelected(new Set());
    setDataDoc(new Date().toISOString().slice(0, 10));
    setSerieDoc("CH"); setNrDocManual("");
    setTipDocument("chitanta");
    setWhereCollect("casa");
    setObservatii(""); setFormErr(null);
    setModalOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!asociatieId || !selectedApId) { setFormErr("Selectează un apartament."); return; }
    const payload = rightDebts.filter(d => parseFloat(d.suma) > 0);
    if (payload.length === 0) { setFormErr("Adaugă cel puțin o datorie în lista de achitat."); return; }

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
          serieOverride: serieDoc || undefined,
          nrDocManual: nrDocManual ? parseInt(nrDocManual) : undefined,
          observatii,
          pozitii: payload.map(d => ({ tip: d.tip, fondId: d.fondId, denumire: d.denumire, suma: Math.round(parseFloat(d.suma) * 100) / 100 })),
          avans: avans > 0 ? { suma: avans } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setModalOpen(false);
      fetchIncasari();
    } catch (e: any) { setFormErr(e.message); }
    finally { setSaving(false); }
  }, [asociatieId, selectedApId, rightDebts, tipDocument, whereCollect, dataDoc, serieDoc, nrDocManual, observatii, avans, fetchIncasari]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true); setDeleteErr(null);
    try {
      const res  = await fetch(`/api/incasari/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setDetail(null); setConfirmDel(false);
      fetchIncasari();
    } catch (e: any) { setDeleteErr(e.message); }
    finally { setDeleting(false); }
  }, [fetchIncasari]);

  // ── Render ────────────────────────────────────────────────────────────────
  const totalIncasat = incasari.reduce((s, i) => s + i.sumaIncasata, 0);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Încasări</h1>
          <p className="page-sub">Chitanțe și încasări de la proprietari</p>
        </div>
        <button className="btn btn--primary" onClick={openModal} disabled={!asociatieId}>
          + Adaugă încasare
        </button>
      </div>

      {!asociatieId && (
        <div className="wizard__error">Selectează o asociație din antetul paginii.</div>
      )}

      {/* Filters */}
      <div className="lp-controls">
        <div className="form-field">
          <label className="form-field__label">Luna</label>
          <select className="input" value={fLuna} onChange={e => setFLuna(e.target.value)}>
            <option value="">Toate</option>
            {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" value={fAn} min={2000} max={2100}
            style={{ width: "90px" }} onChange={e => setFAn(e.target.value)} />
        </div>
        <button className="btn btn--secondary" onClick={fetchIncasari}
          disabled={loading || !asociatieId} style={{ alignSelf: "flex-end" }}>
          {loading ? "Se încarcă..." : "Filtrează"}
        </button>
      </div>

      {error && <div className="wizard__error">{error}</div>}

      {/* Summary */}
      {incasari.length > 0 && (
        <div className="dash-panel" style={{ padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Documente</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{incasari.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>Total încasat</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div>
          </div>
        </div>
      )}

      {/* Table */}
      {incasari.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">🧾</span>
          <div className="empty-state__title">Nicio încasare</div>
          <div className="empty-state__desc">
            {fLuna && fAn
              ? `Nu există încasări pentru ${LUNI[parseInt(fLuna) - 1]} ${fAn}.`
              : 'Apasă "+ Adaugă încasare" pentru a înregistra prima chitanță.'}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Data</th>
                <th>Ap.</th>
                <th>Proprietar</th>
                <th>Plată</th>
                <th style={{ textAlign: "right" }}>Sumă</th>
                <th style={{ width: "48px" }} />
              </tr>
            </thead>
            <tbody>
              {incasari.map(inc => (
                <tr key={inc.id} style={{ cursor: "pointer" }}
                  onClick={() => { setDetail(inc); setConfirmDel(false); setDeleteErr(null); }}>
                  <td>
                    <span style={{ fontWeight: 700, color: "#a78bfa" }}>{inc.serie} {inc.numarDocument}</span>
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                      {TIP_DOC_LABEL[inc.tipDocument] ?? inc.tipDocument}
                    </span>
                  </td>
                  <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(inc.data).toLocaleDateString("ro-RO")}
                  </td>
                  <td style={{ fontWeight: 700, color: "#a78bfa" }}>{inc.nrApartament}</td>
                  <td style={{ color: "#94a3b8" }}>{inc.proprietarNume || "—"}</td>
                  <td>
                    <span className={`pill ${inc.tipPlata === "casa" ? "pill--violet" : "pill--gray"}`}>
                      {TIP_PLATA_LABEL[inc.tipPlata] ?? inc.tipPlata}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80" }}>
                    {fmt2(inc.sumaIncasata)} lei
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─────────────────────── Adaugă încasare modal ─────────────────────── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal" style={{ maxWidth: "62rem", width: "96vw" }}>

            <div className="modal__header">
              <span className="modal__title">Adaugă încasare</span>
              <button className="modal__close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* ── Row 1: Apartament ── */}
              <div ref={apRef} style={{ position: "relative" }}>
                <label className="form-field__label" style={{ marginBottom: "0.375rem", display: "block" }}>
                  Plătitor — Apartament *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Caută după număr sau proprietar..."
                  value={apSearch}
                  autoComplete="off"
                  onChange={e => { setApSearch(e.target.value); setSelectedApId(""); setShowDropdown(true); setAllDebts([]); setRightDebts([]); }}
                  onFocus={() => { if (apSearch) setShowDropdown(true); }}
                />
                {showDropdown && apSearch && filteredAps.length > 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                    background: "#0d1325", zIndex: 20, maxHeight: "200px", overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}>
                    {filteredAps.slice(0, 20).map(ap => (
                      <div key={ap.id} style={{ padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                        onMouseDown={() => {
                          setSelectedApId(ap.id);
                          setApSearch(`Ap. ${ap.numar}${ap.proprietar ? ` — ${ap.proprietar}` : ""}`);
                          setShowDropdown(false);
                        }}>
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

              {/* ── Row 2: Chitanță + unde se încasează ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr", gap: "1rem" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Data încasării</label>
                  <input type="date" className="input" value={dataDoc} onChange={e => setDataDoc(e.target.value)} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Tip document</label>
                  <select className="input" value={tipDocument} onChange={e => setTipDocument(e.target.value)}>
                    <option value="chitanta">Chitanță</option>
                    <option value="dispozitie_incasare">Dispoziție de încasare</option>
                    <option value="proces_verbal">Proces verbal</option>
                  </select>
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Serie / Nr. chitanță</label>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <input type="text" className="input" value={serieDoc} onChange={e => setSerieDoc(e.target.value)}
                      style={{ width: "54px" }} maxLength={6} placeholder="CH" />
                    <input type="number" className="input" value={nrDocManual} onChange={e => setNrDocManual(e.target.value)}
                      style={{ flex: 1 }} placeholder="auto" min={1} />
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Se încasează în</label>
                  <select className="input" value={whereCollect} onChange={e => setWhereCollect(e.target.value)}>
                    <option value="casa">🏠 Casă (numerar)</option>
                    {banci.map((b, i) => (
                      <option key={i} value={b.name}>🏦 {b.name}{b.iban ? ` — ${b.iban}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Row 3: Dual-list datorii ── */}
              {soldLoading && (
                <div style={{ fontSize: "0.875rem", color: "#64748b", padding: "0.5rem 0" }}>Se încarcă datoriile...</div>
              )}

              {selectedApId && !soldLoading && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: "0.75rem", alignItems: "start" }}>

                    {/* Left — datorii disponibile */}
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "0.5rem" }}>
                        Datorii curente
                      </div>
                      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", minHeight: "140px", overflow: "hidden" }}>
                        {allDebts.length === 0 ? (
                          <div style={{ padding: "1.5rem 1rem", fontSize: "0.8125rem", color: "#4ade80", textAlign: "center" }}>
                            ✓ Fără restanțe
                          </div>
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
                                  <tr key={i}
                                    onClick={() => !inRight && toggleLeft(i)}
                                    style={{
                                      cursor: inRight ? "default" : "pointer",
                                      background: sel ? "rgba(124,58,237,0.12)" : inRight ? "rgba(255,255,255,0.02)" : "",
                                      opacity: inRight ? 0.4 : 1,
                                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <td style={{ padding: "0.5rem 0.75rem", color: sel ? "#a78bfa" : "#e2e8f0" }}>
                                      {sel && <span style={{ marginRight: "0.375rem", color: "#a78bfa" }}>✓</span>}
                                      {d.denumire}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#f87171", whiteSpace: "nowrap" }}>
                                      {fmt2(d.datorat)} lei
                                    </td>
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

                    {/* Transfer buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1.75rem", alignItems: "center" }}>
                      <button type="button" title="Mută toate"
                        onClick={moveAllToRight}
                        style={{ width: "38px", height: "30px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "6px", color: "#a78bfa", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        ⇒
                      </button>
                      <button type="button" title="Mută selecția"
                        onClick={moveSelectedToRight}
                        disabled={leftSelected.size === 0}
                        style={{ width: "38px", height: "30px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "6px", color: leftSelected.size > 0 ? "#a78bfa" : "#475569", cursor: leftSelected.size > 0 ? "pointer" : "default", fontSize: "0.75rem", fontWeight: 700 }}>
                        →
                      </button>
                      <button type="button" title="Elimină selecția"
                        onClick={removeFromRight}
                        disabled={rightSelected.size === 0}
                        style={{ width: "38px", height: "30px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", color: rightSelected.size > 0 ? "#f87171" : "#475569", cursor: rightSelected.size > 0 ? "pointer" : "default", fontSize: "0.75rem", fontWeight: 700 }}>
                        ←
                      </button>
                    </div>

                    {/* Right — se achită */}
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "0.5rem" }}>
                        Se achită cu această chitanță
                      </div>
                      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", minHeight: "140px", overflow: "hidden" }}>
                        {rightDebts.length === 0 ? (
                          <div style={{ padding: "1.5rem 1rem", fontSize: "0.8125rem", color: "#475569", textAlign: "center" }}>
                            ← Selectează datorii
                          </div>
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
                                  <tr key={i}
                                    style={{
                                      background: sel ? "rgba(239,68,68,0.07)" : "",
                                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                                    }}>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#e2e8f0", cursor: "pointer", userSelect: "none" }}
                                      onClick={() => toggleRight(i)}>
                                      {sel && <span style={{ marginRight: "0.375rem", color: "#f87171" }}>✓</span>}
                                      {d.denumire}
                                    </td>
                                    <td style={{ padding: "0.375rem 0.75rem 0.375rem 0.25rem", textAlign: "right" }}>
                                      <input
                                        type="number"
                                        className="input input--sm"
                                        value={d.suma}
                                        step="0.01" min="0"
                                        style={{ width: "100px", textAlign: "right" }}
                                        onChange={e => setRightDebts(prev => prev.map((r, j) => j === i ? { ...r, suma: e.target.value } : r))}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Total</td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 800, color: "#4ade80", whiteSpace: "nowrap" }}>
                                  {fmt2(totalAchitat)} lei
                                </td>
                              </tr>
                              {sumaRamasa > 0 && (
                                <tr>
                                  <td colSpan={2} style={{ padding: "0.25rem 0.75rem 0.5rem", fontSize: "0.75rem", color: "#f87171", textAlign: "right" }}>
                                    Rămâne neachitat: {fmt2(sumaRamasa)} lei
                                  </td>
                                </tr>
                              )}
                              {avans > 0 && (
                                <tr>
                                  <td colSpan={2} style={{ padding: "0.25rem 0.75rem 0.5rem", fontSize: "0.75rem", color: "#a78bfa", textAlign: "right" }}>
                                    Avans: {fmt2(avans)} lei
                                  </td>
                                </tr>
                              )}
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Observații ── */}
              {selectedApId && (
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Observații</label>
                  <input type="text" className="input" value={observatii} placeholder="Opțional..."
                    onChange={e => setObservatii(e.target.value)} />
                </div>
              )}

              {formErr && <div className="wizard__error">{formErr}</div>}

              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={() => setModalOpen(false)}>Anulare</button>
                <button className="btn btn--primary" onClick={handleSave}
                  disabled={saving || !selectedApId || totalAchitat <= 0}>
                  {saving ? "Se salvează..." : `Salvează chitanța${totalAchitat > 0 ? ` — ${fmt2(totalAchitat)} lei` : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────── Detail / storno modal ─────────────────────── */}
      {detail && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setDetail(null); setConfirmDel(false); } }}>
          <div className="modal" style={{ maxWidth: "32rem" }}>
            <div className="modal__header">
              <span className="modal__title">
                {TIP_DOC_LABEL[detail.tipDocument] ?? detail.tipDocument} {detail.serie} {detail.numarDocument}
              </span>
              <button className="modal__close" onClick={() => { setDetail(null); setConfirmDel(false); }}>✕</button>
            </div>
            <div className="modal__body">
              <div className="info-list">
                <div className="info-row">
                  <span className="info-row__label">Apartament</span>
                  <span className="info-row__value" style={{ color: "#a78bfa", fontWeight: 700 }}>Ap. {detail.nrApartament}</span>
                </div>
                {detail.proprietarNume && (
                  <div className="info-row">
                    <span className="info-row__label">Proprietar</span>
                    <span className="info-row__value">{detail.proprietarNume}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-row__label">Data</span>
                  <span className="info-row__value">{new Date(detail.data).toLocaleDateString("ro-RO")}</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Tip plată</span>
                  <span className="info-row__value">{TIP_PLATA_LABEL[detail.tipPlata] ?? detail.tipPlata}</span>
                </div>
                {detail.observatii && (
                  <div className="info-row">
                    <span className="info-row__label">Observații</span>
                    <span className="info-row__value">{detail.observatii}</span>
                  </div>
                )}
              </div>

              {detail.pozitii.length > 0 && (
                <div style={{ marginTop: "1.25rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "0.625rem" }}>
                    Detaliu
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {detail.pozitii.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "6px", fontSize: "0.875rem" }}>
                        <span style={{ color: "#94a3b8" }}>{p.denumire}</span>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{fmt2(p.suma)} lei</span>
                      </div>
                    ))}
                    {(detail.avans?.suma ?? 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "6px", fontSize: "0.875rem" }}>
                        <span style={{ color: "#a78bfa" }}>Avans</span>
                        <span style={{ fontWeight: 600, color: "#a78bfa" }}>{fmt2(detail.avans?.suma ?? 0)} lei</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0.75rem 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8" }}>Total</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(detail.sumaIncasata)} lei</span>
                  </div>
                </div>
              )}

              {deleteErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{deleteErr}</div>}

              {!confirmDel ? (
                <div className="modal__footer" style={{ justifyContent: "space-between" }}>
                  <button className="btn btn--secondary" style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }} onClick={() => setConfirmDel(true)}>
                    Stornează
                  </button>
                  <button className="btn btn--secondary" onClick={() => { setDetail(null); setConfirmDel(false); }}>Închide</button>
                </div>
              ) : (
                <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.875rem", color: "#f87171", marginBottom: "0.875rem" }}>
                    Confirmi stornarea? Soldul apartamentului va fi refăcut.
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button className="btn btn--secondary" onClick={() => setConfirmDel(false)} disabled={deleting}>Anulare</button>
                    <button className="btn btn--primary" style={{ background: "rgba(239,68,68,0.8)" }}
                      onClick={() => handleDelete(detail.id)} disabled={deleting}>
                      {deleting ? "Se stornează..." : "Confirmă storno"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
