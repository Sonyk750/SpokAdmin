"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const ROLE_LABELS: Record<string, string> = {
  PRESEDINTE: "Președinte",
  CENZOR:     "Cenzor",
  PROPRIETAR: "Proprietar",
  MEMBRU_CEX: "Membru CEX",
  CASIER:     "Casier",
}

interface InviteInfo {
  email: string; name: string | null; role: string
  orgName: string; asocName: string | null; expiresAt: string
}

export default function InviteClient({ token }: { token: string }) {
  const router = useRouter()
  const [info,     setInfo]     = useState<InviteInfo | null>(null)
  const [err,      setErr]      = useState("")
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error)
        else { setInfo(d); setName(d.name ?? "") }
        setLoading(false)
      })
      .catch(() => { setErr("Eroare la încărcare."); setLoading(false) })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setErr("Parolele nu coincid."); return }
    if (password.length < 6)  { setErr("Parola trebuie să aibă minim 6 caractere."); return }
    setErr(""); setSaving(true)
    const r = await fetch(`/api/invite/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    })
    const d = await r.json()
    setSaving(false)
    if (d.error) { setErr(d.error); return }
    setDone(true)
    setTimeout(() => router.push("/login"), 2500)
  }

  if (loading) return (
    <div className="invite-page">
      <div className="invite-card">
        <p style={{ color: "#9ca3af" }}>Se încarcă invitația...</p>
      </div>
    </div>
  )

  if (err && !info) return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-card__icon">✕</div>
        <h1 className="invite-card__title">Invitație invalidă</h1>
        <p style={{ color: "#f87171" }}>{err}</p>
        <a href="/login" className="btn btn--primary" style={{ marginTop: "1.5rem" }}>Mergi la login</a>
      </div>
    </div>
  )

  if (done) return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-card__icon" style={{ background: "#10b981" }}>✓</div>
        <h1 className="invite-card__title">Cont creat cu succes!</h1>
        <p style={{ color: "#9ca3af" }}>Vei fi redirecționat la pagina de login...</p>
      </div>
    </div>
  )

  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-card__icon">✉</div>
        <h1 className="invite-card__title">Invitație de colaborare</h1>

        <div className="invite-info">
          <div className="invite-info__row">
            <span className="invite-info__label">Organizație</span>
            <span className="invite-info__value">{info?.orgName}</span>
          </div>
          {info?.asocName && (
            <div className="invite-info__row">
              <span className="invite-info__label">Asociație</span>
              <span className="invite-info__value">{info.asocName}</span>
            </div>
          )}
          <div className="invite-info__row">
            <span className="invite-info__label">Rol</span>
            <span className="invite-info__value invite-info__badge">
              {ROLE_LABELS[info?.role ?? ""] ?? info?.role}
            </span>
          </div>
          <div className="invite-info__row">
            <span className="invite-info__label">Email</span>
            <span className="invite-info__value">{info?.email}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="invite-form">
          <div className="form-field">
            <label className="form-field__label">Numele tău complet</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-field__label">Setează parola</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Confirmă parola</label>
            <input className="input" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} required />
          </div>
          {err && <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{err}</p>}
          <button className="btn btn--primary" type="submit" disabled={saving} style={{ width: "100%", marginTop: "0.5rem" }}>
            {saving ? "Se creează contul..." : "Creează cont și acceptă invitația"}
          </button>
        </form>

        <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "1rem", textAlign: "center" }}>
          Ai deja cont? <a href="/login" style={{ color: "#7c3aed" }}>Conectează-te</a>
        </p>
      </div>
    </div>
  )
}
