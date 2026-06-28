"use client";

import { useEffect, useState } from "react";

// ─── Layer 1: Acces funcții (matricea de rapoarte) ────────────────────────────

type ExtraCalitate = "presedinte" | "cenzor" | "membru_cex";
type RoleKey = "proprietar" | ExtraCalitate;
type PermMap = Record<string, boolean>;
type RolePerms = Record<RoleKey, PermMap>;

interface ReportDef { key: string; label: string; locked?: RoleKey[] }

const REPORT_GROUPS: { group: string; items: ReportDef[] }[] = [
  { group: "Liste & rapoarte lunare", items: [
    { key: "lista_plata", label: "Lista de plată" },
    { key: "explicatii",  label: "Explicații listă" },
  ]},
  { group: "Registre", items: [
    { key: "reg_incasari", label: "Registru Încasări" },
    { key: "reg_plati",    label: "Registru Plăți" },
    { key: "reg_casa",     label: "Registru Casă" },
    { key: "reg_banca",    label: "Registru Bancă" },
    { key: "jurnal",       label: "Jurnal" },
    { key: "reg_fonduri",  label: "Registru Fonduri" },
  ]},
  { group: "Situații", items: [
    { key: "restantieri",   label: "Restanțieri" },
    { key: "fisa_proprie",  label: "Fișă proprietar (proprie)", locked: ["proprietar"] },
    { key: "fisa_furnizor", label: "Fișă furnizor" },
    { key: "venituri",      label: "Venituri și cheltuieli" },
  ]},
  { group: "Alte funcții", items: [
    { key: "citiri",        label: "Citiri contoare (ap. propriu)", locked: ["proprietar", "presedinte"] },
    { key: "istoric_index", label: "Istoric index contoare (ap. propriu)", locked: ["proprietar"] },
    { key: "mesaje",        label: "Mesaje în aplicație", locked: ["proprietar", "presedinte", "cenzor", "membru_cex"] },
  ]},
];

const DEFAULT_PERMS: RolePerms = {
  proprietar: { lista_plata: true, explicatii: false, reg_incasari: false, reg_plati: false, reg_casa: false, reg_banca: false, jurnal: false, reg_fonduri: false, restantieri: false, fisa_proprie: true, fisa_furnizor: false, venituri: false, citiri: true, istoric_index: true, mesaje: true },
  presedinte: { lista_plata: true, explicatii: true,  reg_incasari: true,  reg_plati: true,  reg_casa: true,  reg_banca: true,  jurnal: true,  reg_fonduri: true,  restantieri: true,  fisa_proprie: true, fisa_furnizor: true,  venituri: true,  citiri: true,  istoric_index: true, mesaje: true },
  cenzor:     { lista_plata: true, explicatii: true,  reg_incasari: true,  reg_plati: true,  reg_casa: true,  reg_banca: true,  jurnal: true,  reg_fonduri: true,  restantieri: true,  fisa_proprie: true, fisa_furnizor: true,  venituri: true,  citiri: false, istoric_index: true, mesaje: true },
  membru_cex: { lista_plata: true, explicatii: false, reg_incasari: false, reg_plati: false, reg_casa: false, reg_banca: false, jurnal: false, reg_fonduri: false, restantieri: false, fisa_proprie: true, fisa_furnizor: false, venituri: false, citiri: false, istoric_index: false, mesaje: true },
};

const ROLE_LABELS: Record<RoleKey, string> = { proprietar: "Proprietar", presedinte: "Președinte", cenzor: "Cenzor", membru_cex: "Mem. CEX" };
const ROLE_COLORS: Record<RoleKey, string> = { proprietar: "#7c3aed", presedinte: "#fbbf24", cenzor: "#38bdf8", membru_cex: "#4ade80" };
const FEAT_ROLES: RoleKey[] = ["proprietar", "presedinte", "cenzor", "membru_cex"];

function mergeWithDefaults(saved: Partial<RolePerms>): RolePerms {
  const result = {} as RolePerms;
  for (const r of FEAT_ROLES) {
    result[r] = { ...DEFAULT_PERMS[r], ...(saved[r] ?? {}) };
    for (const grp of REPORT_GROUPS)
      for (const item of grp.items)
        if (item.locked?.includes(r)) result[r][item.key] = true;
  }
  return result;
}

// ─── Layer 2: Comunicare ──────────────────────────────────────────────────────

const COMM_PARTIES = ["ADMINISTRATOR", "PRESEDINTE", "CENZOR", "PROPRIETAR"] as const;
type Party = (typeof COMM_PARTIES)[number];
const PARTY_LABELS: Record<Party, string> = { ADMINISTRATOR: "Administrator", PRESEDINTE: "Președinte", CENZOR: "Cenzor", PROPRIETAR: "Proprietar" };
const PARTY_COLORS: Record<Party, string> = { ADMINISTRATOR: "#f472b6", PRESEDINTE: "#fbbf24", CENZOR: "#38bdf8", PROPRIETAR: "#7c3aed" };

type CommRow = Record<Party, boolean>;
interface CommMatrix { broadcast: Record<Party, boolean>; direct: Record<Party, CommRow> }

const DEFAULT_COMM: CommMatrix = {
  broadcast: { ADMINISTRATOR: true, PRESEDINTE: true, CENZOR: false, PROPRIETAR: false },
  direct: {
    PROPRIETAR:    { PROPRIETAR: true,  PRESEDINTE: true,  CENZOR: false, ADMINISTRATOR: false },
    PRESEDINTE:    { PROPRIETAR: true,  PRESEDINTE: false, CENZOR: true,  ADMINISTRATOR: true  },
    CENZOR:        { PROPRIETAR: false, PRESEDINTE: true,  CENZOR: false, ADMINISTRATOR: true  },
    ADMINISTRATOR: { PROPRIETAR: false, PRESEDINTE: true,  CENZOR: true,  ADMINISTRATOR: false },
  },
};

function mergeComm(raw: any): CommMatrix {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<CommMatrix>;
  const broadcast = { ...DEFAULT_COMM.broadcast };
  for (const p of COMM_PARTIES) if (typeof src.broadcast?.[p] === "boolean") broadcast[p] = src.broadcast![p];
  const direct = {} as Record<Party, CommRow>;
  for (const from of COMM_PARTIES) {
    direct[from] = { ...DEFAULT_COMM.direct[from] };
    const row = src.direct?.[from];
    if (row) for (const to of COMM_PARTIES) if (typeof row[to] === "boolean") direct[from][to] = row[to];
  }
  return { broadcast, direct };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DrepturiClient() {
  const [tab,     setTab]     = useState<"functii" | "comunicare">("functii");
  const [perms,   setPerms]   = useState<RolePerms | null>(null);
  const [comm,    setComm]    = useState<CommMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/utilizatori/role-permissions")
      .then(r => r.json())
      .then(d => { setPerms(mergeWithDefaults(d || {})); setComm(mergeComm(d?.comunicare)); setLoading(false); })
      .catch(() => { setPerms(mergeWithDefaults({})); setComm(mergeComm(null)); setLoading(false); });
  }, []);

  function toggleFeat(role: RoleKey, key: string) {
    if (!perms) return;
    const item = REPORT_GROUPS.flatMap(g => g.items).find(i => i.key === key);
    if (item?.locked?.includes(role)) return;
    setPerms(p => p ? { ...p, [role]: { ...p[role], [key]: !p[role][key] } } : p);
    setSaved(false);
  }
  function toggleBroadcast(p: Party) {
    setComm(c => c ? { ...c, broadcast: { ...c.broadcast, [p]: !c.broadcast[p] } } : c);
    setSaved(false);
  }
  function toggleDirect(from: Party, to: Party) {
    setComm(c => c ? { ...c, direct: { ...c.direct, [from]: { ...c.direct[from], [to]: !c.direct[from][to] } } } : c);
    setSaved(false);
  }

  async function handleSave() {
    if (!perms || !comm) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/utilizatori/role-permissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...perms, comunicare: comm }),
      });
      if (!res.ok) throw new Error("Eroare la salvare");
      setSaved(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Utilizatori</div>
          <h1 className="page-title">Drepturi & roluri</h1>
          <p className="page-sub">Acces la funcții și reguli de comunicare, pe roluri</p>
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Se salvează…" : "Salvează configurarea"}
        </button>
      </div>

      {/* Layere */}
      <div className="contur-tabs" style={{ marginBottom: "1rem" }}>
        <button className={`contur-tab${tab === "functii" ? " contur-tab--active" : ""}`} onClick={() => setTab("functii")}>
          Acces funcții
        </button>
        <button className={`contur-tab${tab === "comunicare" ? " contur-tab--active" : ""}`} onClick={() => setTab("comunicare")}>
          Comunicare
        </button>
      </div>

      {err   && <div className="auth-alert" style={{ marginBottom: 12 }}>{err}</div>}
      {saved && <div style={{ marginBottom: 12, color: "#4ade80", fontSize: "0.85rem" }}>✓ Configurare salvată</div>}
      {loading && <div className="page-sub">Se încarcă…</div>}

      {/* ── Layer Acces funcții ── */}
      {!loading && perms && tab === "functii" && (
        <div className="dash-panel">
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
            🔒 = activ permanent (nu poate fi dezactivat) · Modificările se aplică tuturor proprietarilor cu acel rol.
          </p>
          <div className="table-wrap">
            <table className="data-table drepturi-matrix">
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Funcționalitate</th>
                  {FEAT_ROLES.map(r => (
                    <th key={r} style={{ textAlign: "center", color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPORT_GROUPS.map(grp => (
                  <FeatGroup key={grp.group} grp={grp} perms={perms} onToggle={toggleFeat} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Layer Comunicare ── */}
      {!loading && comm && tab === "comunicare" && (
        <>
          <div className="dash-panel" style={{ marginBottom: "1rem" }}>
            <h3 className="drepturi-subtitle">Mesaje de interes (anunțuri)</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
              Cine poate posta în feed-ul comun, vizibil de toți membrii asociației. (O singură direcție — membrii doar citesc.)
            </p>
            <div className="drepturi-broadcast">
              {COMM_PARTIES.map(p => (
                <label key={p} className="drepturi-chk">
                  <input type="checkbox" checked={comm.broadcast[p]} onChange={() => toggleBroadcast(p)}
                    style={{ accentColor: PARTY_COLORS[p], width: 16, height: 16 }} />
                  <span style={{ color: PARTY_COLORS[p], fontWeight: 600 }}>{PARTY_LABELS[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="dash-panel">
            <h3 className="drepturi-subtitle">Conversații private 1:1</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
              Bifează cine poate <strong>iniția</strong> o conversație privată cu cine. Odată inițiată, ambii pot răspunde.
            </p>
            <div className="table-wrap">
              <table className="data-table drepturi-matrix">
                <thead>
                  <tr>
                    <th style={{ width: "22%" }}>De la \ Către</th>
                    {COMM_PARTIES.map(to => (
                      <th key={to} style={{ textAlign: "center", color: PARTY_COLORS[to] }}>{PARTY_LABELS[to]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMM_PARTIES.map(from => (
                    <tr key={from}>
                      <td style={{ fontWeight: 700, color: PARTY_COLORS[from] }}>{PARTY_LABELS[from]}</td>
                      {COMM_PARTIES.map(to => (
                        <td key={to} style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={comm.direct[from][to]} onChange={() => toggleDirect(from, to)}
                            style={{ accentColor: PARTY_COLORS[from], width: 16, height: 16, cursor: "pointer" }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#475569", marginTop: "0.85rem" }}>
              💡 Implicit, proprietarul <strong>nu</strong> poate vorbi direct cu administratorul — puntea o face președintele,
              iar administratorul comunică tuturor prin „Mesaje de interes".
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-componentă: grup de funcții ──────────────────────────────────────────

function FeatGroup({ grp, perms, onToggle }: {
  grp: { group: string; items: ReportDef[] };
  perms: RolePerms;
  onToggle: (role: RoleKey, key: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={5} className="drepturi-grouphead">{grp.group}</td>
      </tr>
      {grp.items.map(item => (
        <tr key={item.key}>
          <td style={{ color: "#cbd5e1" }}>{item.label}</td>
          {FEAT_ROLES.map(role => {
            const locked = item.locked?.includes(role);
            return (
              <td key={role} style={{ textAlign: "center" }}>
                {locked ? (
                  <span title="Activ permanent" style={{ color: ROLE_COLORS[role] }}>🔒</span>
                ) : (
                  <input type="checkbox" checked={perms[role][item.key] ?? false}
                    onChange={() => onToggle(role, item.key)}
                    style={{ accentColor: ROLE_COLORS[role], width: 16, height: 16, cursor: "pointer" }} />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
