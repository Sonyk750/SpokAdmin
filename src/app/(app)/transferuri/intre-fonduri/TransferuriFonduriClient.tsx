"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

interface FondBalance { id: string; name: string; balance: number; }

interface TransferFondRow {
  id:          string;
  data:        string;
  suma:        number;
  dinFondId:   string;
  dinFondName: string;
  inFondId:    string;
  inFondName:  string;
  notes:       string | null;
}

const fmt2 = (v: number) => v.toFixed(2);

function roDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TransferuriFonduriClient() {
  const { activeId: asociatieId } = useAsociatie();

  const [fonduri, setFonduri] = useState<FondBalance[]>([]);
  const [rows,    setRows]    = useState<TransferFondRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [dinFondId, setDinFondId] = useState("");
  const [inFondId,  setInFondId]  = useState("");
  const [suma,      setSuma]      = useState("");
  const [data,      setData]      = useState(today);
  const [notes,     setNotes]     = useState("");

  const fetchData = useCallback(async () => {
    if (!asociatieId) { setFonduri([]); setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/transferuri-fonduri?asociatieId=${asociatieId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      const f: FondBalance[] = json.fonduri ?? [];
      setFonduri(f);
      setRows(json.transferuri ?? []);
      // inițializează selecțiile implicite
      setDinFondId(prev => (prev && f.some(x => x.id === prev)) ? prev : (f[0]?.id ?? ""));
      setInFondId(prev => (prev && f.some(x => x.id === prev)) ? prev : (f[1]?.id ?? ""));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    setError(null);
    if (!asociatieId) { setError("Selectează o asociație."); return; }
    if (!dinFondId || !inFondId) { setError("Alege fondurile."); return; }
    if (dinFondId === inFondId) { setError("Fondul sursă și cel destinație trebuie să fie diferite."); return; }
    const sumaNum = parseFloat(suma);
    if (!sumaNum || sumaNum <= 0) { setError("Introdu o sumă mai mare ca 0."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/transferuri-fonduri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asociatieId, data, suma: sumaNum, dinFondId, inFondId, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la salvare");
      setSuma(""); setNotes("");
      await fetchData();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi acest transfer? Soldurile fondurilor vor reveni la valorile anterioare.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/transferuri-fonduri/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare la ștergere");
      await fetchData();
    } catch (e: any) { setError(e.message); }
  }

  const totalTransferat = rows.reduce((s, r) => s + r.suma, 0);

  if (!asociatieId) {
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
          <h1 className="page-title">Transferuri între fonduri</h1>
          <p className="page-sub">Mută bani dintr-un fond în altul — scade din sursă, adaugă la destinație</p>
        </div>
      </div>

      {/* Solduri fonduri */}
      {fonduri.length > 0 && (
        <div className="dash-panel" style={{ padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {fonduri.map(f => (
            <div key={f.id}>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: "0.25rem" }}>{f.name}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: f.balance < 0 ? "#f87171" : "#4ade80" }}>{fmt2(f.balance)} lei</div>
            </div>
          ))}
        </div>
      )}

      {/* Formular transfer nou */}
      {fonduri.length < 2 ? (
        <div className="wizard__error" style={{ marginBottom: "1.5rem" }}>
          Ai nevoie de cel puțin 2 fonduri active pentru a face un transfer. Configurează fondurile în inițializarea asociației.
        </div>
      ) : (
        <div className="dash-panel" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "1rem", fontSize: "0.9rem" }}>Transfer nou</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", alignItems: "flex-end" }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-field__label">Din fondul</label>
              <select className="input" value={dinFondId} onChange={e => setDinFondId(e.target.value)}>
                {fonduri.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-field__label">În fondul</label>
              <select className="input" value={inFondId} onChange={e => setInFondId(e.target.value)}>
                <option value="">— alege —</option>
                {fonduri.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-field__label">Sumă (lei)</label>
              <input type="number" className="input" step="0.01" min="0" placeholder="0.00"
                value={suma} onChange={e => setSuma(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-field__label">Data</label>
              <RoDate className="input" value={data} onChange={v => setData(v)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginTop: "1rem" }}>
            <div className="form-field" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-field__label">Observații (opțional)</label>
              <input type="text" className="input" placeholder="ex: acoperire cheltuieli reparații"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Se salvează..." : "+ Adaugă transfer"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Listă transferuri */}
      {rows.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state__icon">🔁</span>
          <div className="empty-state__title">Niciun transfer între fonduri înregistrat</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Din fond</th>
                <th>În fond</th>
                <th>Observații</th>
                <th style={{ textAlign: "right" }}>Sumă (lei)</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(row.data)}</td>
                  <td style={{ fontWeight: 600, color: "#f87171" }}>{row.dinFondName}</td>
                  <td style={{ fontWeight: 600, color: "#4ade80" }}>{row.inFondName}</td>
                  <td style={{ color: "#94a3b8" }}>{row.notes || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#22d3ee", whiteSpace: "nowrap" }}>{fmt2(row.suma)}</td>
                  <td style={{ textAlign: "center" }}>
                    <button className="fond-row__del" onClick={() => handleDelete(row.id)} title="Șterge">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>Total transferat</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#22d3ee", whiteSpace: "nowrap" }}>{fmt2(totalTransferat)} lei</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
