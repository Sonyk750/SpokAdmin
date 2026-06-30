"use client";

import { useState, useEffect, useCallback } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

export default function SetariAsociatieClient() {
  const { activeId } = useAsociatie();

  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  const [serie,           setSerie]           = useState("CH");
  const [urmatorulNumar,  setUrmatorulNumar]  = useState("1");

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res  = await fetch(`/api/asociatii/${activeId}/incasare-serie`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la încărcare");
      setSerie(data.serie ?? "CH");
      setUrmatorulNumar(String(data.urmatorulNumar ?? 1));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!activeId) return;
    const nr = parseInt(urmatorulNumar);
    if (!serie.trim()) { setError("Seria nu poate fi goală."); return; }
    if (!nr || nr < 1) { setError("Numărul de start trebuie să fie cel puțin 1."); return; }

    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/asociatii/${activeId}/incasare-serie`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ serie: serie.trim().toUpperCase(), urmatorulNumar: nr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la salvare");
      setSerie(data.serie);
      setUrmatorulNumar(String(data.urmatorulNumar));
      setSuccess("Setările au fost salvate cu succes.");
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (!activeId) {
    return (
      <div className="page-shell">
        <div className="wizard__error">Selectează o asociație din antetul paginii.</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Setări asociație</h1>
          <p className="page-sub">Configurare documente și alte opțiuni</p>
        </div>
      </div>

      {loading && (
        <div style={{ color: "#64748b", fontSize: "0.875rem", padding: "0.5rem 0" }}>Se încarcă...</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "640px" }}>

        {/* ── Chitanțe ── */}
        <div className="dash-panel">
          <div className="dash-panel__title">Chitanțe și documente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
              Seria și numărul de start pentru chitanțele generate la încasări.
              Numerotarea este incrementată automat după fiecare chitanță emisă.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "1rem", alignItems: "end" }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Serie</label>
                <input
                  type="text" className="input"
                  value={serie}
                  onChange={e => setSerie(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="CH"
                  disabled={loading || saving}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Număr de start (următor nr. de generat)</label>
                <input
                  type="number" className="input"
                  value={urmatorulNumar}
                  onChange={e => setUrmatorulNumar(e.target.value)}
                  min={1}
                  style={{ maxWidth: "180px" }}
                  disabled={loading || saving}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <button
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? "Se salvează..." : "Salvează"}
              </button>
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                Exemplu: <strong style={{ color: "#a78bfa" }}>{serie || "CH"} {urmatorulNumar || 1}</strong>
              </span>
            </div>
          </div>
        </div>

      </div>

      {error && (
        <div className="wizard__error" style={{ marginTop: "1rem", maxWidth: "640px" }}>{error}</div>
      )}
      {success && (
        <div style={{
          marginTop: "1rem", maxWidth: "640px",
          padding: "0.75rem 1rem",
          background: "rgba(74,222,128,0.08)",
          border: "1px solid rgba(74,222,128,0.2)",
          borderRadius: "8px",
          color: "#4ade80",
          fontSize: "0.875rem",
        }}>
          {success}
        </div>
      )}
    </div>
  );
}
