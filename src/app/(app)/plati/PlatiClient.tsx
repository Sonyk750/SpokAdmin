"use client";

import { useState, useCallback, useEffect } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import RoDate from "@/components/RoDate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlataRow {
  id:            string;
  facturaId:     string;
  suma:          number;
  data:          string;
  metoda:        string;
  fondId:        string | null;
  fondName:      string | null;
  notes:         string | null;
  idTranzactie:  string | null;
  serieCh:       string | null;
  nrCh:          number | null;
  factura: {
    id:       string;
    serie:    string | null;
    numar:    string | null;
    furnizor: { id: string; nume: string } | null;
    asociatie:{ id: string; name: string };
  };
}

interface EditForm {
  suma:          string;
  metoda:        string;
  data:          string;
  notes:         string;
  idTranzactie:  string;
  serieCh:       string;
  nrCh:          string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (v: number) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METODE = [
  { value: "",       label: "Toate" },
  { value: "casa",   label: "Casă" },
  { value: "banca",  label: "Bancă" },
  { value: "online", label: "Online" },
];
const metodaLabel = (m: string) => m === "casa" ? "Casă" : m === "banca" ? "Bancă" : m === "online" ? "Online" : m;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfYear() { return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10); }
function roDate(iso: string) { return new Date(iso).toLocaleDateString("ro-RO"); }

function docLabel(p: PlataRow) {
  if (p.serieCh && p.nrCh != null) return `${p.serieCh} ${p.nrCh}`;
  if (p.idTranzactie) return p.idTranzactie;
  return "—";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatiClient() {
  const { activeId: asociatieId } = useAsociatie();

  const [plati,      setPlati]      = useState<PlataRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Filtre
  const [dataStart,  setDataStart]  = useState(firstOfYear());
  const [dataEnd,    setDataEnd]    = useState(todayISO());
  const [metoda,     setMetoda]     = useState("");

  // Edit
  const [editRow,    setEditRow]    = useState<PlataRow | null>(null);
  const [editForm,   setEditForm]   = useState<EditForm>({ suma: "", metoda: "banca", data: "", notes: "", idTranzactie: "", serieCh: "", nrCh: "" });
  const [saving,     setSaving]     = useState(false);
  const [editErr,    setEditErr]    = useState<string | null>(null);

  // Confirm delete
  const [delRow,     setDelRow]     = useState<PlataRow | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchPlati = useCallback(async () => {
    if (!asociatieId) { setPlati([]); return; }
    setLoading(true); setError(null);
    const sp = new URLSearchParams({ asociatieId, dataStart, dataEnd, ...(metoda && { metoda }) });
    try {
      const res  = await fetch(`/api/plati?${sp}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setPlati(Array.isArray(json) ? json : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asociatieId, dataStart, dataEnd, metoda]);

  useEffect(() => { fetchPlati(); }, [fetchPlati]);

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(p: PlataRow) {
    setEditRow(p);
    setEditErr(null);
    setEditForm({
      suma:         String(p.suma),
      metoda:       p.metoda,
      data:         p.data.slice(0, 10),
      notes:        p.notes ?? "",
      idTranzactie: p.idTranzactie ?? "",
      serieCh:      p.serieCh ?? "",
      nrCh:         p.nrCh != null ? String(p.nrCh) : "",
    });
  }

  async function saveEdit() {
    if (!editRow) return;
    const suma = parseFloat(editForm.suma);
    if (!editForm.suma || isNaN(suma) || suma <= 0) return setEditErr("Suma trebuie să fie un număr pozitiv.");
    setSaving(true); setEditErr(null);
    try {
      const res = await fetch(`/api/plati/${editRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suma,
          metoda:       editForm.metoda,
          data:         editForm.data || undefined,
          notes:        editForm.notes.trim() || null,
          idTranzactie: editForm.metoda === "banca" ? (editForm.idTranzactie.trim() || null) : null,
          serieCh:      editForm.metoda === "casa"  ? (editForm.serieCh.trim() || null) : null,
          nrCh:         editForm.metoda === "casa"  ? (parseInt(editForm.nrCh) || null) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setEditRow(null);
      await fetchPlati();
    } catch (e: any) { setEditErr(e.message); }
    finally { setSaving(false); }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!delRow) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/plati/${delRow.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setDelRow(null);
      await fetchPlati();
    } catch (e: any) { setError(e.message); setDelRow(null); }
    finally { setDeleting(false); }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalSuma = plati.reduce((s, p) => s + p.suma, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Plăți furnizori</h1>
            <p className="page-sub">Toate plățile înregistrate pe facturile furnizorilor</p>
          </div>
        </div>

        {/* Filtre */}
        <div className="lp-controls" style={{ marginBottom: "1rem" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">De la</label>
            <RoDate value={dataStart} onChange={v => setDataStart(v)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Până la</label>
            <RoDate value={dataEnd} onChange={v => setDataEnd(v)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Metodă</label>
            <select className="input" value={metoda} onChange={e => setMetoda(e.target.value)}>
              {METODE.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <button className="btn btn--secondary" onClick={fetchPlati} disabled={loading} style={{ alignSelf: "flex-end" }}>
            {loading ? "..." : "Actualizează"}
          </button>
        </div>

        {error && <div className="wizard__error" style={{ margin: "0 1.5rem 1rem" }}>{error}</div>}
      </div>

      {/* Tabel */}
      <div className="table-wrap" style={{ margin: "0 1.5rem 1.5rem" }}>
        {loading && !plati.length ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}>Se încarcă...</div>
        ) : plati.length === 0 ? (
          <div className="dash-panel__empty">Nicio plată în perioada selectată.</div>
        ) : (
          <table className="data-table" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Furnizor</th>
                <th>Factură</th>
                <th style={{ textAlign: "center" }}>Metodă</th>
                <th style={{ textAlign: "center" }}>Document</th>
                <th style={{ textAlign: "right" }}>Sumă (lei)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plati.map(p => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>{roDate(p.data)}</td>
                  <td style={{ fontWeight: 600, color: "#e2e8f0" }}>{p.factura.furnizor?.nume ?? "—"}</td>
                  <td style={{ color: "#a78bfa", whiteSpace: "nowrap" }}>
                    {[p.factura.serie, p.factura.numar].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 600,
                      background: p.metoda === "casa" ? "rgba(74,222,128,0.12)" : p.metoda === "banca" ? "rgba(56,189,248,0.12)" : "rgba(167,139,250,0.12)",
                      color:      p.metoda === "casa" ? "#4ade80"                : p.metoda === "banca" ? "#38bdf8"                : "#a78bfa",
                    }}>
                      {metodaLabel(p.metoda)}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {docLabel(p)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80", whiteSpace: "nowrap" }}>
                    {fmt2(p.suma)}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                      <button className="btn-action" title="Editează" onClick={() => openEdit(p)}>✎</button>
                      <button className="btn-action btn-action--danger" title="Șterge" onClick={() => setDelRow(p)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>
                  Total ({plati.length} plăți)
                </td>
                <td style={{ textAlign: "right", fontWeight: 900, color: "#4ade80" }}>{fmt2(totalSuma)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Modal Editează ─────────────────────────────────────────────────── */}
      {editRow && (
        <div className="modal-overlay" onClick={() => !saving && setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Editează plată</h2>
              <button className="modal__close" onClick={() => setEditRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom: "1rem", fontSize: "0.82rem", color: "#64748b" }}>
                <strong style={{ color: "#e2e8f0" }}>{editRow.factura.furnizor?.nume ?? "—"}</strong>
                {" · "}
                {[editRow.factura.serie, editRow.factura.numar].filter(Boolean).join(" ") || "—"}
              </div>

              {editErr && <div className="wizard__error" style={{ marginBottom: "0.75rem" }}>{editErr}</div>}

              <div className="form-grid form-grid--2">
                <div className="form-field">
                  <label className="form-field__label">Sumă (lei) *</label>
                  <input type="number" className="input" step="0.01" min="0.01"
                    value={editForm.suma} onChange={e => setEditForm(f => ({ ...f, suma: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Metodă</label>
                  <select className="input" value={editForm.metoda} onChange={e => setEditForm(f => ({ ...f, metoda: e.target.value }))}>
                    <option value="banca">Bancă</option>
                    <option value="casa">Casă</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                {editForm.metoda === "banca" && (
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-field__label">ID Tranzacție</label>
                    <input type="text" className="input" placeholder="ex: OP-2025-0042"
                      value={editForm.idTranzactie} onChange={e => setEditForm(f => ({ ...f, idTranzactie: e.target.value }))} />
                  </div>
                )}
                {editForm.metoda === "casa" && (<>
                  <div className="form-field">
                    <label className="form-field__label">Serie chitanță</label>
                    <input type="text" className="input" placeholder="ex: CH"
                      value={editForm.serieCh} onChange={e => setEditForm(f => ({ ...f, serieCh: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Nr chitanță</label>
                    <input type="number" className="input" min="1" step="1"
                      value={editForm.nrCh} onChange={e => setEditForm(f => ({ ...f, nrCh: e.target.value }))} />
                  </div>
                </>)}

                <div className="form-field">
                  <label className="form-field__label">Data</label>
                  <RoDate value={editForm.data} onChange={v => setEditForm(f => ({ ...f, data: v }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Note</label>
                  <input type="text" className="input"
                    value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setEditRow(null)} disabled={saving}>Anulează</button>
              <button className="btn btn--primary" onClick={saveEdit} disabled={saving}>{saving ? "Se salvează..." : "Salvează"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmare ștergere ──────────────────────────────────────── */}
      {delRow && (
        <div className="modal-overlay" onClick={() => !deleting && setDelRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal__header">
              <h2 className="modal__title">Șterge plată</h2>
              <button className="modal__close" onClick={() => setDelRow(null)}>×</button>
            </div>
            <div className="modal__body">
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                Ștergi plata de <strong style={{ color: "#f87171" }}>{fmt2(delRow.suma)} lei</strong> din{" "}
                <strong>{roDate(delRow.data)}</strong>
                {delRow.factura.furnizor && <> — {delRow.factura.furnizor.nume}</>}?
              </p>
              <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginTop: "0.5rem" }}>
                Statusul facturii va fi recalculat automat.
              </p>
            </div>
            <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn--secondary" onClick={() => setDelRow(null)} disabled={deleting}>Anulează</button>
              <button className="btn btn--primary" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                onClick={confirmDelete} disabled={deleting}>{deleting ? "Se șterge..." : "Șterge"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
