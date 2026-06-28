"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface ProprietarRow {
  proprietarId: string;
  prenume:      string | null;
  nume:         string;
  telefon:      string | null;
  emailuri:     string[];
  calitati:     string[];
  apartamentNr: string;
  apartamentId: string;
  isMain:       boolean;
}

type ExtraCalitate = "presedinte" | "cenzor" | "membru_cex";

// ─── Config calitati UI ───────────────────────────────────────────────────────

const CALITATI_CONFIG: { key: ExtraCalitate; label: string; color: string; bg: string }[] = [
  { key: "presedinte",  label: "Președinte",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  { key: "cenzor",      label: "Cenzor",      color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  { key: "membru_cex",  label: "Membru CEX",  color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayName(r: { prenume: string | null; nume: string }) {
  return [r.prenume, r.nume].filter(Boolean).join(" ") || "—";
}
function initials(r: { prenume: string | null; nume: string }) {
  return [r.prenume, r.nume].filter((x): x is string => !!x).map(p => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}
function getExtra(calitati: string[]): ExtraCalitate | null {
  for (const c of CALITATI_CONFIG) if (calitati.includes(c.key)) return c.key;
  return null;
}

function CalitateChip({ calitati }: { calitati: string[] }) {
  const extra = getExtra(calitati);
  if (!extra)
    return <span style={{ fontSize: "0.7rem", color: "#7c3aed", background: "rgba(124,58,237,0.12)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Proprietar</span>;
  const cfg = CALITATI_CONFIG.find(c => c.key === extra)!;
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <span style={{ fontSize: "0.7rem", color: "#7c3aed", background: "rgba(124,58,237,0.12)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Prop</span>
      <span style={{ fontSize: "0.7rem", color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{cfg.label}</span>
    </span>
  );
}

// ─── Modal proprietar (calitate + contact) ────────────────────────────────────

function ProprietarModal({
  row, onClose, onSaved,
}: { row: ProprietarRow; onClose: () => void; onSaved: () => void }) {
  const [tab,      setTab]      = useState<"calitate" | "contact">("calitate");
  const [extra,    setExtra]    = useState<ExtraCalitate | null>(getExtra(row.calitati));
  const [prenume,  setPrenume]  = useState(row.prenume  ?? "");
  const [nume,     setNume]     = useState(row.nume);
  const [telefon,  setTelefon]  = useState(row.telefon  ?? "");
  const [emailuri, setEmailuri] = useState<string[]>(row.emailuri.length ? [...row.emailuri] : [""]);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch(`/api/proprietari/${row.proprietarId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenume, nume, telefon,
          emailuri: emailuri.filter(e => e.trim()),
          calitati: extra ? ["proprietar", extra] : ["proprietar"],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Eroare");
      onSaved(); onClose();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "1.5rem 1.5rem 0", display: "flex", gap: "1rem", alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
            {initials(row)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{displayName(row)}</div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{row.apartamentNr}</div>
          </div>
          <button className="modal__close" style={{ alignSelf: "flex-start" }} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", padding: "1rem 1.5rem 0" }}>
          {(["calitate", "contact"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`contur-tab${tab === t ? " contur-tab--active" : ""}`} style={{ fontSize: "0.8rem" }}>
              {t === "calitate" ? "🏷 Calitate" : "📞 Date contact"}
            </button>
          ))}
        </div>

        <div className="modal__body" style={{ paddingTop: "1.25rem" }}>
          {tab === "calitate" && (
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                Calitate în asociație
              </div>
              {/* Proprietar — locked */}
              <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(124,58,237,0.08)", marginBottom: "0.4rem", cursor: "default" }}>
                <input type="checkbox" checked disabled style={{ accentColor: "#7c3aed", width: 16, height: 16 }} />
                <span style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.88rem" }}>Proprietar</span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#475569" }}>implicit</span>
              </label>
              {/* Extra roluri */}
              {CALITATI_CONFIG.map(c => (
                <label key={c.key} style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.4rem",
                  background: extra === c.key ? c.bg : "transparent",
                  border: `1px solid ${extra === c.key ? c.color + "44" : "transparent"}`,
                  cursor: "pointer",
                }}>
                  <input type="checkbox" checked={extra === c.key}
                    onChange={e => setExtra(e.target.checked ? c.key : null)}
                    style={{ accentColor: c.color, width: 16, height: 16 }}
                  />
                  <span style={{ color: extra === c.key ? c.color : "#cbd5e1", fontWeight: 600, fontSize: "0.88rem" }}>
                    {c.label}
                  </span>
                  {extra !== null && extra !== c.key && (
                    <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#475569" }}>
                      exclusiv cu {CALITATI_CONFIG.find(x => x.key === extra)?.label}
                    </span>
                  )}
                </label>
              ))}
              <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.75rem" }}>
                Drepturile detaliate per rol se configurează din pagina <strong>Drepturi & roluri</strong>.
              </p>
            </div>
          )}

          {tab === "contact" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Prenume</label>
                  <input type="text" className="input" value={prenume} onChange={e => setPrenume(e.target.value)} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-field__label">Nume *</label>
                  <input type="text" className="input" value={nume} onChange={e => setNume(e.target.value)} />
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Telefon</label>
                <input type="text" className="input" placeholder="07xx xxx xxx" value={telefon} onChange={e => setTelefon(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Adrese email</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {emailuri.map((em, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.4rem" }}>
                      <input type="email" className="input" style={{ flex: 1 }} placeholder="email@exemplu.ro"
                        value={em} onChange={e => { const a = [...emailuri]; a[i] = e.target.value; setEmailuri(a); }} />
                      {emailuri.length > 1 && (
                        <button type="button" className="btn btn--secondary btn--sm" style={{ padding: "0 0.5rem", color: "#f87171" }}
                          onClick={() => setEmailuri(emailuri.filter((_, j) => j !== i))}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn--secondary btn--sm" style={{ alignSelf: "flex-start" }}
                    onClick={() => setEmailuri([...emailuri, ""])}>+ Adaugă email</button>
                </div>
              </div>
            </div>
          )}

          {saveErr && <div className="wizard__error" style={{ marginTop: "0.75rem" }}>{saveErr}</div>}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Anulează</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !nume.trim()}>
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagina principală ────────────────────────────────────────────────────────

export default function AsociatieContacteClient() {
  const { activeId: asociatieId } = useAsociatie();
  const [rows,     setRows]     = useState<ProprietarRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<ProprietarRow | null>(null);

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

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || r.apartamentNr.toLowerCase().includes(q) || r.nume.toLowerCase().includes(q)
      || (r.prenume ?? "").toLowerCase().includes(q) || (r.telefon ?? "").includes(q)
      || r.emailuri.some(e => e.toLowerCase().includes(q));
  });

  const nrPres   = rows.filter(r => r.calitati.includes("presedinte")).length;
  const nrCenz   = rows.filter(r => r.calitati.includes("cenzor")).length;
  const nrCex    = rows.filter(r => r.calitati.includes("membru_cex")).length;
  const nrSimple = rows.filter(r => !CALITATI_CONFIG.some(c => r.calitati.includes(c.key))).length;

  if (!asociatieId) return (
    <div className="page-shell"><div className="wizard__error">Selectează o asociație din antetul paginii.</div></div>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacte proprietari</h1>
          <p className="page-sub">Click pe orice rând pentru calitate și date de contact</p>
        </div>
        <Link className="btn btn--secondary" href="/utilizatori/drepturi">
          ⚙ Drepturi & roluri
        </Link>
      </div>

      {/* Căutare + statistici */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" className="input" style={{ maxWidth: 300 }}
          placeholder="Caută după nume, apartament, email..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto", flexWrap: "wrap" }}>
          {([
            { label: "Proprietari", count: nrSimple, color: "#7c3aed" },
            { label: "Președinte",  count: nrPres,   color: "#fbbf24" },
            { label: "Cenzor",      count: nrCenz,   color: "#38bdf8" },
            { label: "Mem. CEX",    count: nrCex,    color: "#4ade80" },
          ] as const).filter(s => s.count > 0).map(s => (
            <div key={s.label} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 99, background: `${s.color}18`, color: s.color, fontWeight: 600 }}>
              {s.count} {s.label}
            </div>
          ))}
        </div>
      </div>

      {error   && <div className="wizard__error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {loading && <div className="page-sub">Se încarcă...</div>}

      {!loading && filtered.length === 0 && !error && (
        <div className="empty-state">
          <span className="empty-state__icon">👥</span>
          <div className="empty-state__title">{search ? "Niciun rezultat" : "Niciun proprietar"}</div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Ap.</th>
                <th>Proprietar</th>
                <th style={{ width: 200 }}>Calitate</th>
                <th style={{ width: 140 }}>Telefon</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.proprietarId} style={{ cursor: "pointer" }} onClick={() => setSelected(r)}>
                  <td style={{ fontWeight: 700, color: "#a78bfa" }}>
                    {r.apartamentNr}
                    {!r.isMain && <span style={{ fontSize: "0.65rem", color: "#64748b", marginLeft: 4 }}>co-prop</span>}
                  </td>
                  <td>
                    <span style={{ color: "#a78bfa", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                      {displayName(r)}
                    </span>
                  </td>
                  <td><CalitateChip calitati={r.calitati} /></td>
                  <td style={{ color: r.telefon ? "#e2e8f0" : "#475569", fontSize: "0.83rem" }}>{r.telefon || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {r.emailuri.length
                      ? <><span style={{ color: "#38bdf8" }}>{r.emailuri[0]}</span>{r.emailuri.length > 1 && <span style={{ color: "#64748b" }}> +{r.emailuri.length - 1}</span>}</>
                      : <span style={{ color: "#475569" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ProprietarModal row={selected} onClose={() => setSelected(null)} onSaved={load} />
      )}
    </div>
  );
}
