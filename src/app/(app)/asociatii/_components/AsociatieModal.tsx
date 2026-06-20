"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props { onClose: () => void }

export default function AsociatieModal({ onClose }: Props) {
  const router = useRouter();
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [cuiLoading,  setCuiLoading]  = useState(false);
  const [cuiMsg,      setCuiMsg]      = useState("");
  const [form, setForm] = useState({
    name:           "",
    address:        "",
    city:           "București",
    sector:         "",
    cui:            "",
    bank:           "",
    iban:           "",
    adminName:      "",
    presedinteName: "",
    cenzorName:     "",
    nrApartamente:  "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function lookupCui() {
    const cui = form.cui.trim();
    if (!cui) return;
    setCuiLoading(true); setCuiMsg("");
    try {
      const res  = await fetch(`/api/anaf?cui=${encodeURIComponent(cui)}`);
      const data = await res.json();
      if (!res.ok) { setCuiMsg(data.error ?? "CUI negăsit"); return; }
      setForm(p => ({
        ...p,
        name:    p.name    || data.denumire,
        address: p.address || data.adresa,
        city:    data.city    || p.city,
        sector:  data.sector  || p.sector,
      }));
      setCuiMsg("✓ Date preluate de la ANAF");
    } catch {
      setCuiMsg("Eroare la interogare ANAF");
    } finally {
      setCuiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Numele asociației este obligatoriu."); return; }
    setSaving(true); setError("");

    const res = await fetch("/api/asociatii", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });

    let data: any = {};
    try { data = await res.json(); } catch { /* body gol */ }
    setSaving(false);

    if (!res.ok) { setError(data?.error ?? `Eroare la salvare (${res.status}).`); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Asociație nouă</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body">
          {error && <div className="auth-alert">{error}</div>}

          <div className="form-grid form-grid--2">
            <div className="form-field">
              <label className="form-field__label">CUI</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="input"
                  value={form.cui}
                  onChange={e => { set("cui", e.target.value); setCuiMsg(""); }}
                  onBlur={lookupCui}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), lookupCui())}
                  placeholder="12345678"
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ whiteSpace: "nowrap", padding: "0 0.875rem", fontSize: "0.8rem" }}
                  onClick={lookupCui}
                  disabled={cuiLoading}
                >
                  {cuiLoading ? "..." : "Caută"}
                </button>
              </div>
              {cuiMsg && (
                <p style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: cuiMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                  {cuiMsg}
                </p>
              )}
            </div>

            <div className="form-field">
              <label className="form-field__label">Nr. apartamente</label>
              <input className="input" type="number" min="1" value={form.nrApartamente} onChange={e => set("nrApartamente", e.target.value)} placeholder="ex: 40" />
            </div>

            <div className="form-field form-field--full">
              <label className="form-field__label">Denumire asociație *</label>
              <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Asociația de Proprietari Nr. 1" required />
            </div>

            <div className="form-field form-field--full">
              <label className="form-field__label">Adresă</label>
              <input className="input" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Str. Exemplu nr. 10" />
            </div>

            <div className="form-field">
              <label className="form-field__label">Oraș</label>
              <input className="input" value={form.city} onChange={e => set("city", e.target.value)} />
            </div>

            <div className="form-field">
              <label className="form-field__label">Sector</label>
              <select className="input" value={form.sector} onChange={e => set("sector", e.target.value)}>
                <option value="">—</option>
                {["1","2","3","4","5","6"].map(s => <option key={s} value={s}>Sector {s}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label">Administrator</label>
              <input className="input" value={form.adminName} onChange={e => set("adminName", e.target.value)} placeholder="Nume Prenume" />
            </div>

            <div className="form-field">
              <label className="form-field__label">Președinte</label>
              <input className="input" value={form.presedinteName} onChange={e => set("presedinteName", e.target.value)} placeholder="Nume Prenume" />
            </div>

            <div className="form-field">
              <label className="form-field__label">Bancă</label>
              <input className="input" value={form.bank} onChange={e => set("bank", e.target.value)} placeholder="BCR / BRD / ING..." />
            </div>

            <div className="form-field">
              <label className="form-field__label">IBAN</label>
              <input className="input" value={form.iban} onChange={e => set("iban", e.target.value)} placeholder="RO49AAAA1B31007593840000" />
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Se salvează..." : "Creează asociație"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
