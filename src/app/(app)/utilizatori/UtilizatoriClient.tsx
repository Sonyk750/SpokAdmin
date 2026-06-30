"use client"

import { useEffect, useState, useCallback } from "react"
import { isSuperAdmin, ASOC_ROLE_LABELS } from "@/lib/roles"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserBase {
  id: string; name: string | null; email: string
  isActive: boolean; isSuspended: boolean; createdAt: string
}

interface SuperAdminUser extends UserBase {
  role: string
  memberships: { role: string; organization: { id: string; name: string } }[]
  asocUsers:   { role: string; isSuspended: boolean; asociatie: { id: string; name: string } }[]
}

interface AsocUser {
  id: string
  role: string; isSuspended: boolean; createdAt: string
  user: UserBase
  asociatie: { id: string; name: string }
}

interface Invitation {
  id: string; email: string; name: string | null
  role: string; createdAt: string; expiresAt: string
  asociatie: { id: string; name: string } | null
}

interface OwnerData {
  type: "owner"
  members:     { id: string; role: string; user: UserBase }[]
  asocUsers:   AsocUser[]
  invitations: Invitation[]
  asociatii:   { id: string; name: string }[]
}

interface SuperAdminData {
  type: "super_admin"
  users: SuperAdminUser[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "#f59e0b",
  PRESEDINTE:  "#7c3aed",
  CENZOR:      "#0891b2",
  PROPRIETAR:  "#059669",
  MEMBRU_CEX:  "#16a34a",
  CASIER:      "#ea580c",
  OWNER:       "#db2777",
  MEMBER:      "#6b7280",
}

function RoleBadge({ role }: { role: string }) {
  const label =
    ASOC_ROLE_LABELS[role as keyof typeof ASOC_ROLE_LABELS] ??
    (role === "SUPER_ADMIN" ? "Super Admin" : role === "OWNER" ? "Client Corporate" : role)
  return (
    <span style={{
      fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px",
      borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em",
      background: `${ROLE_COLORS[role] ?? "#6b7280"}22`,
      color: ROLE_COLORS[role] ?? "#6b7280",
      border: `1px solid ${ROLE_COLORS[role] ?? "#6b7280"}44`,
    }}>
      {label}
    </span>
  )
}

function StatusDot({ suspended }: { suspended: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: suspended ? "#ef4444" : "#10b981",
      marginRight: 6,
    }} />
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  asociatii, onClose, onDone,
}: {
  asociatii: { id: string; name: string }[]
  onClose: () => void; onDone: (url: string) => void
}) {
  const [email,      setEmail]      = useState("")
  const [name,       setName]       = useState("")
  const [role,       setRole]       = useState("PRESEDINTE")
  const [asociatieId, setAsociatieId] = useState(asociatii[0]?.id ?? "")
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr("")
    const r = await fetch("/api/utilizatori/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role, asociatieId: asociatieId || undefined }),
    })
    const d = await r.json()
    setSaving(false)
    if (d.error) { setErr(d.error); return }
    onDone(d.inviteUrl)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal__header">
          <h2 className="modal__title">Invită utilizator nou</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div className="form-field">
                <label className="form-field__label">Adresă email *</label>
                <input className="input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} required placeholder="email@exemplu.ro" />
              </div>
              <div className="form-field">
                <label className="form-field__label">Nume (opțional)</label>
                <input className="input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="Ion Popescu" />
              </div>
              <div className="form-field">
                <label className="form-field__label">Rol *</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="PRESEDINTE">Președinte</option>
                  <option value="CENZOR">Cenzor</option>
                  <option value="PROPRIETAR">Proprietar</option>
                  <option value="MEMBRU_CEX">Membru CEX</option>
                  <option value="CASIER">Casier</option>
                </select>
              </div>
              {asociatii.length > 0 && (
                <div className="form-field">
                  <label className="form-field__label">Asociație</label>
                  <select className="input" value={asociatieId} onChange={e => setAsociatieId(e.target.value)}>
                    <option value="">— Fără asociație specifică —</option>
                    {asociatii.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {err && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</p>}
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Se trimite..." : "Generează link invitație"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Link Modal ───────────────────────────────────────────────────────────────

function LinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <h2 className="modal__title">Link invitație generat</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "1rem" }}>
            Trimite acest link utilizatorului. Link-ul este valabil 7 zile.
          </p>
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "0.75rem 1rem", fontFamily: "monospace",
            fontSize: "0.8rem", wordBreak: "break-all", color: "#e2e8f0",
          }}>
            {url}
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Închide</button>
          <button className="btn btn--primary" onClick={copy}>
            {copied ? "✓ Copiat!" : "Copiază link"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SuperAdmin View ──────────────────────────────────────────────────────────

function SuperAdminView({ users, reload }: { users: SuperAdminUser[]; reload: () => void }) {
  const [search, setSearch] = useState("")

  async function suspend(id: string, isSusp: boolean) {
    await fetch(`/api/utilizatori/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isSusp ? "unsuspend" : "suspend" }),
    })
    reload()
  }

  const filtered = users.filter(u =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-header__title">Toți utilizatorii</h1>
          <p className="page-header__sub">{users.length} utilizatori înregistrați</p>
        </div>
      </div>

      <input className="input" placeholder="Caută după nume sau email..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 400, marginBottom: "1.25rem" }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Utilizator</th>
              <th>Rol global</th>
              <th>Organizație</th>
              <th>Asociații</th>
              <th>Status</th>
              <th>Înregistrat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name ?? "—"}</div>
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{u.email}</div>
                </td>
                <td><RoleBadge role={u.role} /></td>
                <td>
                  {u.memberships.map(m => (
                    <div key={m.organization.id} style={{ fontSize: "0.85rem" }}>
                      <RoleBadge role={m.role} />
                      <span style={{ marginLeft: 6, color: "#e2e8f0" }}>{m.organization.name}</span>
                    </div>
                  ))}
                  {u.memberships.length === 0 && <span style={{ color: "#6b7280" }}>—</span>}
                </td>
                <td>
                  {u.asocUsers.map((au, i) => (
                    <div key={i} style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                      <RoleBadge role={au.role} />
                      <span style={{ marginLeft: 4 }}>{au.asociatie.name}</span>
                    </div>
                  ))}
                  {u.asocUsers.length === 0 && <span style={{ color: "#6b7280" }}>—</span>}
                </td>
                <td>
                  <StatusDot suspended={u.isSuspended} />
                  {u.isSuspended ? "Suspendat" : "Activ"}
                </td>
                <td style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{fmtDate(u.createdAt)}</td>
                <td>
                  <button
                    className={`btn btn--sm ${u.isSuspended ? "btn--primary" : "btn--secondary"}`}
                    onClick={() => suspend(u.id, u.isSuspended)}
                    style={{ fontSize: "0.75rem" }}>
                    {u.isSuspended ? "Activează" : "Suspendă"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Owner View ───────────────────────────────────────────────────────────────

function OwnerView({ data, reload }: { data: OwnerData; reload: () => void }) {
  const [tab,      setTab]      = useState<"asoc" | "invite">("asoc")
  const [showInv,  setShowInv]  = useState(false)
  const [linkUrl,  setLinkUrl]  = useState("")
  const [search,   setSearch]   = useState("")

  async function suspend(userId: string, isSusp: boolean) {
    await fetch(`/api/utilizatori/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isSusp ? "unsuspend" : "suspend" }),
    })
    reload()
  }

  async function removeAsocUser(userId: string, asocUserId: string) {
    await fetch(`/api/utilizatori/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_asoc_user", asocUserId }),
    })
    reload()
  }

  async function revokeInvite(userId: string, invId: string) {
    await fetch(`/api/utilizatori/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_invitation", invitationId: invId }),
    })
    reload()
  }

  const filteredAsocUsers = data.asocUsers.filter(au =>
    (au.user.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    au.user.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-header__title">Utilizatori</h1>
          <p className="page-header__sub">
            {data.asocUsers.length} utilizatori activi · {data.invitations.length} invitații în așteptare
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowInv(true)}>
          + Invită utilizator
        </button>
      </div>

      <div className="sal-tabs" style={{ marginBottom: "1.5rem" }}>
        <button className={`sal-tab${tab === "asoc" ? " sal-tab--active" : ""}`}
          onClick={() => setTab("asoc")}>Utilizatori activi</button>
        <button className={`sal-tab${tab === "invite" ? " sal-tab--active" : ""}`}
          onClick={() => setTab("invite")}>
          Invitații
          {data.invitations.length > 0 && (
            <span style={{
              marginLeft: 6, background: "#7c3aed", color: "#fff",
              borderRadius: 10, fontSize: "0.65rem", padding: "1px 6px", fontWeight: 700,
            }}>{data.invitations.length}</span>
          )}
        </button>
      </div>

      {tab === "asoc" && (
        <>
          <input className="input" placeholder="Caută după nume sau email..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 360, marginBottom: "1.25rem" }} />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Utilizator</th>
                  <th>Rol</th>
                  <th>Asociație</th>
                  <th>Status</th>
                  <th>Adăugat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAsocUsers.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
                    Niciun utilizator. Folosiți butonul „Invită utilizator" pentru a adăuga.
                  </td></tr>
                )}
                {filteredAsocUsers.map(au => (
                  <tr key={au.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{au.user.name ?? "—"}</div>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{au.user.email}</div>
                    </td>
                    <td><RoleBadge role={au.role} /></td>
                    <td style={{ fontSize: "0.875rem" }}>{au.asociatie.name}</td>
                    <td>
                      <StatusDot suspended={au.isSuspended || au.user.isSuspended} />
                      {(au.isSuspended || au.user.isSuspended) ? "Suspendat" : "Activ"}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{fmtDate(au.createdAt)}</td>
                    <td style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className={`btn btn--sm ${au.user.isSuspended ? "btn--primary" : "btn--secondary"}`}
                        onClick={() => suspend(au.user.id, au.user.isSuspended)}
                        style={{ fontSize: "0.75rem" }}>
                        {au.user.isSuspended ? "Activează" : "Suspendă"}
                      </button>
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => removeAsocUser(au.user.id, au.id)}
                        style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                        Elimină
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "invite" && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Asociație</th>
                <th>Expiră</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.invitations.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
                  Nicio invitație în așteptare.
                </td></tr>
              )}
              {data.invitations.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.name ?? inv.email}</div>
                    {inv.name && <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{inv.email}</div>}
                  </td>
                  <td><RoleBadge role={inv.role} /></td>
                  <td style={{ fontSize: "0.875rem" }}>{inv.asociatie?.name ?? "—"}</td>
                  <td style={{ color: "#f59e0b", fontSize: "0.8rem" }}>{fmtDate(inv.expiresAt)}</td>
                  <td>
                    <button
                      className="btn btn--sm btn--secondary"
                      onClick={() => revokeInvite(inv.id, inv.id)}
                      style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                      Revocă
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInv && (
        <InviteModal
          asociatii={data.asociatii}
          onClose={() => setShowInv(false)}
          onDone={url => { setShowInv(false); setLinkUrl(url); reload() }}
        />
      )}
      {linkUrl && <LinkModal url={linkUrl} onClose={() => setLinkUrl("")} />}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UtilizatoriClient({
  userRole, orgRole,
}: {
  userRole: string; orgRole: string | null
}) {
  const [data,    setData]    = useState<SuperAdminData | OwnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch("/api/utilizatori")
    const d = await r.json()
    if (d.error) setErr(d.error)
    else setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="page-shell"><p style={{ color: "#9ca3af" }}>Se încarcă...</p></div>
  if (err)     return <div className="page-shell"><p style={{ color: "#f87171" }}>{err}</p></div>
  if (!data)   return null

  return (
    <div className="page-shell">
      {data.type === "super_admin" ? (
        <SuperAdminView users={(data as SuperAdminData).users} reload={load} />
      ) : (
        <OwnerView data={data as OwnerData} reload={load} />
      )}
    </div>
  )
}
