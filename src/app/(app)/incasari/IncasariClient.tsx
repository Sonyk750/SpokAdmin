"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PozitieRow {
  tip:      string; // "intretinere_curenta" | "intretinere" | "fond"
  fondId?:  string;
  denumire: string;
  datorat:  number; // original balance
  suma:     string; // amount being paid (editable)
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
  avans:          { suma: number; destinatie?: string } | null;
}

interface ApOption {
  id:    string;
  numar: string;
  proprietar: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LUNI = [
  "Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
  "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie",
];

const TIP_DOC_LABEL: Record<string, string> = {
  chitanta:              "Chitanță",
  dispozitie_incasare:   "Dispoziție de încasare",
  proces_verbal:         "Proces verbal",
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

  // ── Filters ──────────────────────────────────────────────────────────────
  const [fLuna, setFLuna] = useState(String(defaultLuna));
  const [fAn,   setFAn]   = useState(String(defaultAn));

  // ── Data ─────────────────────────────────────────────────────────────────
  const [incasari, setIncasari] = useState<IncasareRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen,   setModalOpen]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState<string | null>(null);

  // Modal form
  const [apOptions,    setApOptions]    = useState<ApOption[]>([]);
  const [apSearch,     setApSearch]     = useState("");
  const [selectedApId, setSelectedApId] = useState("");
  const [soldLoading,  setSoldLoading]  = useState(false);
  const [sold,         setSold]         = useState<SoldCurent | null>(null);
  const [pozitii,      setPozitii]      = useState<PozitieRow[]>([]);
  const [tipDocument,  setTipDocument]  = useState("chitanta");
  const [tipPlata,     setTipPlata]     = useState("casa");
  const [dataDoc,      setDataDoc]      = useState(new Date().toISOString().slice(0, 10));
  const [observatii,   setObservatii]   = useState("");

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detail,      setDetail]      = useState<IncasareRow | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteErr,   setDeleteErr]   = useState<string | null>(null);
  const [confirmDel,  setConfirmDel]  = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalPozitii = pozitii.reduce((s, p) => s + (parseFloat(p.suma) || 0), 0);
  const totalDatorat  = pozitii.reduce((s, p) => s + p.datorat, 0);
  const avans = Math.max(0, Math.round((totalPozitii - totalDatorat) * 100) / 100);

  const filteredAps = apOptions.filter(ap => {
    const q = apSearch.toLowerCase();
    return !q || ap.numar.includes(q) || ap.proprietar.toLowerCase().includes(q);
  });

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asociatieId, fLuna, fAn]);

  useEffect(() => { fetchIncasari(); }, [fetchIncasari]);

  // ── Fetch apartment options ───────────────────────────────────────────────

  useEffect(() => {
    if (!asociatieId) { setApOptions([]); return; }
    fetch(`/api/asociatii/${asociatieId}/apartamente`)
      .then(r => r.json())
      .then((data: { apartamente: any[] }) => {
        setApOptions((data.apartamente ?? []).map(ap => ({
          id:         ap.id,
          numar:      ap.numar,
          proprietar: ap.proprietar || "",
        })));
      })
      .catch(() => {});
  }, [asociatieId]);

  // ── Load sold curent ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedApId || !asociatieId) { setSold(null); setPozitii([]); return; }
    setSoldLoading(true);
    fetch(`/api/incasari/sold-curent?apartamentId=${selectedApId}&asociatieId=${asociatieId}`)
      .then(r => r.json())
      .then((data: SoldCurent) => {
        setSold(data);
        const rows: PozitieRow[] = [];
        if (data.intretinereCurenta > 0) {
          rows.push({
            tip: "intretinere_curenta", denumire: "Întreținere luna curentă",
            datorat: data.intretinereCurenta, suma: fmt2(data.intretinereCurenta),
          });
        }
        if (data.restantaIntretinere > 0) {
          rows.push({
            tip: "intretinere", denumire: "Restanță întreținere",
            datorat: data.restantaIntretinere, suma: fmt2(data.restantaIntretinere),
          });
        }
        for (const f of data.fonduri) {
          if (f.restanta > 0) {
            rows.push({
              tip: "fond", fondId: f.id, denumire: f.name,
              datorat: f.restanta, suma: fmt2(f.restanta),
            });
          }
        }
        setPozitii(rows);
      })
      .catch(() => { setSold(null); setPozitii([]); })
      .finally(() => setSoldLoading(false));
  }, [selectedApId, asociatieId]);

  // ── Open modal ────────────────────────────────────────────────────────────

  function openModal() {
    setSelectedApId(""); setApSearch(""); setSold(null); setPozitii([]);
    setTipDocument("chitanta"); setTipPlata("casa");
    setDataDoc(new Date().toISOString().slice(0, 10));
    setObservatii(""); setFormErr(null);
    setModalOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!asociatieId || !selectedApId) { setFormErr("Selectează un apartament."); return; }
    if (pozitii.length === 0) { setFormErr("Nu există sume de achitat."); return; }
    const payload = pozitii.filter(p => parseFloat(p.suma) > 0);
    if (payload.length === 0) { setFormErr("Introdu cel puțin o sumă."); return; }

    setSaving(true); setFormErr(null);
    try {
      const res = await fetch("/api/incasari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asociatieId, apartamentId: selectedApId,
          tipDocument, tipPlata, data: dataDoc, observatii,
          pozitii: payload.map(p => ({
            tip: p.tip, fondId: p.fondId, denumire: p.denumire,
            suma: Math.round(parseFloat(p.suma) * 100) / 100,
          })),
          avans: avans > 0 ? { suma: avans } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setModalOpen(false);
      fetchIncasari();
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  }, [asociatieId, selectedApId, pozitii, tipDocument, tipPlata, dataDoc, observatii, avans, fetchIncasari]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true); setDeleteErr(null);
    try {
      const res = await fetch(`/api/incasari/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setDetail(null); setConfirmDel(false);
      fetchIncasari();
    } catch (e: any) {
      setDeleteErr(e.message);
    } finally {
      setDeleting(false);
    }
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
          + Încasare nouă
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
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div className="dash-panel" style={{ padding: "1rem 1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint, #475569)", marginBottom: "0.25rem" }}>Documente</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{incasari.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint, #475569)", marginBottom: "0.25rem" }}>Total încasat</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>{fmt2(totalIncasat)} lei</div>
            </div>
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
              : 'Apasă "+ Încasare nouă" pentru a înregistra prima chitanță.'}
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
                <th>Tip plată</th>
                <th style={{ textAlign: "right" }}>Sumă</th>
                <th style={{ width: "48px" }} />
              </tr>
            </thead>
            <tbody>
              {incasari.map(inc => (
                <tr key={inc.id} style={{ cursor: "pointer" }} onClick={() => { setDetail(inc); setConfirmDel(false); setDeleteErr(null); }}>
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
                    <span className={`pill ${inc.tipPlata === "casa" ? "pill--violet" : inc.tipPlata === "banca" ? "pill--gray" : "pill--green"}`}>
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

      {/* ── New incasare modal ────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal" style={{ maxWidth: "36rem" }}>
            <div className="modal__header">
              <span className="modal__title">Încasare nouă</span>
              <button className="modal__close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal__body">

              {/* Apartment selector */}
              <div className="form-field" style={{ marginBottom: "1.25rem" }}>
                <label className="form-field__label">Apartament *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Caută după număr sau proprietar..."
                  value={apSearch}
                  onChange={e => { setApSearch(e.target.value); setSelectedApId(""); setSold(null); setPozitii([]); }}
                />
                {apSearch && !selectedApId && filteredAps.length > 0 && (
                  <div style={{
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                    background: "#0d1325", marginTop: "0.25rem", maxHeight: "180px",
                    overflowY: "auto", position: "relative", zIndex: 10,
                  }}>
                    {filteredAps.slice(0, 20).map(ap => (
                      <div key={ap.id}
                        style={{ padding: "0.5rem 0.875rem", cursor: "pointer", fontSize: "0.875rem", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                        onClick={() => {
                          setSelectedApId(ap.id);
                          setApSearch(`Ap. ${ap.numar}${ap.proprietar ? ` — ${ap.proprietar}` : ""}`);
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#a78bfa" }}>Ap. {ap.numar}</span>
                        {ap.proprietar && <span style={{ color: "#94a3b8", marginLeft: "0.5rem" }}>{ap.proprietar}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {apSearch && !selectedApId && filteredAps.length === 0 && (
                  <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.375rem" }}>Niciun apartament găsit.</div>
                )}
              </div>

              {/* Sold curent */}
              {soldLoading && (
                <div style={{ fontSize: "0.875rem", color: "#64748b", padding: "1rem 0" }}>Se încarcă soldul...</div>
              )}

              {sold && pozitii.length === 0 && !soldLoading && (
                <div className="dash-panel" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
                  <div style={{ fontSize: "0.875rem", color: "#4ade80", fontWeight: 600 }}>
                    ✓ Apartamentul nu are restanțe
                  </div>
                </div>
              )}

              {pozitii.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "0.75rem" }}>
                    Alocare plată
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {pozitii.map((p, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "1fr auto auto",
                        alignItems: "center", gap: "0.75rem",
                        padding: "0.625rem 0.875rem",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "8px",
                      }}>
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#e2e8f0" }}>{p.denumire}</div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                            Datorat: {fmt2(p.datorat)} lei
                          </div>
                        </div>
                        <input
                          type="number"
                          className="input input--sm"
                          value={p.suma}
                          step="0.01"
                          min="0"
                          style={{ width: "110px", textAlign: "right" }}
                          onChange={e => setPozitii(prev => prev.map((r, j) => j === i ? { ...r, suma: e.target.value } : r))}
                        />
                        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>lei</span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.875rem 0.875rem 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.75rem",
                  }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8" }}>Total de încasat</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4ade80" }}>
                        {fmt2(totalPozitii)} lei
                      </span>
                      {avans > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "#a78bfa", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>
                          avans {fmt2(avans)} lei
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                    <button type="button" className="btn btn--secondary"
                      style={{ padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}
                      onClick={() => setPozitii(prev => prev.map(p => ({ ...p, suma: fmt2(p.datorat) })))}>
                      Achită tot
                    </button>
                  </div>
                </div>
              )}

              {/* Document metadata */}
              {selectedApId && (
                <div className="form-grid form-grid--2" style={{ gap: "1rem" }}>
                  <div className="form-field">
                    <label className="form-field__label">Tip document</label>
                    <select className="input" value={tipDocument} onChange={e => setTipDocument(e.target.value)}>
                      <option value="chitanta">Chitanță</option>
                      <option value="dispozitie_incasare">Dispoziție de încasare</option>
                      <option value="proces_verbal">Proces verbal</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Tip plată</label>
                    <select className="input" value={tipPlata} onChange={e => setTipPlata(e.target.value)}>
                      <option value="casa">Casă</option>
                      <option value="banca">Bancă</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Data</label>
                    <input type="date" className="input" value={dataDoc} onChange={e => setDataDoc(e.target.value)} />
                  </div>
                  <div className="form-field form-field--full">
                    <label className="form-field__label">Observații</label>
                    <input type="text" className="input" value={observatii} placeholder="Opțional..."
                      onChange={e => setObservatii(e.target.value)} />
                  </div>
                </div>
              )}

              {formErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{formErr}</div>}

              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={() => setModalOpen(false)}>Anulare</button>
                <button className="btn btn--primary" onClick={handleSave}
                  disabled={saving || !selectedApId || totalPozitii <= 0}>
                  {saving ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / storno modal ─────────────────────────────────────────────── */}
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
                  <span className="info-row__value" style={{ color: "#a78bfa", fontWeight: 700 }}>
                    Ap. {detail.nrApartament}
                  </span>
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
                    Detaliu încasare
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {detail.pozitii.map((p, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: "6px", fontSize: "0.875rem",
                      }}>
                        <span style={{ color: "#94a3b8" }}>{p.denumire}</span>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{fmt2(p.suma)} lei</span>
                      </div>
                    ))}
                    {detail.avans && detail.avans.suma > 0 && (
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        background: "rgba(124,58,237,0.06)",
                        border: "1px solid rgba(124,58,237,0.15)",
                        borderRadius: "6px", fontSize: "0.875rem",
                      }}>
                        <span style={{ color: "#a78bfa" }}>Avans</span>
                        <span style={{ fontWeight: 600, color: "#a78bfa" }}>{fmt2(detail.avans.suma)} lei</span>
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "0.75rem 0.75rem 0",
                    borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.5rem",
                  }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8" }}>Total</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#4ade80" }}>
                      {fmt2(detail.sumaIncasata)} lei
                    </span>
                  </div>
                </div>
              )}

              {/* Storno */}
              {deleteErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{deleteErr}</div>}

              {!confirmDel ? (
                <div className="modal__footer" style={{ justifyContent: "space-between" }}>
                  <button className="btn btn--secondary" style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                    onClick={() => setConfirmDel(true)}>
                    Stornează
                  </button>
                  <button className="btn btn--secondary" onClick={() => { setDetail(null); setConfirmDel(false); }}>
                    Închide
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.875rem", color: "#f87171", marginBottom: "0.875rem" }}>
                    Confirmi stornarea? Soldul apartamentului va fi refăcut.
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button className="btn btn--secondary" onClick={() => setConfirmDel(false)} disabled={deleting}>
                      Anulare
                    </button>
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
