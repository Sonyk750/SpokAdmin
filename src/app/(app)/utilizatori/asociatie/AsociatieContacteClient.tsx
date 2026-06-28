"use client";

import { useState, useEffect, useCallback } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

interface ProprietarRow {
  proprietarId:  string;
  prenume:       string | null;
  nume:          string;
  telefon:       string | null;
  emailuri:      string[];
  apartamentNr:  string;
  apartamentId:  string;
  isMain:        boolean;
}

interface EditState {
  proprietarId: string;
  prenume:      string;
  nume:         string;
  telefon:      string;
  emailuri:     string[];
}

export default function AsociatieContacteClient() {
  const { activeId: asociatieId } = useAsociatie();

  const [rows,    setRows]    = useState<ProprietarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [edit,    setEdit]    = useState<EditState | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [search,  setSearch]  = useState("");

  const load = useCallback(async () => {
    if (!asociatieId) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/utilizatori/asociatie?asociatieId=${asociatieId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setRows(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(r: ProprietarRow) {
    setEdit({
      proprietarId: r.proprietarId,
      prenume:      r.prenume ?? "",
      nume:         r.nume,
      telefon:      r.telefon ?? "",
      emailuri:     r.emailuri.length ? [...r.emailuri] : [""],
    });
    setSaveErr(null);
  }

  async function handleSave() {
    if (!edit) return;
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch(`/api/proprietari/${edit.proprietarId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenume:  edit.prenume,
          nume:     edit.nume,
          telefon:  edit.telefon,
          emailuri: edit.emailuri.filter(e => e.trim()),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setEdit(null);
      await load();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  function addEmail() {
    if (!edit) return;
    setEdit(prev => prev ? { ...prev, emailuri: [...prev.emailuri, ""] } : prev);
  }

  function removeEmail(i: number) {
    if (!edit) return;
    setEdit(prev => prev ? { ...prev, emailuri: prev.emailuri.filter((_, idx) => idx !== i) } : prev);
  }

  function updateEmail(i: number, val: string) {
    if (!edit) return;
    setEdit(prev => {
      if (!prev) return prev;
      const emailuri = [...prev.emailuri];
      emailuri[i] = val;
      return { ...prev, emailuri };
    });
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q
      || r.apartamentNr.toLowerCase().includes(q)
      || r.nume.toLowerCase().includes(q)
      || (r.prenume ?? "").toLowerCase().includes(q)
      || (r.telefon ?? "").includes(q)
      || r.emailuri.some(e => e.toLowerCase().includes(q));
  });

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
          <h1 className="page-title">Contacte proprietari</h1>
          <p className="page-sub">Gestionează datele de contact ale proprietarilor din asociație</p>
        </div>
      </div>

      {/* Căutare */}
      <div style={{ marginBottom: "1rem", maxWidth: 340 }}>
        <input
          type="text" className="input" placeholder="Caută după nume, apartament, email..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error   && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {loading && <div className="page-sub" style={{ marginBottom: "1rem" }}>Se încarcă...</div>}

      {!loading && filtered.length === 0 && !error && (
        <div className="empty-state">
          <span className="empty-state__icon">👥</span>
          <div className="empty-state__title">
            {search ? "Niciun rezultat" : "Niciun proprietar găsit"}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Ap.</th>
                <th>Proprietar</th>
                <th>Telefon</th>
                <th>Email(uri)</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.proprietarId}>
                  <td style={{ fontWeight: 700, color: "#a78bfa" }}>
                    {r.apartamentNr}
                    {!r.isMain && <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: 4 }}>co-prop</span>}
                  </td>
                  <td>
                    {[r.prenume, r.nume].filter(Boolean).join(" ") || <span style={{ color: "#475569" }}>—</span>}
                  </td>
                  <td style={{ color: r.telefon ? "#e2e8f0" : "#475569" }}>
                    {r.telefon || "—"}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {r.emailuri.length
                      ? r.emailuri.map((e, i) => (
                          <span key={i} style={{ display: "block", color: "#38bdf8" }}>{e}</span>
                        ))
                      : <span style={{ color: "#475569" }}>—</span>
                    }
                  </td>
                  <td>
                    <button className="btn btn--secondary btn--sm" onClick={() => openEdit(r)}>
                      ✎ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal edit */}
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Editează contact</h2>
              <button className="modal__close" onClick={() => setEdit(null)}>✕</button>
            </div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Prenume</label>
                  <input type="text" className="input"
                    value={edit.prenume} onChange={e => setEdit(p => p ? { ...p, prenume: e.target.value } : p)} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Nume *</label>
                  <input type="text" className="input"
                    value={edit.nume} onChange={e => setEdit(p => p ? { ...p, nume: e.target.value } : p)} />
                </div>
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Telefon</label>
                <input type="text" className="input" placeholder="07xx xxx xxx"
                  value={edit.telefon} onChange={e => setEdit(p => p ? { ...p, telefon: e.target.value } : p)} />
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Adrese email</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {edit.emailuri.map((em, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.5rem" }}>
                      <input type="email" className="input" style={{ flex: 1 }}
                        placeholder="email@exemplu.ro" value={em} onChange={e => updateEmail(i, e.target.value)} />
                      {edit.emailuri.length > 1 && (
                        <button type="button" className="btn btn--secondary btn--sm"
                          style={{ padding: "0 0.5rem", color: "#f87171" }}
                          onClick={() => removeEmail(i)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn--secondary btn--sm"
                    style={{ alignSelf: "flex-start" }} onClick={addEmail}>
                    + Adaugă email
                  </button>
                </div>
              </div>

              {saveErr && <div className="wizard__error">{saveErr}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setEdit(null)}>Anulează</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !edit.nume.trim()}>
                {saving ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
